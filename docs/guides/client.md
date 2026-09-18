# Using the World-Wide-Lab Client

A small package to make it easier to use the World-Wide-Lab API in your own study or to store some custom data in World-Wide-Lab. If you use one of the libraries with a supported integration package, you will most probably not need this package.

## Installation

You can install the package via npm:

```bash
npm install -S @world-wide-lab/client
```

## Example Usage

Whenever a person participates in your study, we call this a `Session`. Each `Session` needs to belong to a `Study`, which can be created in the World-Wide-Lab Admin UI.

```js
import { Client } from "@world-wide-lab/client";

const client = new Client({ url: "http://localhost:8787" });

// Start a new session
const session = await client.createSession({ studyId: "my-awesome-study" });

// Send responses to the API
session.response({
  name: "my-trial",
  payload: {
    some: "data",
  },
});

// ... collect many more responses via session.response()

// Mark the session as finished at the end of your experiment
session.finish();
```

### Participants

If you expect that participants take part in your studies multiple times or if you have multiple studies on your site, you can identify participants across studies using `participantId`s.

World-Wide-Lab does not do this by default to protect participant's privacy. To enable this feature, you will have to do two things: First, you'll need to tell World-Wide-Lab that you want to link your sessions to participants and second, you'll need to store the participant's id to identify them when they take part in another study. We strongly recommend to only store a participant's id after asking for their consent.

```js
import { Client } from "@world-wide-lab/client";

const client = new Client({
  url: "http://localhost:8787",
});

// Start a new session
const session = await client.createSession({
  studyId: "my-awesome-study",
  // Always link a participant to each session, if a participantId is stored
  // this will automatically be used
  linkParticipant: true,
});

// Ask the user for their consent to store their participantId
// (You probably want to do this in a fancier way than this)
const userConsented = confirm(
  "We can store an ID to recognize you if take part in other studies on this website. Are you OK with this?",
);
if (userConsented) {
  // Store the participant's id
  session.storeParticipantId();
}

// Send responses to the API
// Note that you can also send responses before storing the participantId
session.response({
  name: "my-trial",
  payload: {
    some: "data",
  },
});

// ... collect many more responses via session.response()

// Mark the session as finished at the end of your experiment
session.finish();
```

You can reference the participant-object of a session via `session.participant` and you can check whether a particpant_id is stored via:

```js
const participantId = await client.getStoredParticipantId();
```

### Updating Meta-Information

You can also add information to sessions and participants:

```js
session.setMetadata({
  // privateInfo is private and can normally not be retrieved via the client
  privateInfo: {
    performance: 100,
  },
  // publicInfo is public and can be retrieved via the client
  publicInfo: {
    highscoreBoardName: "JOHN",
  },
});

participant.setMetadata({
  // privateInfo is private and can normally not be retrieved via the client
  privateInfo: {
    email: "private@email.com",
  },
  // publicInfo is public and can be retrieved via the client
  publicInfo: {
    experimentCondition: "B",
  },
});

// you can also do
session.participant.setMetdata({
  // ...
});
```

### Retrieving Meta-Information

You can retrieve the publicInfo of a participant or session via the following:

```js
// Retrieving publicInfo for a participant
const participantPublicInfo = await participant.getPublicInfo();

// Retrieving publicInfo for a session
const sessionPublicInfo = await session.getPublicInfo();
```

## Reliable Response Uploading

Participants often take part in studies on shaky connections and servers can have hiccups. To avoid losing data, the client keeps every response in a queue until the World-Wide-Lab server has confirmed that it stored it. Responses which fail to upload are re-sent automatically, waiting a bit longer before every attempt (an exponential backoff) and logging what went wrong to the browser console.

This is enabled by default and responses are uploaded one after the other, so they are stored in the order in which they were collected. Since responses are only done once the server confirms them, awaiting one means that it has really been stored:

```js
// This resolves to true once the response has been stored and to false if it
// had to be given up on (e.g. when a participant is offline for a long time)
const stored = await session.response({
  name: "my-trial",
  payload: { some: "data" },
});
```

You usually do not want to await every single response, as this would slow down your experiment. Instead, you can wait for all of them at the end of your study, e.g. before re-directing participants somewhere else:

```js
// Wait for all responses to be stored
const everythingStored = await client.flushResponses();

// You can also check how many responses are still waiting to be uploaded
console.log(`${client.pendingResponses} response(s) left to upload`);

// Responses which had to be given up on are kept around, so you can inspect
// them (they have *not* been stored on the server)
console.log(client.failedResponses);
```

### Configuring the Queue

The behaviour of the queue can be adjusted when creating the client. All of these options are optional.

```js
const client = new Client({
  url: "http://localhost:8787",

  responseQueue: {
    // How often to try uploading a response before giving up (default: 10)
    maxAttempts: 10,
    // How long to wait before the first retry, in ms (default: 1000)
    initialDelay: 1000,
    // The maximum time to wait between two attempts, in ms (default: 30000)
    maxDelay: 30000,
    // By how much to multiply the delay after every failed attempt (default: 2)
    factor: 2,
    // Randomize delays, so not all participants retry at the same time
    // (default: true)
    jitter: true,
    // When to abort a request and try again, in ms (default: 30000)
    requestTimeout: 30000,
    // Try sending off remaining responses when the page is closed
    // (default: true)
    flushOnUnload: true,
    // Called whenever an attempt to upload a response failed, useful to
    // forward these events to your own error tracking
    onError: (info) => {
      console.log(info.response, info.attempt, info.willRetry);
    },
  },
});
```

To turn the queue off and send responses off without checking whether they arrived, set `responseQueue` to `false`.

```js
const client = new Client({
  url: "http://localhost:8787",
  responseQueue: false,
});
```

### Avoiding Duplicate Responses

When a response fails to upload, it is not always clear whether it actually failed: it may well have been stored, with only the server's confirmation getting lost on the way back. The client therefore gives every response a `clientResponseId`, counting up from 0 within its session. The server uses these ids to recognize responses it already stored, so a response which is sent twice is still only stored once.

These ids are also part of the data you download, where they provide a reliable ordering of the responses within each session.

## Advanced Usage

### Retrieving Participants or Sessions

Participants and sessions can also be directly created via their id, if you have stored it.

```js
import { Client, Participant, Session } from "@world-wide-lab/client";

const client = new Client({ url: "http://localhost:8787" });

const participant = new Participant(client, "ABCDE-12345-...");

const session = new Session(client, "ABCDE-12345-...");
```

### Creating a Participant Manually

If you want to create a new participant without retrieving one from a stored id, you can do so via the following code. Please note, however, that we usually recommend not to create a new participant for every new run-through or completion of an experiment, but to rather handle this via different sessions.

```js
const participant = await client.createParticipant();
```
