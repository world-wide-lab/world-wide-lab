/**
 * A small package to directly interact with the World-Wide-Lab API.
 *
 * @remarks
 * If you use one of the libraries with a supported integration package,
 * you may not need this package.
 *
 * @packageDocumentation
 */

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
   * The draw this response was produced in reaction to, from
   * {@link Client.drawItems}. Setting this records what the participant was
   * reacting to, so that it does not have to be reconstructed from the payload
   * later on.
   */
  drawId?: string;
  /**
   * Whether this response completes the draw it refers to. Defaults to true,
   * since reacting to an item with a single response is the common case. Set
   * it to false on trials which are only part of a reaction and let the last
   * one close the draw.
   */
  completesDraw?: boolean;
}

/**
 * How to pick which items to draw with {@link Client.drawItems}
 * @public
 */
export interface DrawItemsOptions {
  /**
   * The session the items are drawn for. Required, since a draw is by
   * definition served to someone.
   */
  sessionId: string;
  /**
   * How many items to draw (default is 1)
   */
  count?: number;
  /**
   * Which items to prefer. Use 'least-drawn' to spread participants evenly
   * across a pool, which is what balanced ratings and transmission chains
   * want. Default is 'random'.
   */
  policy?: "random" | "least-drawn" | "newest" | "oldest";
  /**
   * Skip items this session contributed and, if the session belongs to a
   * participant, items they contributed in any of their other sessions
   * (default is true).
   */
  excludeOwn?: boolean;
  /**
   * Skip items which have already been shown to this session (default is true)
   */
  excludeSeen?: boolean;
  /**
   * Only draw items which have been served fewer than this many times.
   */
  maxDrawsPerItem?: number;
  /**
   * Only draw items which have been completed fewer than this many times.
   * Draws which are still in progress do not count yet, so items can end up
   * with more completions than this when many sessions draw at once.
   */
  maxCompletionsPerItem?: number;
  /**
   * Only draw items which have fewer than this many child items, i.e. items
   * contributed with this one as their parentItemId. Rejected or withdrawn
   * children do not count. Use 1 to keep a transmission chain from branching. Draws which
   * have not been continued yet do not count, so a chain can still branch
   * when several sessions draw the same item at once.
   */
  maxChildrenPerItem?: number;
  /**
   * Only draw items at or beyond this generation of a chain.
   */
  minGeneration?: number;
  /**
   * Only draw items at or below this generation of a chain.
   */
  maxGeneration?: number;
}

/**
 * An item that has been drawn from a pool for a session
 * @public
 */
export interface DrawnItem {
  /**
   * The id of this draw. Pass it to {@link Session.response} to record what
   * the participant was reacting to.
   */
  drawId: string;
  /**
   * The id of the item that was drawn. Pass it as the parentItemId of your
   * own contribution to continue a chain.
   */
  itemId: string;
  /**
   * The content of the item
   */
  publicPayload: any;
  /**
   * How many items came before this one in its chain
   */
  generation: number;
  /**
   * The item this one was generated from, if any
   */
  parentItemId?: string;
}

/**
 * Options to contribute an item with {@link Session.contributeItem}
 * @public
 */
export interface ContributeItemOptions {
  /**
   * The content of the item. This is shown to other participants, so it must
   * not contain anything sensitive.
   */
  publicPayload: object;
  /**
   * The item this one was generated from, e.g. the item that was drawn to
   * produce it. This is what links the steps of a chain together.
   */
  parentItemId?: string;
  /**
   * Additional information about the item, which is never shown to anyone.
   */
  privateInfo?: object;
  /**
   * Also store the contribution as ordinary study data. The response is
   * written first and the item then points back at it.
   */
  response?: Omit<ClientResponseOptions, "sessionId">;
  /**
   * The response this item was generated from, if it has already been stored.
   */
  responseId?: number;
}

/**
 * An item that has just been contributed to a pool
 * @public
 */
export interface ContributedItem {
  /**
   * The id of the new item
   */
  itemId: string;
  /**
   * Whether the item still needs to be approved before it is shown to others
   */
  status: string;
  /**
   * The id of the response the item was stored alongside, if one was created
   */
  responseId?: number;
}

/**
 * Options to read items from a pool with {@link Client.getItems}
 * @public
 */
export interface GetItemsOptions {
  /**
   * How many items to return (maximally)
   */
  limit?: number;
  /**
   * In which order to return the items (default is 'newest')
   */
  sort?: "newest" | "oldest" | "random";
  /**
   * Cache the result for this many seconds
   */
  cacheFor?: number;
}

/**
 * An item as it is shown on a wall of what other participants produced
 * @public
 */
export interface PoolItem {
  itemId: string;
  publicPayload: any;
  generation: number;
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
export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";

const PARTICIPANT_ID_KEY = "WWL_PARTICIPANT_ID";

export class WorldWideLabError extends Error {
  constructor(public message: string) {
    super(message);

    this.name = "WorldWideLabError";
  }
}

function queryString(params: { [key: string]: any }): string {
  const setParams: { [key: string]: any } = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      setParams[key] = value;
    }
  }
  return new URLSearchParams(setParams).toString();
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

    const response = await fetch(url, fetchOptions);
    return response;
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
   * @param opts - Options to create the response with
   * @returns true if the response was created successfully
   */
  async createResponse(opts: ClientResponseOptions): Promise<boolean> {
    const result = await this.call("POST", "/response/", opts);
    return result.status === 200;
  }

  /**
   * Create a new Response and return its id.
   * @param opts - Options to create the response with
   * @returns The id of the new response
   * @internal
   */
  async _createResponseWithId(opts: ClientResponseOptions): Promise<number> {
    const result = await this.call("POST", "/response/", opts);
    if (result.status !== 200) {
      throw new WorldWideLabError("Failed to create Response.");
    }
    return (await result.json()).responseId;
  }

  /**
   * Contribute an item to a pool, so that it can be shown to other
   * participants. See also {@link Session.contributeItem}, which is usually
   * what you want, since it links the item to the session it came from.
   *
   * @param poolId - The id of the pool to contribute to
   * @param opts - The item to contribute
   * @param sessionId - The session contributing the item, if there is one
   * @returns The id and status of the new item
   */
  async contributeItem(
    poolId: string,
    opts: ContributeItemOptions,
    sessionId?: string,
  ): Promise<ContributedItem> {
    // Store the item as study data first, so that the item can point at it
    let responseId = opts.responseId;
    if (opts.response) {
      if (!sessionId) {
        throw new WorldWideLabError(
          "A sessionId is required to store an item's response.",
        );
      }
      responseId = await this._createResponseWithId({
        sessionId,
        ...opts.response,
      });
    }

    const result = await this.call("POST", `/item-pool/${poolId}/item`, {
      publicPayload: opts.publicPayload,
      sessionId,
      responseId,
      parentItemId: opts.parentItemId,
      privateInfo: opts.privateInfo,
    });
    if (result.status !== 200) {
      throw new WorldWideLabError("Failed to contribute Item.");
    }
    const data = await result.json();
    return { itemId: data.itemId, status: data.status, responseId };
  }

  /**
   * Draw items from a pool and record that they have been shown to a session.
   *
   * @remarks
   * The list can be shorter than the requested count, or empty, when the pool
   * has run out of items matching the query, so always check what you got
   * back before using it.
   *
   * @param poolId - The id of the pool to draw from
   * @param options - Which items to draw and which ones to skip
   * @returns The items that were drawn
   */
  async drawItems(
    poolId: string,
    options: DrawItemsOptions,
  ): Promise<DrawnItem[]> {
    const result = await this.call(
      "GET",
      `/item-pool/${poolId}/draw?${queryString({ ...options })}`,
    );
    if (result.status !== 200) {
      throw new WorldWideLabError("Failed to draw Items.");
    }
    return (await result.json()).draws;
  }

  /**
   * Retrieve items from a pool without drawing them, e.g. to show a wall of
   * what other participants have produced. Nothing is recorded, so results
   * can be cached via the cacheFor option.
   *
   * @param poolId - The id of the pool to read from
   * @param options - How many items to return and in which order
   * @returns The items in the pool
   */
  async getItems(
    poolId: string,
    options?: GetItemsOptions,
  ): Promise<PoolItem[]> {
    const result = await this.call(
      "GET",
      `/item-pool/${poolId}/items?${queryString({ ...options })}`,
    );
    if (result.status !== 200) {
      throw new WorldWideLabError("Failed to retrieve Items.");
    }
    return (await result.json()).items;
  }

  /**
   * Complete a draw without storing a response. See also
   * {@link Session.completeDraw}.
   *
   * @param drawId - The id of the draw to complete
   * @param sessionId - The session the item was drawn for
   * @returns true if the draw was completed successfully
   */
  async completeDraw(drawId: string, sessionId: string): Promise<boolean> {
    const result = await this.call("POST", `/draw/${drawId}/complete`, {
      sessionId,
    });
    return (await result.json()).success === true;
  }

  /**
   * Withdraw an item a session contributed, so that it is no longer shown to
   * anyone. See also {@link Session.retractItem}.
   *
   * @param itemId - The id of the item to retract
   * @param sessionId - The session that contributed the item
   * @returns true if the item was retracted successfully
   */
  async retractItem(itemId: string, sessionId: string): Promise<boolean> {
    const result = await this.call("DELETE", `/item/${itemId}`, { sessionId });
    return (await result.json()).success === true;
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
   */
  response(opts: Omit<ClientResponseOptions, "sessionId">): Promise<boolean> {
    const createResponseOptions = { sessionId: this.sessionId, ...opts };
    return this.clientInstance.createResponse(createResponseOptions);
  }

  /**
   * Contribute an item to a pool, so that it can be shown to other
   * participants.
   *
   * @param poolId - The id of the pool to contribute to
   * @param opts - The item to contribute
   * @returns The id and status of the new item
   */
  contributeItem(
    poolId: string,
    opts: ContributeItemOptions,
  ): Promise<ContributedItem> {
    return this.clientInstance.contributeItem(poolId, opts, this.sessionId);
  }

  /**
   * Draw items from a pool to show them to this session.
   *
   * @param poolId - The id of the pool to draw from
   * @param options - Which items to draw and which ones to skip
   * @returns The items that were drawn
   */
  drawItems(
    poolId: string,
    options?: Omit<DrawItemsOptions, "sessionId">,
  ): Promise<DrawnItem[]> {
    return this.clientInstance.drawItems(poolId, {
      sessionId: this.sessionId,
      ...options,
    });
  }

  /**
   * Complete a draw without storing a response. Responses can do this on
   * their own via their drawId, so this is for tasks whose outcome is not
   * logged as study data.
   *
   * @param drawId - The id of the draw to complete
   * @returns true if the draw was completed successfully
   */
  completeDraw(drawId: string): Promise<boolean> {
    return this.clientInstance.completeDraw(drawId, this.sessionId);
  }

  /**
   * Withdraw an item this session contributed, so that it is no longer shown
   * to anyone.
   *
   * @param itemId - The id of the item to retract
   * @returns true if the item was retracted successfully
   */
  retractItem(itemId: string): Promise<boolean> {
    return this.clientInstance.retractItem(itemId, this.sessionId);
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

export { VERSION };
