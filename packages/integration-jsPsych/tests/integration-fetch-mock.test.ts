import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import { pressKey, startTimeline } from "@jspsych/test-utils";
import { VERSION as clientVersion } from "@world-wide-lab/client";
import { initJsPsych } from "jspsych";

import { version } from "../package.json";
import jsPsychWorldWideLab from "../src";

const url = "http://non-existing-wwl-url/";

// Always in an URL, METHOD format
const MOCK_RESPONSES = {
  "v1/participant/": {
    POST: {
      participantId: "my-participant-id",
    },
  },
  "v1/session/": {
    POST: {
      sessionId: "my-session-id",
    },
  },
  "v1/session/finish": {
    POST: {
      success: true,
    },
  },
  "v1/response/": {
    POST: {
      success: true,
    },
  },
};

const clientMetadata = {
  version: clientVersion,
  library: "@world-wide-lab/integration-jspsych",
  libraryVersion: version,
  url: "http://localhost/",
  navigator: {
    language: "en-US",
    languages: ["en-US", "en"],
  },
};

// @ts-ignore (typescript doesn't recognize the mock function)
global.fetch = jest.fn((fetchUrl: string, fetchOptions) => {
  // Mock just one option of using fetch

  const { method } = fetchOptions;
  const endpoint = fetchUrl.replace(url, "");

  if (MOCK_RESPONSES?.[endpoint]?.[method]) {
    const data = MOCK_RESPONSES[endpoint][method];

    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve(data),
    });
  }
  const reason = `No mock response for "${endpoint}" "${method}"`;
  console.warn(reason);
  return Promise.reject(reason);
}) as jest.MockedFunction<typeof fetch>;

function getFetchCalls(endpoint: string): Array<[string, any]> {
  // @ts-ignore (typescript doesn't recognize the mock function)
  return (fetch.mock.calls as Array<[string, any]>).filter((call) =>
    String(call[0]).includes(endpoint),
  );
}

/**
 * Wait for requests to a given endpoint to be made. Responses are only
 * considered stored once the server confirms them, so some requests (e.g.
 * finishing a session) are only sent a few ticks after the experiment is done.
 */
async function waitForFetchCalls(
  endpoint: string,
  nCalls = 1,
  timeoutMs = 1000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getFetchCalls(endpoint).length >= nCalls) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(
    `Less than ${nCalls} request(s) to "${endpoint}" were made within ${timeoutMs}ms.`,
  );
}

/** Make the next n attempts at storing a response fail, returns a reset fn */
function failNextResponses(nFailures: number): () => void {
  // @ts-ignore (typescript doesn't recognize the mock function)
  const workingFetch = fetch.getMockImplementation();
  let failuresLeft = nFailures;
  // @ts-ignore (typescript doesn't recognize the mock function)
  fetch.mockImplementation((fetchUrl: string, fetchOptions) => {
    if (String(fetchUrl).includes("v1/response/") && failuresLeft > 0) {
      failuresLeft--;
      return Promise.resolve({ status: 500, json: () => Promise.resolve({}) });
    }
    return workingFetch(fetchUrl, fetchOptions);
  });
  // @ts-ignore (typescript doesn't recognize the mock function)
  return () => fetch.mockImplementation(workingFetch);
}

// Retry without waiting around in tests
const FAST_RETRIES = { initialDelay: 1, maxDelay: 1, jitter: false };

function resetJsPsychWorldWideLab() {
  // Reset the jsPsychWorldWideLab-Plugin state
  jsPsychWorldWideLab.ready = false;
  jsPsychWorldWideLab.client = undefined;
  jsPsychWorldWideLab.session = undefined;
  jsPsychWorldWideLab.studyId = "reset-in-beforeEach";
}

describe("jsPsychWorldWideLab with mocked fetch", () => {
  beforeEach(() => {
    resetJsPsychWorldWideLab();

    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();
  });

  it("should correctly initialize with jsPsychWorldWideLab.setup()", async () => {
    await jsPsychWorldWideLab.setup({
      url,
      studyId: "my-study",
    });
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "my-study",
        clientMetadata,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();

    const jsPsych = initJsPsych({
      on_finish: () => {
        jsPsychWorldWideLab.onExperimentFinish();
      },
    });

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: "Please press your favorite key on the keyboard.",
          on_finish: (data) => {
            // Fix timing variables
            expect(typeof data.rt).toBe("number");
            data.rt = 1;
            expect(typeof data.time_elapsed).toBe("number");
            data.time_elapsed = 123;

            // Save the data from this trial in World-Wide-Lab
            jsPsychWorldWideLab.save("trial-favorite-key", data);
          },
        },
      ],
      jsPsych,
    );
    pressKey("a");

    expect(fetch).toHaveBeenCalledWith(`${url}v1/response/`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
        name: "trial-favorite-key",
        payload: {
          rt: 1,
          stimulus: "Please press your favorite key on the keyboard.",
          response: "a",
          trial_type: "html-keyboard-response",
          trial_index: 0,
          time_elapsed: 123,
          internal_node_id: "0.0-0.0",
        },
        // The client counts these up, so responses can be de-duplicated
        clientResponseId: 0,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
    await waitForFetchCalls("v1/session/finish");
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("should correctly initialize with jsPsychWorldWideLab.initJsPsych()", async () => {
    const jsPsych = await jsPsychWorldWideLab.initJsPsych(
      {},
      {
        url,
        studyId: "my-study",
        sessionOptions: {
          privateInfo: {
            confidential: "shh",
          },
          publicInfo: {
            freelyAvailable: "hello",
          },
        },
      },
    );

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "my-study",
        clientMetadata,
        privateInfo: {
          confidential: "shh",
        },
        publicInfo: {
          freelyAvailable: "hello",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: "Please press your favorite key on the keyboard.",
          on_finish: (data) => {
            // Save the data from this trial in World-Wide-Lab
            jsPsychWorldWideLab.save("trial-favorite-key", data);
          },
        },
      ],
      jsPsych,
    );
    pressKey("a");

    const time_elapsed = jsPsych.data
      .getLastTrialData()
      .values()[0].time_elapsed;
    const rt = jsPsych.data.getLastTrialData().values()[0].rt;

    // Responses are uploaded one after the other, the second one only starts
    // once the first has been stored.
    await waitForFetchCalls("v1/response/", 2);

    expect(fetch).toHaveBeenCalledWith(`${url}v1/response/`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
        payload: {
          rt: rt,
          stimulus: "Please press your favorite key on the keyboard.",
          response: "a",
          trial_type: "html-keyboard-response",
          trial_index: 0,
          time_elapsed: time_elapsed,
          internal_node_id: "0.0-0.0",
        },
        // The client counts these up, so responses can be de-duplicated.
        // This is the second response, as the trial's own on_finish saves
        // its data before the wrapper around on_trial_finish does.
        clientResponseId: 1,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });

    await waitForFetchCalls("v1/session/finish");
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("should correctly store data using the plugin", async () => {
    let resolveExperimentFinished;
    const experimentFinished = new Promise((resolve) => {
      resolveExperimentFinished = resolve;
    });
    const jsPsych = initJsPsych({
      on_finish: () => {
        resolveExperimentFinished();
      },
    });

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: "Please press your favorite key on the keyboard.",
        },
        {
          type: jsPsychWorldWideLab,
          url,
          studyId: "plugin-study",
          data_name: "trial-favorite-key",
          data_string: () => jsPsych.data.get().json(),
        },
      ],
      jsPsych,
    );
    pressKey("a");

    await experimentFinished;

    const time_elapsed = jsPsych.data
      .getDataByTimelineNode("0.0-0.0")
      .values()[0].time_elapsed;
    const rt = jsPsych.data.getDataByTimelineNode("0.0-0.0").values()[0].rt;

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "plugin-study",
        clientMetadata,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
    expect(fetch).toHaveBeenCalledWith(`${url}v1/response/`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
        name: "trial-favorite-key",
        payload: [
          {
            rt: rt,
            stimulus: "Please press your favorite key on the keyboard.",
            response: "a",
            trial_type: "html-keyboard-response",
            trial_index: 0,
            time_elapsed: time_elapsed,
            internal_node_id: "0.0-0.0",
          },
        ],
        // The client counts these up, so responses can be de-duplicated
        clientResponseId: 0,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });

    await waitForFetchCalls("v1/session/finish");
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("should support linking participants", async () => {
    const jsPsych = jsPsychWorldWideLab.initJsPsych(
      {},
      {
        url,
        studyId: "my-study",
        linkParticipant: true,
      },
    );

    // Store the current participant ID
    await jsPsychWorldWideLab.storeParticipantId();

    await jsPsychWorldWideLab.setupCompleted();

    expect(fetch).toHaveBeenCalledTimes(2);

    expect(fetch).toHaveBeenCalledWith(`${url}v1/participant/`, {
      body: undefined,
      headers: { "Content-Type": "none" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "my-study",
        clientMetadata,
        participantId: "my-participant-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: "Please press your favorite key on the keyboard.",
          on_finish: (data) => {
            // Save the data from this trial in World-Wide-Lab
            jsPsychWorldWideLab.save("trial-favorite-key", data);
          },
        },
      ],
      jsPsych,
    );
    pressKey("a");

    const time_elapsed = jsPsych.data
      .getLastTrialData()
      .values()[0].time_elapsed;
    const rt = jsPsych.data.getLastTrialData().values()[0].rt;

    // Responses are uploaded one after the other, the second one only starts
    // once the first has been stored.
    await waitForFetchCalls("v1/response/", 2);

    expect(fetch).toHaveBeenCalledWith(`${url}v1/response/`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
        payload: {
          rt: rt,
          stimulus: "Please press your favorite key on the keyboard.",
          response: "a",
          trial_type: "html-keyboard-response",
          trial_index: 0,
          time_elapsed: time_elapsed,
          internal_node_id: "0.0-0.0",
        },
        // The client counts these up, so responses can be de-duplicated.
        // This is the second response, as the trial's own on_finish saves
        // its data before the wrapper around on_trial_finish does.
        clientResponseId: 1,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });

    await waitForFetchCalls("v1/session/finish");
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });

    // Reset state
    resetJsPsychWorldWideLab();
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();

    const jsPsych2 = await jsPsychWorldWideLab.initJsPsych(
      {},
      {
        url,
        studyId: "my-study",
        linkParticipant: true,
      },
    );

    // There shouldn't have been another call to create a participant, since the ID should be cached
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalledWith(`${url}v1/participant/`, {
      body: undefined,
      headers: { "Content-Type": "none" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "my-study",
        clientMetadata,
        participantId: "my-participant-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("should re-send responses which failed to upload", async () => {
    const resetFetch = failNextResponses(2);

    try {
      const jsPsych = await jsPsychWorldWideLab.initJsPsych(
        {},
        { url, studyId: "my-study", responseQueue: FAST_RETRIES },
      );

      await startTimeline(
        [
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: "Please press your favorite key on the keyboard.",
          },
        ],
        jsPsych,
      );
      pressKey("a");

      // The response should be sent three times in total, always with the
      // same id, so the server can recognize the re-sent ones.
      await waitForFetchCalls("v1/response/", 3);
      expect(await jsPsychWorldWideLab.flush()).toBe(true);

      const responseCalls = getFetchCalls("v1/response/");
      expect(responseCalls.length).toBe(3);
      for (const call of responseCalls) {
        expect(JSON.parse(call[1].body).clientResponseId).toBe(0);
      }
    } finally {
      resetFetch();
    }
  });

  it("should not let a failing response hold up the experiment", async () => {
    // The response fails and is re-sent in the background, which should not
    // stop the experiment from finishing.
    const resetFetch = failNextResponses(1);

    try {
      const jsPsych = await jsPsychWorldWideLab.initJsPsych(
        {},
        {
          url,
          studyId: "my-study",
          // Wait long enough that the response is definitely still being
          // re-sent when the experiment finishes
          responseQueue: { initialDelay: 300, maxDelay: 300 },
        },
      );

      await startTimeline(
        [
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: "Please press your favorite key on the keyboard.",
          },
        ],
        jsPsych,
      );
      pressKey("a");

      // Wait for the response to be re-sent successfully
      await waitForFetchCalls("v1/response/", 2);
      expect(await jsPsychWorldWideLab.flush()).toBe(true);
      expect(jsPsychWorldWideLab.pendingResponses).toBe(0);

      // The session should have been finished before that, rather than
      // waiting for the response to make it
      const calledEndpoints = getFetchCalls("v1/").map((call) =>
        String(call[0]).replace(url, ""),
      );
      expect(calledEndpoints.indexOf("v1/session/finish")).toBeLessThan(
        calledEndpoints.lastIndexOf("v1/response/"),
      );
    } finally {
      resetFetch();
    }
  });
});
