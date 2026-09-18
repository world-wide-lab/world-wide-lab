import type { ClientResponseOptions, HTTPMethod } from "./index";

/**
 * Options to configure how responses are queued and re-sent when they fail to
 * upload. These can be passed via {@link ClientOptions.responseQueue}.
 *
 * @public
 */
export interface ResponseQueueOptions {
  /** How often to try uploading a response, including the first attempt (default: 10) */
  maxAttempts?: number;
  /** How long to wait before the first retry, in ms (default: 1000) */
  initialDelay?: number;
  /** The maximum time to wait between two attempts, in ms (default: 30000) */
  maxDelay?: number;
  /** By how much to multiply the delay after every failed attempt (default: 2) */
  factor?: number;
  /**
   * Whether to randomize the delays between attempts, so not all participants
   * retry at the same time once the server is back up (default: true)
   */
  jitter?: boolean;
  /**
   * When to abort a request and try again, in ms. This also applies to all
   * other requests made by the client (default: 30000)
   */
  requestTimeout?: number;
  /**
   * Whether to try sending off any remaining responses when the page is being
   * closed. This is always just a best effort (default: true)
   */
  flushOnUnload?: boolean;
  /**
   * Called whenever an attempt to upload a response fails, in addition to the
   * message being logged to the console.
   */
  onError?: (info: ResponseQueueErrorInfo) => void;
}

/**
 * Information about a failed attempt to upload a response, passed to
 * {@link ResponseQueueOptions.onError}.
 *
 * @public
 */
export interface ResponseQueueErrorInfo {
  /** The response which failed to upload */
  response: ClientResponseOptions;
  /** How often uploading this response has been attempted so far */
  attempt: number;
  /** How often uploading this response will be attempted in total */
  maxAttempts: number;
  /** Whether the response will be re-sent. If false, it is lost. */
  willRetry: boolean;
  /** How long we will wait before the next attempt, in ms */
  retryInMs?: number;
  /** The status code the server responded with (if it responded) */
  status?: number;
  /** The underlying error (if the request failed before getting a response) */
  error?: unknown;
}

/**
 * The default options used by the {@link ResponseQueue}.
 *
 * @internal
 */
export const DEFAULT_RESPONSE_QUEUE_OPTIONS = {
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  jitter: true,
  requestTimeout: 30000,
  flushOnUnload: true,
} as const;

/** How often to try a new clientResponseId, when the one we picked is taken */
const MAX_ID_REASSIGNMENTS = 5;

/** Status codes which indicate a problem that might go away on its own */
const RETRYABLE_STATUS_CODES = [408, 425, 429];

const LOG_PREFIX = "[World-Wide-Lab]";

/** fetch() with keepalive only supports small bodies */
const KEEPALIVE_MAX_BODY_SIZE = 64 * 1024;

type QueuedResponse = ClientResponseOptions & { clientResponseId: number };

interface QueueItem {
  response: QueuedResponse;
  attempts: number;
  idReassignments: number;
  /** Resolves the promise returned when the response was queued */
  resolve: (acknowledged: boolean) => void;
}

type AttemptOutcome =
  | { type: "acknowledged" }
  | { type: "duplicate" }
  | { type: "retry"; status?: number; error?: unknown; retryAfterMs?: number }
  | { type: "permanent"; status: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeResponse(response: ClientResponseOptions): string {
  return response.name !== undefined ? `"${response.name}"` : "(unnamed)";
}

/** Parse Retry-After, which is either a number of seconds or an HTTP date */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return undefined;
}

/**
 * A queue which keeps hold of responses until the server has confirmed that it
 * stored them. Failed uploads are re-tried with an exponential backoff.
 *
 * Responses are uploaded one after the other, so they are stored in the same
 * order in which they were collected.
 *
 * @internal
 */
export class ResponseQueue {
  private queue: QueueItem[] = [];
  /** The next clientResponseId to use, per session */
  private nextClientResponseIds: Map<string, number> = new Map();
  private processing = false;
  private drainListeners: Array<(everythingStored: boolean) => void> = [];
  private lostResponseSinceDrain = false;

  /** Responses which could not be uploaded and have been given up on */
  public readonly failedResponses: ClientResponseOptions[] = [];

  public readonly options: Required<Omit<ResponseQueueOptions, "onError">> & {
    onError?: ResponseQueueOptions["onError"];
  };

  constructor(
    private send: (
      method: HTTPMethod,
      endpoint: string,
      data: object,
      options?: object,
    ) => Promise<Response>,
    options: ResponseQueueOptions = {},
  ) {
    this.options = { ...DEFAULT_RESPONSE_QUEUE_OPTIONS, ...options };
  }

  /** How many responses are still waiting to be uploaded */
  public get pending(): number {
    return this.queue.length;
  }

  /**
   * Add a response to the queue.
   *
   * @returns A promise resolving to true once the response has been stored or
   *   to false if it had to be given up on.
   */
  public enqueue(response: ClientResponseOptions): Promise<boolean> {
    const { sessionId } = response;
    const nextId = this.nextClientResponseIds.get(sessionId) ?? 0;
    const clientResponseId = response.clientResponseId ?? nextId;
    // Keep our counter ahead of any manually provided ids
    this.nextClientResponseIds.set(
      sessionId,
      Math.max(nextId, clientResponseId + 1),
    );

    return new Promise((resolve) => {
      this.queue.push({
        response: { ...response, clientResponseId },
        attempts: 0,
        idReassignments: 0,
        resolve,
      });

      this.process();
    });
  }

  /**
   * Wait for all queued responses to be uploaded.
   *
   * @returns A promise resolving to true if all responses have been stored or
   *   to false if any of them had to be given up on.
   */
  public flush(): Promise<boolean> {
    if (this.queue.length === 0 && !this.processing) {
      return Promise.resolve(!this.lostResponseSinceDrain);
    }
    return new Promise((resolve) => {
      this.drainListeners.push(resolve);
    });
  }

  /**
   * Make one last, best-effort attempt at uploading all remaining responses.
   * Used when the page is being closed, where there is no time left to wait
   * for a proper response from the server.
   */
  public flushOnUnload(): void {
    if (this.queue.length === 0) {
      return;
    }

    console.warn(
      `${LOG_PREFIX} The page is being closed, but ${this.queue.length} response(s) have not been stored yet. Trying to send them off, though this might not work.`,
    );

    for (const item of this.queue) {
      const body = JSON.stringify(item.response);
      if (body.length > KEEPALIVE_MAX_BODY_SIZE) {
        console.error(
          `${LOG_PREFIX} Response ${describeResponse(item.response)} is too large to be sent while the page is closing and will be lost.`,
        );
        continue;
      }

      // Not awaited on purpose, keepalive keeps the request alive after the
      // page is gone and a failure cannot be handled anymore anyway.
      this.send("POST", "/response/", item.response, { keepalive: true }).catch(
        () => {},
      );
    }
  }

  /** Get the next clientResponseId for a session and count it up */
  private claimClientResponseId(sessionId: string): number {
    const clientResponseId = this.nextClientResponseIds.get(sessionId) ?? 0;
    this.nextClientResponseIds.set(sessionId, clientResponseId + 1);
    return clientResponseId;
  }

  private async process(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // The first entry stays in the queue until it has been dealt with
        const item = this.queue[0];
        const acknowledged = await this.processItem(item);
        this.queue.shift();
        item.resolve(acknowledged);
      }
    } finally {
      this.processing = false;
      this.callDrainListeners();
    }
  }

  private callDrainListeners(): void {
    const everythingStored = !this.lostResponseSinceDrain;
    this.lostResponseSinceDrain = false;
    while (this.drainListeners.length > 0) {
      const listener = this.drainListeners.shift();
      listener?.(everythingStored);
    }
  }

  /** Try uploading a response until it is stored or we give up on it */
  private async processItem(item: QueueItem): Promise<boolean> {
    while (true) {
      item.attempts++;
      const outcome = await this.attemptUpload(item);

      if (outcome.type === "acknowledged") {
        if (item.attempts > 1) {
          console.info(
            `${LOG_PREFIX} Successfully uploaded response ${describeResponse(item.response)} after ${item.attempts} attempts.`,
          );
        }
        return true;
      }

      if (outcome.type === "duplicate") {
        if (item.attempts > 1) {
          // One of our earlier attempts did make it to the server after all
          console.info(
            `${LOG_PREFIX} Response ${describeResponse(item.response)} had already been stored by an earlier attempt.`,
          );
          return true;
        }

        // We never sent this response before, so its id must have been used by
        // someone else e.g. a second tab using the same session. Move on to the
        // next id and try again, rather than losing the response.
        if (item.idReassignments < MAX_ID_REASSIGNMENTS) {
          item.idReassignments++;
          const newId = this.claimClientResponseId(item.response.sessionId);
          console.warn(
            `${LOG_PREFIX} The id of response ${describeResponse(item.response)} (clientResponseId ${item.response.clientResponseId}) is already in use in session ${item.response.sessionId}. Re-sending it as ${newId}. Are multiple clients using the same session?`,
          );
          item.response.clientResponseId = newId;
          // Try again right away, there is nothing to wait for here
          item.attempts--;
          continue;
        }

        // We ran out of ids to try, which should not normally happen
        this.giveUp(item, {
          reason: `${MAX_ID_REASSIGNMENTS} of its ids were already in use`,
        });
        return false;
      }

      if (outcome.type === "permanent") {
        this.giveUp(item, {
          status: outcome.status,
          reason: `the server rejected it with HTTP ${outcome.status}`,
        });
        return false;
      }

      const { status, error, retryAfterMs } = outcome;

      if (item.attempts >= this.options.maxAttempts) {
        this.giveUp(item, {
          status,
          error,
          reason: `it failed ${item.attempts} times`,
        });
        return false;
      }

      const delay = this.getDelay(item.attempts, retryAfterMs);

      console.warn(
        `${LOG_PREFIX} Failed to upload response ${describeResponse(item.response)} (attempt ${item.attempts}/${this.options.maxAttempts}, ${this.describeFailure(status, error)}). Retrying in ${(delay / 1000).toFixed(1)}s.`,
      );
      this.options.onError?.({
        response: item.response,
        attempt: item.attempts,
        maxAttempts: this.options.maxAttempts,
        willRetry: true,
        retryInMs: delay,
        status,
        error,
      });

      await sleep(delay);
    }
  }

  private describeFailure(status?: number, error?: unknown): string {
    if (status !== undefined) {
      return `HTTP ${status}`;
    }
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return "unknown error";
  }

  private giveUp(
    item: QueueItem,
    info: { status?: number; error?: unknown; reason: string },
  ): void {
    console.error(
      `${LOG_PREFIX} Giving up on response ${describeResponse(item.response)}, because ${info.reason}. This response was NOT saved.`,
    );
    this.failedResponses.push(item.response);
    this.lostResponseSinceDrain = true;
    this.options.onError?.({
      response: item.response,
      attempt: item.attempts,
      maxAttempts: this.options.maxAttempts,
      willRetry: false,
      status: info.status,
      error: info.error,
    });
  }

  private getDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined) {
      return Math.min(retryAfterMs, this.options.maxDelay);
    }

    const delay = Math.min(
      this.options.initialDelay * this.options.factor ** (attempt - 1),
      this.options.maxDelay,
    );
    return this.options.jitter ? Math.random() * delay : delay;
  }

  private async attemptUpload(item: QueueItem): Promise<AttemptOutcome> {
    let response: Response;
    try {
      response = await this.send("POST", "/response/", item.response);
    } catch (error) {
      // Network errors, timeouts, CORS problems, ...
      return { type: "retry", error };
    }

    if (response.status === 200) {
      let body: any;
      try {
        body = await response.json();
      } catch (error) {
        // The server said it worked, we just cannot read its answer
        return { type: "acknowledged" };
      }
      return body?.duplicate === true
        ? { type: "duplicate" }
        : { type: "acknowledged" };
    }

    if (
      response.status >= 500 ||
      RETRYABLE_STATUS_CODES.includes(response.status)
    ) {
      return {
        type: "retry",
        status: response.status,
        retryAfterMs: parseRetryAfter(response.headers?.get("Retry-After")),
      };
    }

    // Anything else (e.g. a malformed response or an unknown sessionId) will
    // fail in exactly the same way when we try again.
    return { type: "permanent", status: response.status };
  }
}
