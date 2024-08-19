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
export type ClientOptions = {
  /**
   * The URL of the World-Wide-Lab server, e.g. https://localhost:8787/
   */
  url: string;
};

/**
 * Options to update an existing {@link Participant}.
 * @public
 */
export type ClientParticipantUpdateOptions = {
  privateInfo?: object;
  publicInfo?: object;
};

/**
 * Options to update an existing {@link Session}.
 * @public
 */
export type ClientSessionUpdateOptions = {
  privateInfo?: object;
  publicInfo?: object;
};

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
export type ClientSessionOptions = ClientSessionUpdateOptions & {
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
};

/**
 * Options to create a new Response
 * @public
 */
export type ClientResponseOptions = {
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
};

export type GetLeaderoardScoresOptions = {
  // Cache the result for this many seconds
  cacheFor?: number;
  // How many rows to return (maximally)
  limit?: number;
  // In which direction to sort the scores (default is 'desc')
  sort?: "desc" | "asc";
  // Should scores be aggregated? If so, how?
  aggregate?: "none" | "sum";
};

// Data to add to a leaderboard
export type LeaderboardScoreData = {
  // The numerical score
  score: number;
  // The individual name to display for this score
  publicIndividualName?: string;
  // The group name to display for this score and use for aggregation
  publicGroupName?: string;
};

// Data returned when getting scores from a leaderboard
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
   * @param leaderboardId - The id of the leaderboard to get scores from
   * @param level - The level of scores to get: individual or groups
   * @param options - Specify what scores to get, e.g. sorting and aggregation
   * @returns The scores of the leaderboard
   */
  async getLeaderboardScores(
    leaderboardId: string,
    level: "individual" | "groups" = "individual",
    options?: GetLeaderoardScoresOptions,
  ): Promise<LeaderboardScores> {
    const queryParams = {
      // Overwrite with user-supplied options
      ...options,
    };
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
   * @returns true if the score was added successfully
   */
  async addScoreToLeaderboard(
    leaderboardId: string,
    leaderboardScoreData: LeaderboardScoreData,
  ): Promise<boolean> {
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
      "PUT",
      `/leaderboard/${leaderboardId}/score`,
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

export { VERSION };
