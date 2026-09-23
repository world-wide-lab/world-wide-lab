/**
 * A small package to directly interact with the World-Wide-Lab API.
 *
 * @remarks
 * If you use one of the libraries with a supported integration package,
 * you may not need this package.
 *
 * @packageDocumentation
 */

import {
  ResponseQueue,
  type ResponseQueueErrorInfo,
  type ResponseQueueOptions,
  type SendResponseResult,
} from "./responseQueue";
import { VERSION } from "./version";

/**
 * Options to create a new Client instance
 * @public
 */
export interface ClientOptions {
  /**
   * The URL of the World-Wide-Lab server, e.g. https://localhost:8787/
   */
  url: string;
  /**
   * After how many milliseconds to abort a request to the server.
   *
   * Default: 60000
   */
  requestTimeout?: number;
  /**
   * Re-send responses which failed to upload, waiting a bit longer before
   * every attempt (an exponential backoff).
   *
   * Responses are always sent off right away, this only adds re-sending them
   * when that fails. It is turned off by default, set it to true (or pass
   * options) to turn it on.
   *
   * @see {@link ResponseQueueOptions}
   */
  responseQueue?: boolean | ResponseQueueOptions;
}

interface ClientUpdateOptions {
  /**
   * Additional private information to store for the participant.
   */
  privateInfo?: object;
  /**
   * Additional public information to store for the participant.
   *
   * This information can be retrieved later without authentication.
   */
  publicInfo?: object;
}

/**
 * Options to update an existing {@link Participant}.
 * @public
 */
export interface ClientParticipantUpdateOptions extends ClientUpdateOptions {}

/**
 * Options to update an existing {@link Session}.
 * @public
 */
export interface ClientSessionUpdateOptions extends ClientUpdateOptions {}

/**
 * Options to create a new {@link Participant}
 * @public
 */
export type ClientParticipantOptions =
  | ClientParticipantUpdateOptions
  | undefined;

/**
 * Options to create a new {@link Session}
 * @public
 */
export interface ClientSessionOptions extends ClientSessionUpdateOptions {
  /**
   * The id of the study to create a session for. Required.
   */
  studyId: string;
  /**
   * Link the session to an existing participant
   */
  participant?: Participant;
  /**
   * If true, a participant will be linked to the session.
   * If a participantId is stored, this will automatically be used to link
   * the session to an existing participant.
   */
  linkParticipant?: boolean;
}

/**
 * Options to create a new Response
 * @public
 */
export interface ClientResponseOptions {
  /**
   * Id of the session this response belongs to
   */
  sessionId: string;
  /**
   * Name identifying this trial or response
   */
  name: string | undefined;
  /**
   * The actual data of this response
   */
  payload: object;
  /**
   * An id for this response, counting up from 0 within its session.
   *
   * @remarks
   * You will usually not want to set this yourself, as the client keeps track
   * of these ids for you. The server uses them to recognize responses it has
   * already stored, so that re-sending a response which previously failed
   * does not create a duplicate.
   */
  clientResponseId?: number;
}

/**
 * Options to get scores from a leaderboard when using {@link Client.getLeaderboardScores}
 * @public
 */
export interface GetLeaderoardScoresOptions {
  /**
   * Cache the result for this many seconds
   */
  cacheFor?: number;
  /**
   * How many rows to return (maximally)
   */
  limit?: number;
  /**
   * In which direction to sort the scores (default is 'desc')
   */
  sort?: "desc" | "asc";
  /**
   * Should scores be aggregated? If so, how?
   */
  aggregate?: "none" | "sum";
  /**
   * Only return scores that were updated after and including this timepoint.
   * Can be used with {@link oneWeekAgo}, {@link oneMonthAgo} or {@link oneYearAgo}.
   */
  updatedAfter?: Date;
  /**
   * Filter scores to only those with this publicIndividualName.
   */
  publicIndividualName?: string;
  /**
   * Filter scores to only those with this publicGroupName.
   */
  publicGroupName?: string;
}

/**
 * A record of data to add to a leaderboard with {@link Session.addScoreToLeaderboard}
 * @public
 */
export interface LeaderboardScoreData {
  /**
   * The numerical score
   */
  score: number;
  /**
   * The individual name to display for this score
   */
  publicIndividualName?: string;
  /**
   * The group name to display for this score and use for aggregation
   */
  publicGroupName?: string;
}

/**
 * Data returned when getting scores from a leaderboard with {@link Client.getLeaderboardScores}
 * @public
 */
export type LeaderboardScores = Array<{
  score: number;
  publicIndividualName?: string;
  publicGroupName?: string;
}>;

/**
 * HTTP method to use for a request
 *
 * @public
 */
export type HTTPMethod = "GET" | "POST" | "PUT";

const PARTICIPANT_ID_KEY = "WWL_PARTICIPANT_ID";

/** After how many milliseconds to abort a request to the server */
const DEFAULT_REQUEST_TIMEOUT = 60000;

/**
 * How often to try a new clientResponseId, when the one we picked is already
 * in use by another client in the same session.
 */
const MAX_ID_REASSIGNMENTS = 5;

/**
 * By how much to jump ahead when a clientResponseId is already in use. The
 * gap makes it obvious in the data that something unexpected happened.
 */
const ID_COLLISION_JUMP = 1000;

export class WorldWideLabError extends Error {
  constructor(public message: string) {
    super(message);

    this.name = "WorldWideLabError";
  }
}

function queryString(params: { [key: string]: any }): string {
  return new URLSearchParams(params).toString();
}

/**
 * You will need to create an instance of this class to communicate with the
 * World-Wide-Lab server. You can then use the methods of this class to create
 * participants, sessions and responses.
 *
 * @public
 */
export class Client {
  /**
   * Which library is being used to make requests to the server.
   * @internal
   */
  _library: string;
  /**
   * The version of the library being used to make requests to the server.
   * @internal
   */
  _libraryVersion?: string;
  /**
   * Re-sends responses which failed to upload. Undefined unless it has been
   * turned on via the responseQueue option.
   */
  private responseQueue?: ResponseQueue;
  /**
   * After how many milliseconds to abort a request to the server.
   */
  private requestTimeout: number;
  /** The next clientResponseId to use, per session */
  private nextClientResponseIds: Map<string, number> = new Map();
  /**
   * Responses which could not be uploaded and have been given up on.
   * These responses have *not* been stored by the server.
   */
  public readonly failedResponses: ClientResponseOptions[] = [];

  /**
   * Create a new Client instance
   * @param options - Options to create the client with
   */
  constructor(
    /**
     * Options the Client was created with
     */
    public options: ClientOptions,
  ) {
    console.log("Initializing Client", options);

    // Validate client options
    if (options.url) {
      const parsedUrl = new URL(options.url);
      if (
        typeof location !== "undefined" &&
        location.protocol !== parsedUrl.protocol
      ) {
        console.warn(
          `The client is initialized with a different protocol (${parsedUrl.protocol}) than the current page (${location.protocol}). This might cause CORS issues.`,
        );
      }
    } else {
      throw new Error("Error: url is required to initialize the client");
    }

    this._library = "@world-wide-lab/client";

    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;

    if (options.responseQueue) {
      this.responseQueue = new ResponseQueue(
        (response, callOptions) => this._sendResponse(response, callOptions),
        options.responseQueue === true ? {} : options.responseQueue,
      );

      if (
        typeof window !== "undefined" &&
        typeof window.addEventListener === "function"
      ) {
        window.addEventListener("pagehide", () => {
          this.responseQueue?.flushOnUnload();
        });
      }
    }
  }

  /**
   * How many responses failed to upload and are still being re-sent.
   *
   * @remarks
   * This is always 0 when the response queue is turned off.
   */
  get pendingResponses(): number {
    return this.responseQueue?.pending ?? 0;
  }

  /**
   * Wait for all responses which are still being re-sent.
   *
   * @remarks
   * Useful to make sure all data has arrived before e.g. re-directing
   * participants to another page.
   * @returns true if all responses have been stored, false if any of them had
   *   to be given up on.
   */
  async flushResponses(): Promise<boolean> {
    if (!this.responseQueue) {
      return true;
    }
    return this.responseQueue.flush();
  }

  /**
   * Call an endpoint at the API server
   * @param method - Which HTTP method to use: GET, POST or PUT
   * @param endpoint - The endpoint to call, e.g. /participant/
   * @param data - The data to send to the server (optional)
   * @param options - Additional options to use
   * @returns The JSON body of the response from the server
   */
  async call(
    method: HTTPMethod,
    endpoint: string,
    data?: Object,
    options?: Object,
  ): Promise<Response> {
    const slash = endpoint.startsWith("/") ? "" : "/";
    const url = new URL(`v1${slash}${endpoint}`, this.options.url).toString();
    const body = data ? JSON.stringify(data) : undefined;
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": data ? "application/json" : "none",
      },
      body,

      ...options,
    };

    // Abort requests which take too long, so they can be re-tried instead of
    // blocking everything that comes after them.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (fetchOptions.signal === undefined && this.requestTimeout > 0) {
      const controller = new AbortController();
      fetchOptions.signal = controller.signal;
      timeout = setTimeout(() => controller.abort(), this.requestTimeout);
    }

    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  /**
   * Create a new participant  from sractch. Use getParticipant() if you want to get an existing participant
   * or store their id. This function will not keep track of a participant's id.
   * @returns A new Participant instance
   * @see getParticipant
   */
  async createParticipant(
    participantParams: ClientParticipantOptions = undefined,
  ): Promise<Participant> {
    const result = await this.call("POST", "/participant/", participantParams);
    if (result.status !== 200) {
      throw new WorldWideLabError("Failed to create Participant.");
    }
    return new Participant(this, (await result.json()).participantId);
  }

  /**
   * Start a new Session. If a participant's id is stored, it will be used. see getParticipant().
   * @param sessionOptions - Options to create the session with
   * @returns A new Session instance
   */
  async createSession(sessionOptions: ClientSessionOptions): Promise<Session> {
    const sessionData: {
      studyId: string;
      participantId?: string;
      privateInfo?: object;
      publicInfo?: object;
      clientMetadata: {
        [key: string]: any;
      };
    } = {
      studyId: sessionOptions.studyId,
      clientMetadata: {
        version: VERSION,
        library: this._library,
      },
    };

    // Generate Client Metadata
    if (this._libraryVersion) {
      sessionData.clientMetadata.libraryVersion = this._libraryVersion;
    }
    if (typeof window !== "undefined" && "location" in window) {
      sessionData.clientMetadata.url = window.location.href;

      const search = window.location.search;
      if (search.length > 0) {
        sessionData.clientMetadata.searchParams = {};
        const searchParams = new URLSearchParams(search);
        for (const [key, value] of searchParams) {
          sessionData.clientMetadata.searchParams[key] = value;
        }
      }
    }
    if (typeof navigator !== "undefined") {
      sessionData.clientMetadata.navigator = {
        language: navigator.language,
        languages: navigator.languages,
      };
    }

    // Create a participant if requested
    let participant: Participant | undefined;
    if (sessionOptions.participant && sessionOptions.linkParticipant) {
      console.warn(
        "Both participant and linkParticipant are set. Ignoring linkParticipant.",
      );
    }
    if (sessionOptions.participant) {
      participant = sessionOptions.participant;
    } else if (sessionOptions.linkParticipant) {
      participant = await this.getParticipant();
    }
    if (participant) {
      sessionData.participantId = participant.participantId;
    }

    if (sessionOptions.privateInfo) {
      sessionData.privateInfo = sessionOptions.privateInfo;
    }
    if (sessionOptions.publicInfo) {
      sessionData.publicInfo = sessionOptions.publicInfo;
    }

    const result = await this.call("POST", "/session/", sessionData);
    if (result.status !== 200) {
      throw new WorldWideLabError("Failed to initialize Session.");
    }
    const session = new Session(this, (await result.json()).sessionId);

    // Link participant
    if (participant) {
      session.participant = participant;
    }

    return session;
  }

  /**
   * Create a new Response. See also {@link Session.response}
   *
   * @remarks
   * The response is sent off right away. When the response queue is turned on
   * and sending fails, the response is re-sent in the background, which this
   * function does not wait for. Use {@link Client.flushResponses} for that.
   * @param opts - Options to create the response with
   * @returns true if the response has been stored by the server
   */
  async createResponse(opts: ClientResponseOptions): Promise<boolean> {
    const response = {
      ...opts,
      clientResponseId:
        opts.clientResponseId ?? this.claimClientResponseId(opts.sessionId),
    };

    let result = await this._sendResponse(response);

    // Another client is already using this id in this session, so we jump
    // ahead and try again, rather than losing the response.
    for (
      let reassignments = 0;
      result.type === "duplicate" && reassignments < MAX_ID_REASSIGNMENTS;
      reassignments++
    ) {
      const newId = this.jumpClientResponseId(
        response.sessionId,
        response.clientResponseId,
      );
      console.warn(
        `[World-Wide-Lab] The id of response ${response.name ?? "(unnamed)"} (clientResponseId ${response.clientResponseId}) is already in use in session ${response.sessionId}. Re-sending it as ${newId}. Are multiple clients using the same session?`,
      );
      response.clientResponseId = newId;
      result = await this._sendResponse(response);
    }

    if (result.type === "stored") {
      return true;
    }

    if (result.type === "duplicate") {
      // We ran out of ids to try, which should not normally happen
      console.error(
        `[World-Wide-Lab] Giving up on response ${response.name ?? "(unnamed)"}, because ${MAX_ID_REASSIGNMENTS} of its ids were already in use. This response was NOT saved.`,
      );
      this.failedResponses.push(response);
      return false;
    }

    if (this.responseQueue) {
      // Re-send the response in the background, so a failing upload never
      // holds up the rest of the study.
      this.responseQueue.retry(response, result).then((stored) => {
        if (!stored) {
          this.failedResponses.push(response);
        }
      });
    } else {
      this.failedResponses.push(response);
    }
    return false;
  }

  /** Send a single response to the server */
  private async _sendResponse(
    response: ClientResponseOptions,
    options?: object,
  ): Promise<SendResponseResult> {
    let result: Response;
    try {
      result = await this.call("POST", "/response/", response, options);
    } catch (error) {
      // Network errors, timeouts, CORS problems, ...
      return { type: "failed", error };
    }

    if (result.status !== 200) {
      return { type: "failed", status: result.status };
    }

    let body: any;
    try {
      body = await result.json();
    } catch (error) {
      // The server said it worked, we just cannot read its answer
      return { type: "stored" };
    }
    return body?.duplicate === true
      ? { type: "duplicate" }
      : { type: "stored" };
  }

  /** Get the next clientResponseId for a session and count it up */
  private claimClientResponseId(sessionId: string): number {
    const clientResponseId = this.nextClientResponseIds.get(sessionId) ?? 0;
    this.nextClientResponseIds.set(sessionId, clientResponseId + 1);
    return clientResponseId;
  }

  /**
   * Replace a clientResponseId which is already in use with one far ahead of
   * it, so the collision is obvious in the data.
   */
  private jumpClientResponseId(sessionId: string, usedId: number): number {
    const clientResponseId = usedId + ID_COLLISION_JUMP;
    this.nextClientResponseIds.set(sessionId, clientResponseId + 1);
    return clientResponseId;
  }

  /**
   * Store the participantId of the last person that participated using your website.
   * @param participantId - The participantId to store
   * @returns true if the id was stored successfully
   */
  storeParticipantId(participantId: string): boolean {
    if (!window.localStorage) {
      console.warn(
        "localStorage API is not available. Participant-information will not be stored.",
      );
      return false;
    }
    window.localStorage.setItem(PARTICIPANT_ID_KEY, participantId);
    return true;
  }

  /**
   * Get the participantId of the last person that participated using your website (if their id
   * was stored).
   * @returns The participantId or undefined if no id was stored
   */
  getStoredParticipantId(): string | undefined {
    if (!window.localStorage) {
      console.warn(
        "localStorage API is not available. Participant-information will not be stored.",
      );
      return undefined;
    }
    return window.localStorage.getItem(PARTICIPANT_ID_KEY) || undefined;
  }

  /**
   * Delete the stored participantId.
   */
  deleteStoredParticipantId(): void {
    window.localStorage.removeItem(PARTICIPANT_ID_KEY);
  }

  /**
   * Get a Participant. If someone has already participanted on this machine and their IDs is
   * saved, will return this existing participant. Otherwise, will create a new participant and
   * store the corresponding id.
   * @returns A Participant instance
   */
  async getParticipant(): Promise<Participant> {
    const id = this.getStoredParticipantId();
    if (id !== undefined) {
      return new Participant(this, id);
    }
    const participant = await this.createParticipant();
    return participant;
  }

  /**
   * Get the scores of a leaderboard.
   *
   * @param leaderboardId - The id of the leaderboard to get scores from
   * @param level - The level of scores to get: individual or groups
   * @param options - Specify what scores to get, e.g. sorting and aggregation
   * @returns The scores of the leaderboard
   */
  async getLeaderboardScores(
    leaderboardId: string,
    level: "individual" | "groups" = "individual",
    options?: GetLeaderoardScoresOptions,
  ): Promise<{ scores: LeaderboardScores }> {
    const queryParams = {
      // Overwrite with user-supplied options
      ...options,
    };

    if (queryParams.updatedAfter) {
      // @ts-ignore - Convert to ISO string (typescript does not like the type change here)
      queryParams.updatedAfter = queryParams.updatedAfter.toISOString();
    }

    return this.call(
      "GET",
      `/leaderboard/${leaderboardId}/scores/${level}?${queryString(queryParams)}`,
    ).then((response) => response.json());
  }
}

/**
 * The Base class for all data model classes, such as {@link Participant} and {@link Session}.
 *
 * @remarks
 *
 * This class only contains a link to the client instance that created the
 * model i.e. if you create a new Participant instance, it will have an
 * internal link to the client that created it.
 *
 * This class should not be used directly.
 *
 * @internal
 */
export class _ClientModel {
  constructor(public clientInstance: Client) {}
}

/**
 * A World-Wide-Lab participant, typically used to link multiple {@link Session}s.
 * @public
 */
export class Participant extends _ClientModel {
  constructor(
    clientInstance: Client,
    public participantId: string,
  ) {
    super(clientInstance);
  }

  /**
   * Update the participant's meta-data.
   * @param data - The data to update. Can contain privateInfo and/or publicInfo.
   *   The publicInfo can be retrieved later on without authentication, the
   *   privateInfo can only be downlaoded later on by the researcher.
   * @returns true if the update was successful
   */
  async update(data: ClientParticipantUpdateOptions): Promise<boolean> {
    const result = await this.clientInstance.call(
      "PUT",
      `/participant/${this.participantId}`,
      data,
    );
    return (await result.json()).success;
  }

  /**
   * Retrieve public meta-data for a participant
   * @returns The participant's publicInfo meta data
   */
  async getPublicInfo(): Promise<{ publicInfo: object }> {
    return (
      await this.clientInstance.call(
        "GET",
        `/participant/${this.participantId}`,
      )
    ).json();
  }

  /**
   * Store a participant's participantId, so it can later be re-used via
   * {@link Client.getParticipant}.
   * @returns true if the participantId was stored successfully
   */
  storeParticipantId(): boolean {
    return this.clientInstance.storeParticipantId(this.participantId);
  }
}

/**
 * A world-wide-lab session, corresponding to a person's participation in a
 * study. Use this class to capture responses.
 *
 * @public
 */
export class Session extends _ClientModel {
  public participant?: Participant;

  constructor(
    clientInstance: Client,
    public sessionId: string,
  ) {
    super(clientInstance);
  }

  /**
   * Create a new Response.
   *
   * @returns true if the response has been stored by the server
   */
  response(opts: Omit<ClientResponseOptions, "sessionId">): Promise<boolean> {
    const createResponseOptions = { sessionId: this.sessionId, ...opts };
    return this.clientInstance.createResponse(createResponseOptions);
  }

  /**
   * Finish the session. This will mark the session as finished.
   * @returns true if the session was finished successfully
   */
  async finish(): Promise<boolean> {
    const result = await this.clientInstance.call("POST", "/session/finish", {
      sessionId: this.sessionId,
    });
    return (await result.json()).success;
  }

  /**
   * Update the session's meta-data.
   * @param data - The data to update. Can contain privateInfo and/or publicInfo.
   *   The publicInfo can be retrieved later on without authentication, the
   *   privateInfo can only be downlaoded later on by the researcher.
   */
  async update(data: ClientSessionUpdateOptions): Promise<boolean> {
    const result = await this.clientInstance.call(
      "PUT",
      `/session/${this.sessionId}`,
      data,
    );
    return (await result.json()).success;
  }

  /**
   * Add a score to a leaderboard.
   * @param leaderboardId - The id of the leaderboard to add the score to
   * @param leaderboardScoreData - The data to add to the leaderboard
   * @returns The leaderboardScoreId if the score was added successfully (for use with {@link Session.updateLeaderboardScore | updateLeaderboardScore})
   */
  async addScoreToLeaderboard(
    leaderboardId: string,
    leaderboardScoreData: LeaderboardScoreData,
  ): Promise<number> {
    const data = {
      sessionId: this.sessionId,
      ...leaderboardScoreData,
    };
    if (!data.publicIndividualName && !data.publicGroupName) {
      console.warn(
        "No publicIndividualName or publicGroupName provided. Did you forget to add one?",
      );
    }
    const result = await this.clientInstance.call(
      "POST",
      `/leaderboard/${leaderboardId}/score`,
      data,
    );
    const responseData = await result.json();
    return responseData.leaderboardScoreId;
  }

  /**
   * Update a score on a leaderboard.
   * @param leaderboardId - The id of the leaderboard to update the score on
   * @param leaderboardScoreId - The id of the score to update (from {@link Session.addScoreToLeaderboard | addScoreToLeaderboard})
   * @param leaderboardScoreData - The data to update on the leaderboard
   * @returns true if the score was updated successfully
   */
  async updateLeaderboardScore(
    leaderboardId: string,
    leaderboardScoreId: number,
    leaderboardScoreData: LeaderboardScoreData,
  ): Promise<boolean> {
    const data = {
      sessionId: this.sessionId,
      ...leaderboardScoreData,
    };
    const result = await this.clientInstance.call(
      "PUT",
      `/leaderboard/${leaderboardId}/score/${leaderboardScoreId}`,
      data,
    );
    return (await result.json()).success;
  }

  /**
   * Retrieve public meta-data for a session
   * @returns The session's publicInfo meta data
   */
  async getPublicInfo(): Promise<{ publicInfo: object }> {
    return (
      await this.clientInstance.call("GET", `/session/${this.sessionId}`)
    ).json();
  }

  /**
   * Store the participantId of the participant that is doing this session.
   * @returns true if the participantId was stored successfully
   */
  storeParticipantId(): boolean {
    if (this.participant) {
      return this.participant.storeParticipantId();
    }
    console.error(
      "Cannot store participantId: No participant set / created. Do you maybe want to set linkParticipant to true?",
    );
    return false;
  }
}

// --- Helpers ---

/**
 * Helper function to return the date exactly one week ago.
 *
 * For use with {@link Client.getLeaderboardScores}.
 * @returns A Date object one week ago
 * @public
 */
export function oneWeekAgo(): Date {
  const now = new Date();
  now.setDate(now.getDate() - 7);
  return now;
}

/**
 * Helper function to return the date exactly one month ago.
 *
 * For use with {@link Client.getLeaderboardScores}.
 * @returns A Date object one month ago
 * @public
 */
export function oneMonthAgo(): Date {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return now;
}

/**
 * Helper function to return the date exactly one year ago.
 *
 * For use with {@link Client.getLeaderboardScores}.
 * @returns A Date object one year ago
 * @public
 */
export function oneYearAgo(): Date {
  const now = new Date();
  now.setFullYear(now.getFullYear() - 1);
  return now;
}

export type { ResponseQueueOptions, ResponseQueueErrorInfo };

export { VERSION };
