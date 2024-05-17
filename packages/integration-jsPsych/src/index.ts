/**
 * A helper package making it easy to use World-Wide-Lab in combination with {@link https://www.jspsych.org/ | jsPsych} experiments.
 *
 * @packageDocumentation
 */

import {
  type JsPsych,
  type JsPsychPlugin,
  ParameterType,
  type PluginInfo,
  type TrialType,
  initJsPsych,
} from "jspsych";

import { Client, type Session } from "@world-wide-lab/client";
import { VERSION } from "./version";

type SessionResponseOptions = Parameters<Session["response"]>[0];

type InitializeParameters = {};

type OnStartParameters = {};

type OnLoadParameters = {};

type OnFinishParameters = {};

/**
 * Options to pass to the {@link jsPsychWorldWideLab.setup} function.
 *
 * @public
 */
export type SetupOptions = {
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
   * use {@link jsPsychWorldWideLab.storeParticipantId}.
   */
  linkParticipant?: boolean;

  /**
   * Options to pass on to the Session creator. These can be used to store
   * both private and public information about the session.
   * Please note that sensitive data MUST only be stored under privateInfo,
   * as all publicInfo can be retrieved by anyone with the session's ID.
   *
   * Public info can be used to store non-sensitive information, such as
   * assignments to conditions.
   */
  sessionOptions?: {
    privateInfo?: object;
    publicInfo?: object;
  };
};

/**
 * Options which will be passed to {@link https://www.jspsych.org/7.0/reference/jspsych/#initjspsych | initJsPsych()}.
 * @see {@link https://www.jspsych.org/7.0/reference/jspsych/#initjspsych}
 *
 * @public
 */
export type JsPsychOptions = {
  [key: string]: any;
};

/**
 * A simple integration of World-Wide-Lab for jsPsych.
 * This plugin makes it easy to either automatically store data from any
 * experiment running in jsPsych, which can then be neatly downloaded via the
 * World-Wide-Lab UI.
 *
 * @see {@link https://github.com/world-wide-lab/world-wide-lab}
 * @public
 */
class jsPsychWorldWideLab implements JsPsychPlugin<PluginInfo> {
  // Classic portion of the plugin, a normal jsPsych plugin which will
  // store all previous (or one trial's) data in World-Wide-Lab.
  // Designed to mirror the Pipe-Plugin to allow easy switching between them.

  /**
   * Information about the integration. Only needed when using the Integration
   * as a trial.
   * @internal
   */
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
        default: undefined,
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

  /**
   * Trial function, which will automatically be called by JsPsych, when using
   * the plugin as a trial.
   * @param display_element - The element to display the trial on.
   * @param trial - The trial to run.
   * @internal
   */
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
        typeof trial.data_string === "string"
          ? JSON.parse(trial.data_string)
          : trial.data_string,
    });

    display_element.innerHTML = "";

    // Return at least some trial data
    const trial_data = {
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

  /**
   * World-Wide-Lab {@link @world-wide-lab/client#Client} instance.
   */
  public static client: Client;
  /**
   * The studyId of the Study in which the data should be stored
   */
  public static studyId: string;
  /**
   * The active {@link @world-wide-lab/client#Session} instance.
   */
  public static session: Session;
  /**
   * Whether the client has finished initializing and creating a
   * Session to store data.
   */
  public static ready = false;

  /**
   * Setup the World-Wide-Lab JsPsych Integration.
   *
   * Either this function or {@link jsPsychWorldWideLab.initJsPsych} must be
   * called before any data can be stored.
   *
   * @param options - Options to pass to the setup function.
   */
  public static async setup(options: SetupOptions): Promise<void> {
    if (jsPsychWorldWideLab.ready) {
      console.warn(
        "JsPsychWorldWideLab.setup() is being called more than once, this is not recommended and can lead to surprising issues.",
      );
      // Reset ready to false in case set
      jsPsychWorldWideLab.ready = false;
    }
    jsPsychWorldWideLab.client = new Client({
      url: options.url,
    });
    jsPsychWorldWideLab.client._library = "@world-wide-lab/integration-jspsych";
    jsPsychWorldWideLab.client._libraryVersion = VERSION;
    jsPsychWorldWideLab.studyId = options.studyId;

    jsPsychWorldWideLab.session =
      await jsPsychWorldWideLab.client.createSession({
        studyId: jsPsychWorldWideLab.studyId,
        linkParticipant: options.linkParticipant,
        ...options.sessionOptions,
      });
    jsPsychWorldWideLab.ready = true;
    jsPsychWorldWideLab.callSetupCompletedListeners();
    jsPsychWorldWideLab.sendQueuedResponses();
  }

  private static setupCompletedListeners: Array<Function> = [];
  private static callSetupCompletedListeners() {
    while (jsPsychWorldWideLab.setupCompletedListeners.length > 0) {
      const listener = jsPsychWorldWideLab.setupCompletedListeners.shift();
      listener();
    }
  }

  /**
   * Wait for setup to be completed. Note that this function does *not* call
   * the setup function, it just waits for it.
   *
   * @remarks
   * This function is useful if you want to ensure that  the client is ready
   * before proceeding.
   * @returns A promise that resolves when the client is ready.
   */
  public static async setupCompleted(): Promise<void> {
    return new Promise((resolve) => {
      // Register the promise's resolve function as a listener
      jsPsychWorldWideLab.setupCompletedListeners.push(resolve);

      // If already initialized, call listeners
      if (jsPsychWorldWideLab.ready) {
        jsPsychWorldWideLab.callSetupCompletedListeners();
      }
    });
  }

  /**
   * Initialize JsPsych with the World-Wide-Lab integration.
   *
   * @remarks
   * This function is a wrapper around
   * {@link https://www.jspsych.org/7.0/reference/jspsych/#initjspsych | initJsPsych()}.
   * It sets up the World-Wide-Lab integration and wraps the
   * on_trial_finish and on_finish functions to automatically save data.
   *
   * When using this function, you **must not** call
   * {@link jsPsychWorldWideLab.setup} separately,
   * this function already does this for you.
   *
   * @param jsPsychOptions - Options to pass to the JsPsych initialization function.
   * @param setupOptions - Options to pass to the World-Wide-Lab Integration setup function.
   * @returns The initialized JsPsych instance.
   */
  public static initJsPsych(
    jsPsychOptions: JsPsychOptions,
    setupOptions: SetupOptions,
  ): JsPsych {
    // Setup the JsPsychWorldWideLab-integration
    jsPsychWorldWideLab.setup(setupOptions);

    // Wrap on_trial_finish and on_finish functions to save data
    const originalOnTrialFinish = jsPsychOptions.on_trial_finish;
    jsPsychOptions.on_trial_finish = (data) => {
      jsPsychWorldWideLab.save(undefined, data);

      // Call the original function (if it exists)
      // biome-ignore lint/style/noArguments: we do want to use *all* arguments
      return originalOnTrialFinish?.(...arguments);
    };
    const originalOnFinish = jsPsychOptions.on_finish;
    jsPsychOptions.on_finish = () => {
      jsPsychWorldWideLab.onExperimentFinish();

      // Call the original function (if it exists)
      // biome-ignore lint/style/noArguments: we do want to use *all* arguments
      return originalOnFinish?.(...arguments);
    };

    // Initialize JsPsych
    return initJsPsych(jsPsychOptions);
  }

  private static responseQueue: SessionResponseOptions[] = [];
  /**
   * Save a response to World-Wide-Lab.
   * @param trialName - The name of the trial to store the data under.
   * @param data - The data to store.
   */
  public static async save(trialName: string, data: object) {
    const response: SessionResponseOptions = { name: trialName, payload: data };
    if (jsPsychWorldWideLab.ready) {
      await jsPsychWorldWideLab._saveResponse(response);
    } else {
      // Queue the response until we're ready
      jsPsychWorldWideLab.responseQueue.push(response);
    }
  }
  private static async sendQueuedResponses() {
    while (jsPsychWorldWideLab.responseQueue.length > 0) {
      const entry = jsPsychWorldWideLab.responseQueue.shift();
      await jsPsychWorldWideLab._saveResponse(entry);
    }
  }
  private static async _saveResponse(response: SessionResponseOptions) {
    await jsPsychWorldWideLab.session.response(response);
  }

  /**
   * Finish the experiment and mark the {@link @world-wide-lab/client#Session} as finished.
   */
  public static async onExperimentFinish() {
    await jsPsychWorldWideLab.session.finish();
  }

  private static checkReady() {
    if (!jsPsychWorldWideLab.ready) {
      console.error("Client is not yet initialized.");
    }
  }
  /**
   * Store the participant Id in the participant's browser.
   * Depending on the browser configuration, this is not always possible.
   * @see {@link jsPsychWorldWideLab.session.storeParticipantId}
   * @returns A boolean indicating whether the participant Id was stored.
   */
  public static async storeParticipantId() {
    await jsPsychWorldWideLab.setupCompleted();

    return jsPsychWorldWideLab.session.storeParticipantId();
  }
  /**
   * Delete the stored participant Id from the participant's browser
   * (if there is one).
   */
  public static async deleteStoredParticipantId() {
    await jsPsychWorldWideLab.setupCompleted();

    jsPsychWorldWideLab.client.deleteStoredParticipantId();
  }
  /**
   * Check whether the participant Id is stored in the participant's browser.
   * @returns A boolean if there is a stored participantId.
   */
  public static hasStoredParticpantId() {
    jsPsychWorldWideLab.checkReady();
    return jsPsychWorldWideLab.client.getStoredParticipantId() !== undefined;
  }
}

export default jsPsychWorldWideLab;
