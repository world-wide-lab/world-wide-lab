type ApiOptions = {
  url: string
}

type HTTPMethod = 'GET' | 'POST' | 'PUT'
type ResponseData = {
  name?: string,
  payload?: {
    [key: string]: any,
  }
}

export class Api {
  constructor(public options: ApiOptions) {
    console.log('Initializing Api', options);
  }

  async call(method: HTTPMethod, endpoint: string, data?: Object, options?: Object) {
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

  // async getParticipant () : Promise<Participant> {
  //   // Either get existing participant or create new one
  // }

  async createParticipant () : Promise<Participant> {
    const result = await this.call('POST', `/participant/`)
    return new Participant(this, result.participantId);
  }

  async createRun (participantId: string, studyId: string) : Promise<Run> {
    const result = await this.call('POST', `/run/`, { participantId, studyId })
    return new Run(this, result.runId);
  }

  async createResponse (runId: string, name: string, payload: Object) : Promise<boolean> {
    const result = await this.call('POST', `/response/`, { runId, payload })
    return true;
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

  startRun (studyId: string) : Promise<Run> {
    return this.apiInstance.createRun(this.participantId, studyId);
  }
}

export class Run extends ApiModel {
  constructor (apiInstance: Api, public runId: string) {
    super(apiInstance);
  }

  response (name: string, payload: Object) : Promise<boolean> {
    return this.apiInstance.createResponse(this.runId, name, payload);
  }
}
