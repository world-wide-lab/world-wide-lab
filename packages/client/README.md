<p align="center">
  <img alt="The World-Wide-Lab Logo" src="../../img/logo.svg" width="60%">
</p>

# World-Wide-Lab: Client

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
