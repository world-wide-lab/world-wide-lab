type ClientOptions = {
  /**
   * The URL of the World-Wide-Lab server, e.g. https://localhost:8787/
   */
  url: string
}

export type ClientRunOptions = {
  /**
   * The id of the study to create a run for. Required.
   */
  studyId: string,
  /**
   * Link the run to an existing participant
   */
  participant?: Participant,
  /**
   * If true, a participant will be linked to the run.
   * If a participantId is stored, this will automatically be used to link
   * the run to an existing participant.
   */
  linkParticipant?: boolean
}

export type ClientResponseOptions = {
  /**
   * Id of the run this response belongs to
   */
  runId: string,
  /**
   * Name identifying this trial or response
   */
  name: string | undefined,
  /**
   * The actual data of this response
   */
  payload: ObjectWithData,
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT'

const PARTICIPANT_ID_KEY = "WWL_PARTICIPANT_ID"

type ObjectWithData = {
  [key: string]: any
}

export class Client {
  constructor(public options: ClientOptions) {
    console.log('Initializing Client', options);
  }

  /**
   * Call an endpoint at the API server
   * @param method Which HTTP method to use: GET, POST or PUT
   * @param endpoint The endpoint to call, e.g. /participant/
   * @param data The data to send to the server (optional)
   * @param options Additional options to use
   * @returns The JSON body of the response from the server
   */
  async call(method: HTTPMethod, endpoint: string, data?: Object, options?: Object) : Promise<any> {
    const slash = endpoint.startsWith('/') ? '' : '/';
    const url = new URL('v1'+ slash + endpoint, this.options.url).toString();
    const body = data ? JSON.stringify(data) : undefined;
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': data ? 'application/json' : 'none',
      },
      body,

      ...options
    }

    const response = await fetch(url, fetchOptions);
    return response.json();
  }

  /**
   * Create a new participant  from sractch. Use getParticipant() if you want to get an existing participant
   * or store their id. This function will not keep track of a participant's id.
   * @returns A new Participant instance
   */
  async createParticipant () : Promise<Participant> {
    const result = await this.call('POST', `/participant/`)
    return new Participant(this, result.participantId);
  }

  /**
   * Start a new Run. If a participant's id is stored, it will be used. see getParticipant().
   * @param runOptions Options to create the run with
   * @returns A new Run instance
   */
  async createRun (runOptions: ClientRunOptions) : Promise <Run> {
    const runData: {
      studyId: string,
      participantId?: string,
    } = {
      studyId: runOptions.studyId
    }

    // Create a participant if requested
    let participant: Participant | undefined;
    if (runOptions.participant && runOptions.linkParticipant) {
      console.warn("Both participant and linkParticipant are set. Ignoring linkParticipant.")
    }
    if (runOptions.participant) {
      participant = runOptions.participant;
    } else if (runOptions.linkParticipant) {
      participant = await this.getParticipant();
    }
    if (participant) { runData.participantId = participant.participantId }

    const result = await this.call('POST', `/run/`, runData)
    const run = new Run(this, result.runId);

    // Link participant
    if (participant) {
      run.participant = participant;
    }

    return run;
  }

  /**
   * Create a new Response. See also Run.response()
   * @param opts Options to create the response with
   * @param opts.runId Id of the run this response belongs to
   * @param opts.name Name identifying this trial or response
   * @param opts.payload The actual data of this response
   * @returns true if the response was created successfully
   */
  async createResponse (opts: ClientResponseOptions) : Promise<boolean> {
    const result = await this.call('POST', `/response/`, opts)
    return true;
  }

  /**
   * Store the participantId of the last person that participated using your website.
   * @param participantId The participantId to store
   * @returns true if the id was stored successfully
   */
  storeParticipantId(participantId: string): boolean {
    if (!window.localStorage) {
      console.warn("localStorage API is not available. Participant-information will not be stored.")
      return false
    }
    window.localStorage.setItem(PARTICIPANT_ID_KEY, participantId)
    return true
  }

  /**
   * Get the participantId of the last person that participated using your website (if their id
   * was stored).
   * @returns The participantId or undefined if no id was stored
   */
  getStoredParticipantId(): string | undefined {
    if (!window.localStorage) {
      console.warn("localStorage API is not available. Participant-information will not be stored.")
      return undefined
    }
    return window.localStorage.getItem(PARTICIPANT_ID_KEY) || undefined
  }

  /**
   * Delete the stored participantId.
   */
  deleteStoredParticipantId(): void {
    window.localStorage.removeItem(PARTICIPANT_ID_KEY)
  }

  /**
   * Get a Participant. If someone has already participanted on this machine and their IDs is
   * saved, will return this existing participant. Otherwise, will create a new participant and
   * store the corresponding id.
   * @returns A Participant instance
   */
  async getParticipant () : Promise<Participant> {
    const id = this.getStoredParticipantId();
    if (id !== undefined) {
      return new Participant(this, id);
    }
    const participant = await this.createParticipant();
    return participant;
  }
}

// Base class that all data model classes inherit from
class ClientModel {
  constructor (public clientInstance: Client) { }
}

export class Participant extends ClientModel {
  constructor (clientInstance: Client, public participantId: string) {
    super(clientInstance);
  }

  /**
   * Update the participant's meta-data.
   * @param data The data to update. Can contain privateInfo and/or publicInfo.
   *   The publicInfo can be retrieved later on without authentication, the
   *   privateInfo can only be downlaoded later on by the researcher.
   * @returns true if the update was successful
   */
  async setMetadata (data: { privateInfo?: ObjectWithData, publicInfo?: ObjectWithData }) : Promise<boolean> {
    const result = await this.clientInstance.call('PUT', `/participant/${this.participantId}`, data);
    return result.success;
  }

  /**
   * Retrieve public meta-data for a participant
   * @returns The participant's publicInfo meta data
   */
  getPublicInfo () : Promise<{ publicInfo: ObjectWithData }> {
    return this.clientInstance.call('GET', `/participant/${this.participantId}`);
  }

  /**
   * Store a participant's participantId, so it can later be re-used via
   * client.getParticipant().
   * @returns true if the participantId was stored successfully
   */
  storeParticipantId (): boolean {
    return this.clientInstance.storeParticipantId(this.participantId);
  }
}

export type RunResponseOptions = Omit<ClientResponseOptions, 'runId'>;

export class Run extends ClientModel {
  public participant?: Participant;

  constructor (clientInstance: Client, public runId: string) {
    super(clientInstance);
  }

  /**
   * Create a new Response.
   */
  response (opts: RunResponseOptions) : Promise<boolean> {
    const createResponseOptions = { runId: this.runId, ...opts}
    return this.clientInstance.createResponse(createResponseOptions);
  }

  /**
   * Finish the run. This will mark the run as finished.
   * @returns true if the run was finished successfully
   */
  async finish () : Promise<boolean> {
    const result = await this.clientInstance.call('POST', `/run/finish`, { runId: this.runId });
    return result.success;
  }

  /**
   * Update the run's meta-data.
   * @param data The data to update. Can contain privateInfo and/or publicInfo.
   *   The publicInfo can be retrieved later on without authentication, the
   *   privateInfo can only be downlaoded later on by the researcher.
   */
  async setMetadata (data: { privateInfo?: ObjectWithData, publicInfo?: ObjectWithData }) : Promise<boolean> {
    const result = await this.clientInstance.call('PUT', `/run/${this.runId}`, data);
    return result.success;
  }

  /**
   * Retrieve public meta-data for a run
   * @returns The run's publicInfo meta data
   */
  getPublicInfo () : Promise<{ publicInfo: ObjectWithData }> {
    return this.clientInstance.call('GET', `/run/${this.runId}`);
  }

  /**
   * Store the participantId of the participant that is doing this run.
   * @returns true if the participantId was stored successfully
   */
  storeParticipantId (): boolean {
    if (this.participant) {
      return this.participant.storeParticipantId();
    } else {
      console.error("Cannot store participantId: No participant set / created. Do you maybe want to set linkParticipant to true?")
      return false;
    }
  }
}
