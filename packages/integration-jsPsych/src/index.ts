import {
  initJsPsych,
  JsPsych,
  JsPsychPlugin,
  PluginInfo,
  ParameterType,
  TrialType,
} from "jspsych";

import { Client, Session, SessionResponseOptions } from "@world-wide-lab/client";

interface InitializeParameters {}

interface OnStartParameters {}

interface OnLoadParameters {}

interface OnFinishParameters {}

interface SetupOptions {
  /**
   * The URL of the World-Wide-Lab server, e.g. https://localhost:8787/
   */
  url: string;
  /**
   * The studyId of the experiment in which the data should be stored
   */
  studyId: string;
  /**
   * Whether to link each session with a participant.
   *
   * Note: If you want store identify participants between sessions, you should
   * use jsPsychWorldWideLab.storeParticipantId().
   */
  linkParticipant?: boolean;
}

// Configure our own JsPsychOptions type, as there is no official one yet
/**
 * Options which will be passed to initJsPsych().
 * @see {@link https://www.jspsych.org/7.0/reference/jspsych/#initjspsych}
 */
type JsPsychOptions = {
  [key: string]: any;
};

/**
 * A simple object with any data you would like to store.
 * Will be transformed to JSON.
 */
type ObjectWithData = {
  [key: string]: any;
};

/**
 * **JsPsychWorldWideLab**
 *
 * A simple integration of World-Wide-Lab for jsPsych.
 * This plugin makes it easy to either automatically store data from any
 * experiment running in jsPsych, which can then be neatly downloaded via the
 * World-Wide-Lab UI.
 *
 * @author Jan Simson
 * @see {@link https://DOCUMENTATION_URL DOCUMENTATION LINK TEXT}
 */
class jsPsychWorldWideLab implements JsPsychPlugin<PluginInfo> {
  // Classic portion of the plugin, a normal jsPsych plugin which will
  // store all previous (or one trial's) data in World-Wide-Lab.
  // Designed to mirror the Pipe-Plugin to allow easy switching between them.

  static info: PluginInfo = {
    name: "world-wide-lab",
    parameters: {
      /**
       * The URL of the World-Wide-Lab server, e.g. https://localhost:8787/
       */
      url: {
        type: ParameterType.STRING,
        default: undefined,
      },
      /**
       * The studyId of the experiment in which the data should be stored
       */
      studyId: {
        type: ParameterType.STRING,
        default: undefined,
      },

      /**
       * Name to identify this data by.
       *
       * When switching from the pipe plugin, you can use the `filename` here.
       */
      data_name: {
        type: ParameterType.STRING,
        default: undefined,
      },
      /**
       * String-based representation of the data to save.
       *
       * To save JSON, you can use `()=>jsPsych.data.get().json()`.
       * To save CSV, you can use `()=>jsPsych.data.get().csv()`.
       *
       * The use of a function is necessary to get the updated data at
       * the time of saving.
       */
      data_string: {
        type: ParameterType.STRING,
        default: null,
      },
      /**
       * Whether to mark the session as finished.
       */
      finish: {
        type: ParameterType.BOOL,
        default: true,
      },
    },
  };

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<PluginInfo>) {
    // Call async function in here
    this.run(display_element, trial);
  }

  private async run(
    display_element: HTMLElement,
    trial: TrialType<PluginInfo>,
  ) {
    // Setup client
    const setupPromise = jsPsychWorldWideLab.setup({
      url: trial.url,
      studyId: trial.studyId,
    });

    // Use styling of jsPsychPipe plugin for consistency
    // Show circular progress bar
    const progressCSS = `
      .spinner {
        animation: rotate 2s linear infinite;
        z-index: 2;
        position: absolute;
        top: 50%;
        left: 50%;
        margin: -25px 0 0 -25px;
        width: 50px;
        height: 50px;
      }

      .spinner .path {
        stroke: rgb(25,25,25);
        stroke-linecap: round;
        animation: dash 1.5s ease-in-out infinite;
      }

      @keyframes rotate {
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes dash {
        0% {
          stroke-dasharray: 1, 150;
          stroke-dashoffset: 0;
        }
        50% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -35;
        }
        100% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -124;
        }
      }
    `;

    const progressHTML = `
      <style>${progressCSS}</style>
      <svg class="spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>`;

    display_element.innerHTML = progressHTML;

    // Wait for the setup to finish
    await setupPromise;
    // Use the internal saveResponse function so we know for sure whether data
    // was saved correctly
    const success = await jsPsychWorldWideLab._saveResponse({
      name: trial.data_name,
      // TODO: find a more elegant solution here to mark data as already in JSON format, avoiding the back-and forth conversion
      payload:
        typeof trial.data_string == "string"
          ? JSON.parse(trial.data_string)
          : trial.data_string,
    });

    display_element.innerHTML = "";

    // Return at least some trial data
    var trial_data = {
      sessionId: jsPsychWorldWideLab.session.sessionId,
      success,
    };

    // Mark session as finished
    if (trial.finish) {
      await jsPsychWorldWideLab.onExperimentFinish();
    }

    // End the trial
    this.jsPsych.finishTrial(trial_data);
  }

  // Static portion of the plugin, more like a general library and just
  // exported via the plugin class for consistency with the jsPsych ecosystem

  public static client: Client;
  public static studyId: string;
  public static session: Session;
  public static ready: boolean = false;

  public static async setup(options: SetupOptions): Promise<void> {
    if (this.ready) {
      console.warn(
        "JsPsychWorldWideLab.setup() is being called more than once, this is not recommended and can lead to surprising issues.",
      );
      // Reset ready to false in case set
      this.ready = false;
    }
    this.client = new Client({
      url: options.url,
    });
    this.studyId = options.studyId;

    this.session = await this.client.createSession({
      studyId: this.studyId,
      linkParticipant: options.linkParticipant,
    });
    this.ready = true;
    this.callSetupCompletedListeners();
    this.sendQueuedResponses();
  }

  private static setupCompletedListeners: Array<Function> = [];
  private static callSetupCompletedListeners() {
    while (this.setupCompletedListeners.length > 0) {
      const listener = this.setupCompletedListeners.shift();
      listener();
    }
  }
  public static async setupCompleted(): Promise<void> {
    return new Promise((resolve) => {
      // Register the promise's resolve function as a listener
      this.setupCompletedListeners.push(resolve);

      // If already initialized, call listeners
      if (this.ready) {
        this.callSetupCompletedListeners();
      }
    });
  }

  public static initJsPsych(
    jsPsychOptions: JsPsychOptions,
    setupOptions: SetupOptions,
  ): JsPsych {
    // Setup the JsPsychWorldWideLab-integration
    this.setup(setupOptions);

    // Wrap on_trial_finish and on_finish functions to save data
    const originalOnTrialFinish = jsPsychOptions.on_trial_finish;
    jsPsychOptions.on_trial_finish = (data) => {
      this.save(undefined, data);

      // Call the original function (if it exists)
      return originalOnTrialFinish && originalOnTrialFinish(...arguments);
    };
    const originalOnFinish = jsPsychOptions.on_finish;
    jsPsychOptions.on_finish = () => {
      this.onExperimentFinish();

      // Call the original function (if it exists)
      return originalOnFinish && originalOnFinish(...arguments);
    };

    // Initialize JsPsych
    return initJsPsych(jsPsychOptions);
  }

  private static responseQueue: SessionResponseOptions[] = [];
  public static async save(trialName: string, data: ObjectWithData) {
    const response: SessionResponseOptions = { name: trialName, payload: data };
    if (this.ready) {
      await this._saveResponse(response);
    } else {
      // Queue the response until we're ready
      this.responseQueue.push(response);
    }
  }
  private static async sendQueuedResponses() {
    while (this.responseQueue.length > 0) {
      const entry = this.responseQueue.shift();
      await this._saveResponse(entry);
    }
  }
  private static async _saveResponse(response: SessionResponseOptions) {
    await this.session.response(response);
  }

  public static async onExperimentFinish() {
    await this.session.finish();
  }

  private static checkReady() {
    if (!this.ready) {
      console.error("Client is not yet initialized.");
    }
  }
  public static storeParticipantId() {
    this.checkReady();
    this.session.storeParticipantId();
  }
  public static deleteStoredParticipantId() {
    this.checkReady();
    this.client.deleteStoredParticipantId();
  }
  public static hasStoredParticpantId() {
    this.checkReady();
    return this.client.getStoredParticipantId() !== undefined;
  }
}

export default jsPsychWorldWideLab;
