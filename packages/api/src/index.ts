type ApiOptions = {
  url: string
}

type HTTPMethod = 'GET' | 'POST' | 'PUT'

const PARTICIPANT_ID_KEY = "WWL_PARTICIPANT_ID"

export class Api {
  constructor(public options: ApiOptions) {
    console.log('Initializing Api', options);
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
    const url = this.options.url + endpoint;
    const fetchOptions: RequestInit = {
      method,
    }
    if (data) {
      fetchOptions.body = JSON.stringify(data)
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
   *  Create a new run from sractch. See also startRun().
   * @param participantId Id of the participant who does this run
   * @param studyId Id of the study the participant is doing
   * @returns A new Run instance
   */
  async createRun (participantId: string, studyId: string) : Promise<Run> {
    const result = await this.call('POST', `/run/`, { participantId, studyId })
    return new Run(this, result.runId);
  }

  /**
   * Create a new Response. See also Run.response()
   * @param runId Id of the run this response belongs to
   * @param name Name identifying this trial or response
   * @param payload The actual of this response
   * @returns true if the response was created successfully
   */
  async createResponse (runId: string, name: string, payload: Object) : Promise<boolean> {
    const result = await this.call('POST', `/response/`, { runId, payload })
    return true;
  }

  /**
   * Store the participant id of the last person that participated using your website.
   * @param participantId The participant id to store
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
   * Get the participantid of the last person that participated using your website (if their id
   * was stored).
   * @returns The participant id or undefined if no id was stored
   */
  getStoredParticipantId(): string | undefined {
    if (!window.localStorage) {
      console.warn("localStorage API is not available. Participant-information will not be stored.")
      return undefined
    }
    return window.localStorage.getItem(PARTICIPANT_ID_KEY) || undefined
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
    this.storeParticipantId(participant.participantId);
    return participant;
  }

  /**
   * Start a new Run. If a participant's id is stored, it will be used. see getParticipant().
   * @param studyId Id of the study the participant is doing
   * @returns A new Run instance
   */
  async startRun (studyId: string) : Promise <Run> {
    const participant = await this.getParticipant();
    return await participant.startRun(studyId);
  }
}

// Base class that all data model classes inherit from
class ApiModel {
  private api: Api;

  constructor (public apiInstance: Api) { }
}

export class Participant extends ApiModel {
  constructor (apiInstance: Api, public participantId: string) {
    super(apiInstance);
  }

  /**
   * Start a new Run for this participant.
   * @param studyId Id of the study the participant is doing
   * @returns A new Run instance
   */
  startRun (studyId: string) : Promise<Run> {
    return this.apiInstance.createRun(this.participantId, studyId);
  }

  /**
   * Update the participant's meta-data.
   * @param data The data to update. Can contain extraInfo and/or publicInfo.
   * @returns true if the update was successful
   */
  update (data: { extraInfo?: Object, publicInfo?: Object }) : Promise<boolean> {
    return this.apiInstance.call('PUT', `/participant/${this.participantId}`, data);
  }

  /**
   * Retrieve public meta-data for a participant
   * @returns The participant's publicInfo meta data
   */
  getPublicInfo () : Promise<{ publicInfo: Object }> {
    return this.apiInstance.call('GET', `/participant/${this.participantId}`);
  }
}

export class Run extends ApiModel {
  constructor (apiInstance: Api, public runId: string) {
    super(apiInstance);
  }

  response (name: string, payload: Object) : Promise<boolean> {
    return this.apiInstance.createResponse(this.runId, name, payload);
  }

  /**
   * Update the run's meta-data.
   * @param data The data to update. Can contain extraInfo and/or publicInfo.
   * @returns true if the update was successful
   */
  update (data: { extraInfo?: Object, publicInfo?: Object }) : Promise<boolean> {
    return this.apiInstance.call('PUT', `/run/${this.runId}`, data);
  }

  /**
   * Retrieve public meta-data for a run
   * @returns The run's publicInfo meta data
   */
  getPublicInfo () : Promise<{ publicInfo: Object }> {
    return this.apiInstance.call('GET', `/run/${this.runId}`);
  }
}
