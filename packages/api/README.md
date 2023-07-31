# World Wide Lab API

Example API Usage

```js
import { Api } from '@world-wide-lab/api';

const api = new Api({ url: 'http://localhost:8787' });

// Create a new participant or retrieve the current one, if a participant_id
// has been stored (by default this is done in a cookie)
const participant = await api.getParticipant();

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
  // privateInfo is private and can normally not be retrieved via the api
  privateInfo: {
    email: 'private@email.com'
  },
  // publicInfo is public and can be retrieved via the api
  publicInfo: {
    experimentCondition: 'B'
  }
})

run.setMetadata({
  // privateInfo is private and can normally not be retrieved via the api
  privateInfo: {
    performance: 100
  },
  // publicInfo is public and can be retrieved via the api
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
const participant = await api.getParticipant({ id: 'ABCDE-12345-...' });

const run = await api.getRun({ id: 'ABCDE-12345-...' });
```

When no id is provided and no participant_id is stored, a new participant will be created automatically. You can check whether a particpant_id is stored via:

```js
const participantId = await api.getStoredParticipantId();
```

### Creating a Participant Manually

If you want to create a new participant without retrieving one from a stored id, you can do so via the following code. Please note, however, that we usually recommend not to create a new participant for every new run-through or completion of an experiment, but to rather handle this via different runs.

```js
const participant = await api.createParticipant()
```
