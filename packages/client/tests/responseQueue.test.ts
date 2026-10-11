import { Client } from "../src";

const URL = "https://example.wwl/";

interface FakeResponse {
  status: number;
  body?: object;
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
      // Keep tests fast, the delays are checked separately
      initialDelay: 1,
      maxDelay: 1,
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

describe("Responses", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation(() => {});
    }
  });

  it("should count clientResponseIds up, per session", async () => {
    const { calls } = mockFetch([OK]);
    // Ids should be set, no matter whether responses are re-sent or not
    const client = new Client({ url: URL });

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

  it("should not re-send responses by default", async () => {
    const { calls } = mockFetch([SERVER_ERROR]);
    const client = new Client({ url: URL });

    expect(await client.createResponse(exampleResponse)).toBe(false);
    expect(calls.length).toBe(1);
    expect(client.pendingResponses).toBe(0);
    expect(client.failedResponses.length).toBe(1);
  });

  it("should send responses off right away when re-sending is on", async () => {
    const { calls } = mockFetch([OK]);
    const client = createClient();

    expect(await client.createResponse(exampleResponse)).toBe(true);
    expect(calls.length).toBe(1);
    expect(client.pendingResponses).toBe(0);
  });

  it("should re-send a response until it is stored", async () => {
    const { calls } = mockFetch([
      new TypeError("Failed to fetch"),
      SERVER_ERROR,
      OK,
    ]);
    const client = createClient();

    // The first attempt failed, so the response is re-sent in the background
    expect(await client.createResponse(exampleResponse)).toBe(false);
    expect(await client.flushResponses()).toBe(true);

    expect(calls.length).toBe(3);
    // Re-sent responses should keep their id, so the server can recognize them
    expect(calls.map((call) => call.body.clientResponseId)).toEqual([0, 0, 0]);
    expect(client.failedResponses.length).toBe(0);
  });

  it("should re-send responses for any status code", async () => {
    const { calls } = mockFetch([{ status: 400 }, { status: 404 }, OK]);
    const client = createClient();

    await client.createResponse(exampleResponse);

    expect(await client.flushResponses()).toBe(true);
    expect(calls.length).toBe(3);
  });

  it("should give up after the maximum number of attempts", async () => {
    const { calls } = mockFetch([SERVER_ERROR]);
    const client = createClient({ maxAttempts: 3 });

    await client.createResponse(exampleResponse);

    expect(await client.flushResponses()).toBe(false);
    expect(calls.length).toBe(3);
    expect(client.failedResponses.length).toBe(1);
    expect(client.failedResponses[0].name).toBe("my-trial");
    expect(console.error).toHaveBeenCalled();
  });

  it("should not hold up other responses while re-sending", async () => {
    // Only the very first request fails
    const { calls } = mockFetch([SERVER_ERROR, OK]);
    const client = createClient();

    const failing = client.createResponse({
      ...exampleResponse,
      name: "failing",
    });
    expect(await failing).toBe(false);

    // The failing response is still being re-sent, which should not stop us
    // from storing the next one
    expect(client.pendingResponses).toBe(1);
    expect(
      await client.createResponse({ ...exampleResponse, name: "next" }),
    ).toBe(true);

    expect(await client.flushResponses()).toBe(true);
  });

  it("should treat a duplicate as a success when re-sending", async () => {
    const { calls } = mockFetch([SERVER_ERROR, DUPLICATE]);
    const client = createClient();

    await client.createResponse(exampleResponse);

    expect(await client.flushResponses()).toBe(true);
    expect(calls.length).toBe(2);
    expect(client.failedResponses.length).toBe(0);
  });

  it("should jump ahead when an id is already in use", async () => {
    // This happens when another client is using the same session and has
    // already used the id we picked.
    const { calls } = mockFetch([DUPLICATE, OK]);
    const client = new Client({ url: URL });

    expect(await client.createResponse(exampleResponse)).toBe(true);
    // The new id should be far away from the old one, to make the collision
    // obvious in the data
    expect(calls.map((call) => call.body.clientResponseId)).toEqual([0, 1000]);
    expect(console.warn).toHaveBeenCalled();

    // Ids should keep counting up from the new one
    await client.createResponse(exampleResponse);
    expect(calls[2].body.clientResponseId).toBe(1001);
  });

  it("should give up when all of its ids are already in use", async () => {
    // Every id we try is already taken, which should not happen in practice
    const { calls } = mockFetch([DUPLICATE]);
    const client = new Client({ url: URL });

    expect(await client.createResponse(exampleResponse)).toBe(false);
    // The first attempt plus one for every re-assigned id
    expect(calls.length).toBe(6);
    expect(calls.map((call) => call.body.clientResponseId)).toEqual([
      0, 1000, 2000, 3000, 4000, 5000,
    ]);
  });

  it("should report how many responses are being re-sent", async () => {
    mockFetch([SERVER_ERROR, OK]);
    const client = createClient();

    await client.createResponse(exampleResponse);
    expect(client.pendingResponses).toBe(1);

    await client.flushResponses();
    expect(client.pendingResponses).toBe(0);
  });

  it("should resolve flushes when there is nothing to re-send", async () => {
    mockFetch([OK]);
    const client = createClient();

    expect(await client.flushResponses()).toBe(true);
  });

  it("should resolve flushes when re-sending is turned off", async () => {
    mockFetch([SERVER_ERROR]);
    const client = new Client({ url: URL });

    await client.createResponse(exampleResponse);

    expect(await client.flushResponses()).toBe(true);
  });

  it("should call onError for every failed attempt", async () => {
    mockFetch([SERVER_ERROR]);
    const onError = vi.fn();
    const client = createClient({ maxAttempts: 2, onError });

    await client.createResponse(exampleResponse);
    await client.flushResponses();

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
    });

    await client.createResponse(exampleResponse);
    await client.flushResponses();

    // Delays are randomized between 50% and 100% of their actual value, so
    // that not all participants retry at the same time
    expect(delays.length).toBe(4);
    for (const [i, expected] of [1000, 2000, 4000, 4000].entries()) {
      expect(delays[i]).toBeGreaterThanOrEqual(expected / 2);
      expect(delays[i]).toBeLessThanOrEqual(expected);
    }
  });

  it("should abort requests which take too long", async () => {
    const client = new Client({ url: URL, requestTimeout: 5 });

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
