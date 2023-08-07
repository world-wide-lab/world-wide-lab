import { initJsPsych } from 'jspsych'
import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response'
import { startTimeline, pressKey } from "@jspsych/test-utils";

import jsPsychWorldWideLab from '../src'

const url = 'https://non-existing-wwl-url/';

// Always in an URL, METHOD format
const MOCK_RESPONSES = {
  "v1/participant/": {
    "POST": {
      "participantId": "my-participant-id"
    }
  },
  "v1/run/": {
    "POST": {
      "runId": "my-run-id"
    }
  },
  "v1/run/finish": {
    "POST": {
      "success": true
    }
  },
  "v1/response/": {
    "POST": {
      "success": true
    }
  }
}

// @ts-ignore (typescript doesn't recognize the mock function)
global.fetch = jest.fn((fetchUrl: string, fetchOptions) => {
  // Mock just one option of using fetch

  const { method } = fetchOptions
  const endpoint = fetchUrl.replace(url, '')

  if (MOCK_RESPONSES?.[endpoint]?.[method]) {
    const data = MOCK_RESPONSES[endpoint][method]

    return Promise.resolve({
      json: () => Promise.resolve(data),
    })
  } else {
    const reason = `No mock response for "${endpoint}" "${method}"`
    console.warn(reason)
    return Promise.reject(reason)
  }
}) as jest.MockedFunction<typeof fetch>;

describe("jsPsychWorldWideLab with mocked fetch", () => {
  // Reset modules between each test (to clear the static variables in the plugin)
  beforeEach(() => {
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();
  });

  it("should correctly initialize with jsPsychWorldWideLab.setup()", async () => {
    await jsPsychWorldWideLab.setup({
      url,
      studyId: 'my-study',
    })
    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/participant/`,
      {"body": undefined, "headers": {"Content-Type": "none"}, "method": "POST"}
    )
    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/run/`,
      {
        "body": JSON.stringify({
          "participantId": "my-participant-id",
          "studyId": "my-study"
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();

    const jsPsych = initJsPsych({
      on_finish: () => {
        jsPsychWorldWideLab.onExperimentFinish()
      }
    });

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: 'Please press your favorite key on the keyboard.',
          on_finish: (data) => {
            // Fix timing variables
            expect(typeof data.rt).toBe('number')
            data.rt = 1;
            expect(typeof data.time_elapsed).toBe('number')
            data.time_elapsed = 123;

            // Save the data from this trial in World-Wide-Lab
            jsPsychWorldWideLab.save('trial-favorite-key', data)
          },
        }
      ],
      jsPsych
    )
    pressKey('a')

    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/response/`,
      {
        "body": JSON.stringify({
          "runId": "my-run-id",
          "payload": { "rt": 1, "stimulus": "Please press your favorite key on the keyboard.", "response": "a", "trial_type": "html-keyboard-response", "trial_index": 0, "time_elapsed": 123, "internal_node_id": "0.0-0.0" }
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/run/finish`,
      {
        "body": JSON.stringify({
          "runId": "my-run-id"
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
  });

  it("should correctly initialize with jsPsychWorldWideLab.initJsPsych()", async () => {
    const jsPsych = await jsPsychWorldWideLab.initJsPsych({}, {
      url,
      studyId: 'my-study',
    })

    // TODO: Re-think how we want to deal with participant-id caching, which should be optional and explicitly stated
    // expect(fetch).toHaveBeenCalledWith(
    //   `${url}v1/participant/`,
    //   {"body": undefined, "headers": {"Content-Type": "none"}, "method": "POST"}
    // )
    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/run/`,
      {
        "body": JSON.stringify({
          "participantId": "my-participant-id",
          "studyId": "my-study"
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
    // @ts-ignore (typescript doesn't recognize the mock function)
    fetch.mockClear();

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: 'Please press your favorite key on the keyboard.',
          on_finish: (data) => {
            // Save the data from this trial in World-Wide-Lab
            jsPsychWorldWideLab.save('trial-favorite-key', data)
          },
        }
      ],
      jsPsych
    )
    pressKey('a')

    const time_elapsed = jsPsych.data.getLastTrialData().values()[0].time_elapsed
    const rt = jsPsych.data.getLastTrialData().values()[0].rt

    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/response/`,
      {
        "body": JSON.stringify({
          "runId": "my-run-id",
          "payload": { "rt": rt, "stimulus": "Please press your favorite key on the keyboard.", "response": "a", "trial_type": "html-keyboard-response", "trial_index": 0, "time_elapsed": time_elapsed, "internal_node_id": "0.0-0.0" }
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )

    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/run/finish`,
      {
        "body": JSON.stringify({
          "runId": "my-run-id"
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
  });

  it("should correctly store data using the plugin", async () => {
    let resolveExperimentFinished;
    const experimentFinished = new Promise((resolve) => {
      resolveExperimentFinished = resolve;
    })
    const jsPsych = initJsPsych({
      on_finish: () => {
        resolveExperimentFinished();
      }
    });

    await startTimeline(
      [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: 'Please press your favorite key on the keyboard.',
        },
        {
          type: jsPsychWorldWideLab,
          url,
          studyId: 'plugin-study',
          data_string: () => jsPsych.data.get().json(),
        }
      ],
      jsPsych
    )
    pressKey('a')

    await experimentFinished;

    const time_elapsed = jsPsych.data.getDataByTimelineNode("0.0-0.0").values()[0].time_elapsed
    const rt = jsPsych.data.getDataByTimelineNode("0.0-0.0").values()[0].rt

    // TODO: Re-think how we want to deal with participant-id caching, which should be optional and explicitly stated
    // expect(fetch).toHaveBeenCalledWith(
    //   `${url}v1/participant/`,
    //   {"body": undefined, "headers": {"Content-Type": "none"}, "method": "POST"}
    // )
    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/run/`,
      {
        "body": JSON.stringify({
          "participantId": "my-participant-id",
          "studyId": "plugin-study"
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/response/`,
      {
        "body": JSON.stringify({
          "runId": "my-run-id",
          "payload": [
            { "rt": rt, "stimulus": "Please press your favorite key on the keyboard.", "response": "a", "trial_type": "html-keyboard-response", "trial_index": 0, "time_elapsed": time_elapsed, "internal_node_id": "0.0-0.0" }
          ]
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )

    expect(fetch).toHaveBeenCalledWith(
      `${url}v1/run/finish`,
      {
        "body": JSON.stringify({
          "runId": "my-run-id"
        }),
        "headers": {"Content-Type": "application/json"},
        "method": "POST"
      }
    )
  });
});
