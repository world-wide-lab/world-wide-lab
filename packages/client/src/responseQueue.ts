import type { ClientResponseOptions } from "./index";

/**
 * Options to configure how responses are re-sent when they fail to upload.
 * These can be passed via {@link ClientOptions.responseQueue}.
 *
 * @public
 */
export interface ResponseQueueOptions {
  /** How often to try uploading a response in total (default: 10) */
  maxAttempts?: number;
  /** How long to wait before the first retry, in ms (default: 1000) */
  initialDelay?: number;
  /** The maximum time to wait between two attempts, in ms (default: 30000) */
  maxDelay?: number;
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
 * The result of sending a response to the server.
 *
 * @internal
 */
export type SendResponseResult =
  | { type: "stored" }
  | { type: "duplicate" }
  | { type: "failed"; status?: number; error?: unknown };

/**
 * The default options used by the {@link ResponseQueue}.
 *
 * @internal
 */
export const DEFAULT_RESPONSE_QUEUE_OPTIONS = {
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 30000,
} as const;

/** By how much the delay grows after every failed attempt */
const BACKOFF_FACTOR = 2;

const LOG_PREFIX = "[World-Wide-Lab]";

/** fetch() with keepalive only supports small bodies */
const KEEPALIVE_MAX_BODY_SIZE = 64 * 1024;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeResponse(response: ClientResponseOptions): string {
  return response.name !== undefined ? `"${response.name}"` : "(unnamed)";
}

function describeFailure(status?: number, error?: unknown): string {
  if (status !== undefined) {
    return `HTTP ${status}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return "unknown error";
}

/**
 * Re-sends responses which failed to upload, waiting a bit longer before every
 * attempt (an exponential backoff).
 *
 * Responses are re-sent independently of one another and in the background, so
 * a response which cannot be uploaded never holds up the rest of a study.
 *
 * @internal
 */
export class ResponseQueue {
  private retrying: Set<ClientResponseOptions> = new Set();
  private drainListeners: Array<(everythingStored: boolean) => void> = [];
  private lostResponseSinceDrain = false;

  public readonly options: Required<Omit<ResponseQueueOptions, "onError">> & {
    onError?: ResponseQueueOptions["onError"];
  };

  constructor(
    private sendResponse: (
      response: ClientResponseOptions,
      options?: object,
    ) => Promise<SendResponseResult>,
    options: ResponseQueueOptions = {},
  ) {
    this.options = { ...DEFAULT_RESPONSE_QUEUE_OPTIONS, ...options };
  }

  /** How many responses are currently waiting to be re-sent */
  public get pending(): number {
    return this.retrying.size;
  }

  /**
   * Keep re-sending a response which failed to upload, until the server has
   * stored it or we run out of attempts.
   *
   * @returns true if the response was stored in the end
   */
  public async retry(
    response: ClientResponseOptions,
    firstFailure: { status?: number; error?: unknown },
  ): Promise<boolean> {
    this.retrying.add(response);
    let failure = firstFailure;

    try {
      for (let attempt = 1; attempt < this.options.maxAttempts; attempt++) {
        const delay = this.getDelay(attempt);
        console.warn(
          `${LOG_PREFIX} Failed to upload response ${describeResponse(response)} (attempt ${attempt}/${this.options.maxAttempts}, ${describeFailure(failure.status, failure.error)}). Retrying in ${(delay / 1000).toFixed(1)}s.`,
        );
        this.options.onError?.({
          response,
          attempt,
          maxAttempts: this.options.maxAttempts,
          willRetry: true,
          retryInMs: delay,
          ...failure,
        });

        await sleep(delay);

        const result = await this.sendResponse(response);
        if (result.type !== "failed") {
          // A duplicate means one of our earlier attempts did make it to the
          // server after all
          console.info(
            `${LOG_PREFIX} Successfully uploaded response ${describeResponse(response)} after ${attempt + 1} attempts.`,
          );
          return true;
        }
        failure = result;
      }

      console.error(
        `${LOG_PREFIX} Giving up on response ${describeResponse(response)} after ${this.options.maxAttempts} attempts (${describeFailure(failure.status, failure.error)}). This response was NOT saved.`,
      );
      this.options.onError?.({
        response,
        attempt: this.options.maxAttempts,
        maxAttempts: this.options.maxAttempts,
        willRetry: false,
        ...failure,
      });
      this.lostResponseSinceDrain = true;
      return false;
    } finally {
      this.retrying.delete(response);
      if (this.retrying.size === 0) {
        this.callDrainListeners();
      }
    }
  }

  /**
   * Wait for all responses which are being re-sent.
   *
   * @returns true if all of them have been stored
   */
  public flush(): Promise<boolean> {
    if (this.retrying.size === 0) {
      return Promise.resolve(!this.lostResponseSinceDrain);
    }
    return new Promise((resolve) => {
      this.drainListeners.push(resolve);
    });
  }

  /**
   * Make one last, best-effort attempt at uploading the remaining responses.
   * Used when the page is being closed, where there is no time left to wait
   * for a proper response from the server.
   */
  public flushOnUnload(): void {
    if (this.retrying.size === 0) {
      return;
    }

    console.warn(
      `${LOG_PREFIX} The page is being closed, but ${this.retrying.size} response(s) have not been stored yet. Trying to send them off, though this might not work.`,
    );

    for (const response of this.retrying) {
      if (JSON.stringify(response).length > KEEPALIVE_MAX_BODY_SIZE) {
        console.error(
          `${LOG_PREFIX} Response ${describeResponse(response)} is too large to be sent while the page is closing and will be lost.`,
        );
        continue;
      }

      // Not awaited on purpose, keepalive keeps the request alive after the
      // page is gone and a failure cannot be handled anymore anyway.
      this.sendResponse(response, { keepalive: true }).catch(() => {});
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

  private getDelay(attempt: number): number {
    const delay = Math.min(
      this.options.initialDelay * BACKOFF_FACTOR ** (attempt - 1),
      this.options.maxDelay,
    );
    // Wait between 50% and 100% of the delay, so not all participants retry at
    // the exact same time once the server is back up
    return delay / 2 + Math.random() * (delay / 2);
  }
}
