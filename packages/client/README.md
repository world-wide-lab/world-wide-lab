<p align="center">
  <img alt="The World-Wide-Lab Logo" src="../server/static/logo.svg" width="60%">
</p>

# World-Wide-Lab: Client

A small package to make it easier to use the World-Wide-Lab API in your own study or to store some custom data in World-Wide-Lab. If you use one of the libraries with a supported integration package, you will most probably not need this package.

## Installation

You can install the package via npm:

```bash
npm install -S @world-wide-lab/client
```

## Example Usage

```js
import { Client } from '@world-wide-lab/client';

const client = new Client({ url: 'http://localhost:8787' });

// Create a new participant or retrieve the current one, if a participant_id
// has been stored (by default this is done in localStorage)
const participant = await client.getParticipant();

// Start a new run for this participant
const run = await participant.startRun();

// Collect responses and send them to the API
run.response({
  payload: {
    some: 'data'
  }
})

// ... collect many more responses via run.response()

// Mark the run as finished at the end of your experiment
run.finish();
```

### Updating Meta-Information

You can also update information about runs and participants:

```js
participant.setMetadata({
  // privateInfo is private and can normally not be retrieved via the client
  privateInfo: {
    email: 'private@email.com'
  },
  // publicInfo is public and can be retrieved via the client
  publicInfo: {
    experimentCondition: 'B'
  }
})

run.setMetadata({
  // privateInfo is private and can normally not be retrieved via the client
  privateInfo: {
    performance: 100
  },
  // publicInfo is public and can be retrieved via the client
  publicInfo: {
    highscoreBoardName: 'JOHN'
  }
})
```

### Retrieving Meta-Information

You can retrieve the publicInfo of a participant or run via the following:

```js
// Retrieving publicInfo for a participant
const participantPublicInfo = await participant.getPublicInfo()

// Retrieving publicInfo for a run
const runPublicInfo = await run.getPublicInfo()
```

### Retrieving Participants or Runs

Participants and runs can be retrieved via their id:

```js
const participant = await client.getParticipant({ id: 'ABCDE-12345-...' });

const run = await client.getRun({ id: 'ABCDE-12345-...' });
```

When no id is provided and no participant_id is stored, a new participant will be created automatically. You can check whether a particpant_id is stored via:

```js
const participantId = await client.getStoredParticipantId();
```

### Creating a Participant Manually

If you want to create a new participant without retrieving one from a stored id, you can do so via the following code. Please note, however, that we usually recommend not to create a new participant for every new run-through or completion of an experiment, but to rather handle this via different runs.

```js
const participant = await client.createParticipant()
```
