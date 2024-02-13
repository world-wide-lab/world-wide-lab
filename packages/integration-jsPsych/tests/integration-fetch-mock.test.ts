import { initJsPsych } from "jspsych";
import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import { startTimeline, pressKey } from "@jspsych/test-utils";

import jsPsychWorldWideLab from "../src";

const url = "https://non-existing-wwl-url/";

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

// @ts-ignore (typescript doesn't recognize the mock function)
global.fetch = jest.fn((fetchUrl: string, fetchOptions) => {
  // Mock just one option of using fetch

  const { method } = fetchOptions;
  const endpoint = fetchUrl.replace(url, "");

  if (MOCK_RESPONSES?.[endpoint]?.[method]) {
    const data = MOCK_RESPONSES[endpoint][method];

    return Promise.resolve({
      json: () => Promise.resolve(data),
    });
  } else {
    const reason = `No mock response for "${endpoint}" "${method}"`;
    console.warn(reason);
    return Promise.reject(reason);
  }
}) as jest.MockedFunction<typeof fetch>;

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
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
        privateInfo: {
          confidential: "shh",
        },
        publicInfo: {
          freelyAvailable: "hello",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
    await jsPsychWorldWideLab.setupCompleted();

    expect(fetch).toHaveBeenCalledTimes(2);

    expect(fetch).toHaveBeenCalledWith(`${url}v1/participant/`, {
      body: undefined,
      headers: { "Content-Type": "none" },
      method: "POST",
    });

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "my-study",
        participantId: "my-participant-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/finish`, {
      body: JSON.stringify({
        sessionId: "my-session-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    // Store the current participant ID
    jsPsychWorldWideLab.storeParticipantId();

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
    });
    expect(fetch).toHaveBeenCalledWith(`${url}v1/session/`, {
      body: JSON.stringify({
        studyId: "my-study",
        participantId: "my-participant-id",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });
});
