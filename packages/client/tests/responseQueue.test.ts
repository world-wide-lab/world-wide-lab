import { Client } from "../src";

const URL = "https://example.wwl/";

interface FakeResponse {
  status: number;
  body?: object;
  headers?: { [key: string]: string };
}

/**
 * Create a fetch mock which returns the given responses, one after the other.
 * Entries can either be responses from the server or errors to throw, to
 * simulate a failing connection.
 */
function mockFetch(results: Array<FakeResponse | Error>) {
  const calls: Array<{ url: string; body: any; options: any }> = [];
  let callIndex = 0;

  global.fetch = vi.fn((url: string, options: any) => {
    calls.push({
      url,
      body: options.body ? JSON.parse(options.body) : undefined,
      options,
    });

    const result = results[Math.min(callIndex, results.length - 1)];
    callIndex++;

    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve({
      status: result.status,
      headers: {
        get: (name: string) => result.headers?.[name] ?? null,
      },
      json: () => Promise.resolve(result.body ?? {}),
    });
  }) as any;

  return { calls };
}

const OK: FakeResponse = {
  status: 200,
  body: { success: true, responseId: 1 },
};
const DUPLICATE: FakeResponse = {
  status: 200,
  body: { success: true, responseId: 1, duplicate: true },
};
const SERVER_ERROR: FakeResponse = { status: 500 };

function createClient(options = {}) {
  return new Client({
    url: URL,
    responseQueue: {
      // Keep tests fast, the actual delays are checked separately
      initialDelay: 1,
      maxDelay: 1,
      jitter: false,
      ...options,
    },
  });
}

/**
 * Create a client which keeps track of how long it waits between attempts,
 * without actually waiting for these delays.
 */
function trackDelays(options = {}) {
  const delays: number[] = [];
  vi.spyOn(global, "setTimeout").mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as any);

  const client = new Client({
    url: URL,
    responseQueue: {
      jitter: false,
      onError: (info) => {
        if (info.retryInMs !== undefined) {
          delays.push(info.retryInMs);
        }
      },
      ...options,
    },
  });
  return { client, delays };
}

const exampleResponse = {
  sessionId: "11111111-1111-1111-1111-111111111111",
  name: "my-trial",
  payload: { some: "data" },
};

describe("ResponseQueue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation(() => {});
    }
  });

  it("should be enabled by default", async () => {
    mockFetch([OK]);
    const client = new Client({ url: URL });

    expect(await client.createResponse(exampleResponse)).toBe(true);
    expect(client.pendingResponses).toBe(0);
  });

  it("should count clientResponseIds up, per session", async () => {
    const { calls } = mockFetch([OK]);
    const client = createClient();

    const otherSessionId = "22222222-2222-2222-2222-222222222222";
    await client.createResponse(exampleResponse);
    await client.createResponse(exampleResponse);
    await client.createResponse({
      ...exampleResponse,
      sessionId: otherSessionId,
    });
    await client.createResponse(exampleResponse);

    expect(calls.map((call) => call.body.clientResponseId)).toEqual([
      0, 1, 0, 2,
    ]);
    expect(calls.map((call) => call.body.sessionId)).toEqual([
      exampleResponse.sessionId,
      exampleResponse.sessionId,
      otherSessionId,
      exampleResponse.sessionId,
    ]);
  });

  it("should re-send a response until it is stored", async () => {
    const { calls } = mockFetch([
      new TypeError("Failed to fetch"),
      SERVER_ERROR,
      OK,
    ]);
    const client = createClient();

    expect(await client.createResponse(exampleResponse)).toBe(true);
    expect(calls.length).toBe(3);
    // Re-sent responses should keep their id, so the server can recognize them
    expect(calls.map((call) => call.body.clientResponseId)).toEqual([0, 0, 0]);
  });

  it("should give up after the maximum number of attempts", async () => {
    const { calls } = mockFetch([SERVER_ERROR]);
    const client = createClient({ maxAttempts: 3 });

    expect(await client.createResponse(exampleResponse)).toBe(false);
    expect(calls.length).toBe(3);
    expect(client.failedResponses.length).toBe(1);
    expect(client.failedResponses[0].name).toBe("my-trial");
    expect(console.error).toHaveBeenCalled();
  });

  it("should not re-try responses the server rejected", async () => {
    const { calls } = mockFetch([{ status: 400 }]);
    const client = createClient();

    expect(await client.createResponse(exampleResponse)).toBe(false);
    expect(calls.length).toBe(1);
    expect(client.failedResponses.length).toBe(1);
  });

  it("should treat a duplicate as a success when re-sending", async () => {
    const { calls } = mockFetch([SERVER_ERROR, DUPLICATE]);
    const client = createClient();

    expect(await client.createResponse(exampleResponse)).toBe(true);
    expect(calls.length).toBe(2);
    expect(client.failedResponses.length).toBe(0);
  });

  it("should use a new id when the first attempt is a duplicate", async () => {
    // This happens when another client is using the same session and has
    // already used the id we picked.
    const { calls } = mockFetch([DUPLICATE, OK]);
    const client = createClient();

    expect(await client.createResponse(exampleResponse)).toBe(true);
    expect(calls.map((call) => call.body.clientResponseId)).toEqual([0, 1]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("should give up when all of its ids are already in use", async () => {
    // Every id we try is already taken, which should not happen in practice
    const { calls } = mockFetch([DUPLICATE]);
    const client = createClient();

    expect(await client.createResponse(exampleResponse)).toBe(false);
    // The first attempt plus one for every re-assigned id
    expect(calls.length).toBe(6);
    expect(calls.map((call) => call.body.clientResponseId)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(client.failedResponses.length).toBe(1);
  });

  it("should keep responses in order", async () => {
    const { calls } = mockFetch([SERVER_ERROR, OK]);
    const client = createClient();

    const first = client.createResponse({ ...exampleResponse, name: "first" });
    const second = client.createResponse({
      ...exampleResponse,
      name: "second",
    });
    const third = client.createResponse({ ...exampleResponse, name: "third" });

    await Promise.all([first, second, third]);

    expect(calls.map((call) => call.body.name)).toEqual([
      // The first response fails once and is re-sent before the others
      "first",
      "first",
      "second",
      "third",
    ]);
  });

  it("should report how many responses are pending", async () => {
    mockFetch([OK]);
    const client = createClient();

    const promise = client.createResponse(exampleResponse);
    expect(client.pendingResponses).toBe(1);

    await promise;
    expect(client.pendingResponses).toBe(0);
  });

  it("should wait for all responses when flushing", async () => {
    mockFetch([OK]);
    const client = createClient();

    client.createResponse(exampleResponse);
    client.createResponse(exampleResponse);

    expect(await client.flushResponses()).toBe(true);
    expect(client.pendingResponses).toBe(0);
  });

  it("should report lost responses when flushing", async () => {
    mockFetch([{ status: 400 }]);
    const client = createClient();

    client.createResponse(exampleResponse);

    expect(await client.flushResponses()).toBe(false);
  });

  it("should resolve flushes when there is nothing to do", async () => {
    mockFetch([OK]);
    const client = createClient();

    expect(await client.flushResponses()).toBe(true);
  });

  it("should call onError for every failed attempt", async () => {
    mockFetch([SERVER_ERROR]);
    const onError = vi.fn();
    const client = createClient({ maxAttempts: 2, onError });

    await client.createResponse(exampleResponse);

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toMatchObject({
      attempt: 1,
      maxAttempts: 2,
      willRetry: true,
      status: 500,
    });
    expect(onError.mock.calls[1][0]).toMatchObject({
      attempt: 2,
      willRetry: false,
      status: 500,
    });
  });

  it("should back off exponentially", async () => {
    mockFetch([SERVER_ERROR]);
    const { client, delays } = trackDelays({
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 4000,
      factor: 2,
    });

    await client.createResponse(exampleResponse);

    expect(delays).toEqual([1000, 2000, 4000, 4000]);
  });

  it("should respect the Retry-After header", async () => {
    mockFetch([{ status: 429, headers: { "Retry-After": "2" } }]);
    const { client, delays } = trackDelays({ maxAttempts: 2, maxDelay: 30000 });

    await client.createResponse(exampleResponse);

    expect(delays).toEqual([2000]);
  });

  it("should send responses off directly when turned off", async () => {
    const { calls } = mockFetch([SERVER_ERROR]);
    const client = new Client({ url: URL, responseQueue: false });

    expect(await client.createResponse(exampleResponse)).toBe(false);
    // No re-trying and no clientResponseId to de-duplicate with
    expect(calls.length).toBe(1);
    expect(calls[0].body.clientResponseId).toBe(undefined);
    expect(client.pendingResponses).toBe(0);
  });

  it("should abort requests which take too long", async () => {
    const client = createClient({ requestTimeout: 5, maxAttempts: 1 });

    global.fetch = vi.fn((url: string, options: any) => {
      return new Promise((resolve, reject) => {
        // Never resolve on our own, just wait for the abort
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }) as any;

    expect(await client.createResponse(exampleResponse)).toBe(false);
  });
});
