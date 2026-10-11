# Using World-Wide-Lab with jsPsych

This package provides a simple integration of World-Wide-Lab for [jsPsych](https://www.jspsych.org/). The package makes it easy to either automatically store all data from any experiment running in jsPsych or use it in a more fine-grained fashion to store exactly the data you want.

## Usage

There are multiple ways of using the jsPsych integration for World-Wide-Lab.

The easiest method is to use the plugin's `initJsPsych()` function, to create a jsPsych instance where the functions to save data are already attached. When using this method, data from every trial will be saved to World-Wide-Lab and the experiment will be marked as finished upon completion. This is the recommended method.

```js
import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import jsPsychWorldWideLab from "@world-wide-lab/integration-jspsych";

const jsPsych = jsPsychWorldWideLab.initJsPsych(
  {
    // Options to pass to the normal initJsPsych()
  },
  {
    // Options for the World-Wide-Lab Integration
    // URL to where World-Wide-Lab is running
    url: "https://localhost:8787",
    // Id of the study you're running
    studyId: "my-study",
  },
);

const timeline = [
  {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "Please press your favourite key on the keyboard.",
  },
];

jsPsych.run(timeline);
```

### Linking Participants

If you are running multiple studies on your website at once, you can link individual runs to a single participants across studies. To do this you will need to do two things: First, set `linkParticipants` to `true` which will link each run to a new created participant and second, you will need to call `jsPsychWorldWideLab.storeParticipantId()` to store the linked participant's id in the browser (this only needs to be done once per participant).

We don't automatically store participant Ids for privacy reasons and therefore recommend to always ask for consent before running `jsPsychWorldWideLab.storeParticipantId()`.

```js
import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import jsPsychHtmlButtonResponse from "@jspsych/plugin-html-button-response";
import jsPsychWorldWideLab from "@world-wide-lab/integration-jspsych";

const jsPsych = jsPsychWorldWideLab.initJsPsych(
  {
    // Options to pass to the normal initJsPsych()
  },
  {
    // Options for the World-Wide-Lab Integration
    url: "https://localhost:8787",
    studyId: "my-study",

    // Step 1: Link each run to a participant
    linkParticipants: true,
  },
);

const timeline = [
  {
    type: jsPsychHtmlButtonResponse,
    stimulus:
      "We support linking participants across studies on this website. Would you be ok if we store a randomly-generated identifier to match your data between the different studies on this website?",
    options: ["yes", "no"],
    // Step 2: Ask for consent and then store participant id
    on_finish: (data) => {
      if (data.response === "yes") {
        jsPsychWorldWideLab.storeParticipantId();
      } else {
        jsPsychWorldWideLab.deleteStoredParticipantId();
      }
    },
  },
  {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "Please press your favourite key on the keyboard.",
  },
];

jsPsych.run(timeline);
```

### Re-sending Failed Responses

Participants often take part in studies on shaky connections and servers can have hiccups. To avoid losing data, responses which failed to upload can be re-sent automatically, waiting a bit longer before every attempt (an exponential backoff) and logging what went wrong to the browser console.

This is turned off by default. Turn it on via the `responseQueue` option during setup, which also takes the options described in [the client's documentation](./client.md#configuring-re-sending).

```js
const jsPsych = jsPsychWorldWideLab.initJsPsych(
  {
    // Options for jsPsych
  },
  {
    url: "https://localhost:8787",
    studyId: "my-study",

    responseQueue: true,
  },
);
```

Re-sending happens in the background and never holds up your experiment, so a session can be marked as finished while a response is still on its way. If you want to show participants a "saving your data" screen at the end of your experiment, you can wait for these responses yourself:

```js
// Resolves to true once everything has been stored and to false if any
// response had to be given up on
const everythingStored = await jsPsychWorldWideLab.flush();

// You can also check how many responses are still being re-sent
console.log(`${jsPsychWorldWideLab.pendingResponses} response(s) left`);
```

### Advanced

Alternatively, you can separately initialze jsPsych and the jsPsychWorldWideLab plugin. This allows you to use the plugin's `save()` and `onExperimentFinish()` functions to save data to World-Wide-Lab in a more fine-grained manner. However, you will have to manually call `onExperimentFinish()` to mark the experiment as finished and `save()` to save data.

```js
import { initJsPsych } from "jsPsych";
import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import jsPsychWorldWideLab from "@world-wide-lab/integration-jspsych";

jsPsychWorldWideLab.setup({
  // URL to where World-Wide-Lab is running
  url: "https://localhost:8787",
  // Id of the study you're running
  studyId: "my-study",
});

const jsPsych = initJsPsych({
  on_finish: () => {
    jsPsychWorldWideLab.onExperimentFinish();
  },
});

const timeline = [
  {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "Please press your favourite key on the keyboard.",
    on_finish: (data) => {
      // Save the data from this trial in World-Wide-Lab
      jsPsychWorldWideLab.save(data);
    },
  },
];

jsPsych.run(timeline);
```

