# Leaderboards 🏆️

To make your studies more fun and boost recruitment, you can add leaderboards to your studies. These allow you to track scores and return top lists back to participants.

## Creating a Leaderboard

You will first need to create a leaderboard. This can be done through the World-Wide-Lab admin interface by going to `Leaderboard` > `Create New`.

## Adding Scores

Next up you will need to set up your study to send scores to the leaderboard.

Since all scores are linked to sessions, you can do this straight from the session object via the World-Wide-Lab Client.

When adding a new score, you will need to provide the leaderboard id and the score itself. If you want, you can also provide a name to show with the score. You can also provide a group name, that can then be used to aggregate scores.

One way we used this in the past was to have different countries as group names, allowing people to collect points for their country and see how their country is doing next to others.

```js
// Add a new score to the leaderboard 🏆️
session.addScoreToLeaderboard("my-awesome-leaderboardId", {
  // The score itself
  score: 100,
  // Optionally, some name(s) to associate with the score
  publicIndividualName: "Some individual name",
  publicGroupName: "Some group name",
})
```

## Getting Leaderboard Data

When getting data from the leaderboard you can do this directly from the client library. This will return the top scores for the leaderboard (by default).

```js
// Get leaderboard data
const leaderboardData = await client.getLeaderboardScores("my-awesome-leaderboardId");

// Do something with your leaderboard
console.log(leaderboardData);
```

You can also do more complicated things depending on what you want to show. Here are some examples.

```js
// Reverse the order of scores
const lowestScoresFirst = await client.getLeaderboardScores(
  "my-awesome-leaderboardId",
  "individual",
  { sort: "asc" }
);

// Get scores by group (without doing any aggregation)
const rawScoresByGroup = await client.getLeaderboardScores(
  "my-awesome-leaderboardId",
  "groups"
);

// Calculate the sum score for each group
const sumsByGroup = await client.getLeaderboardScores(
  "my-awesome-leaderboardId",
  "groups",
  { aggregate: "sum" }
);

// Get the sum score for the 3 groups with the smallest sum score
const lowestThreeSumsByGroup = await client.getLeaderboardScores(
  "my-awesome-leaderboardId",
  "groups",
  {
    aggregate: "sum",
    limit: 3,
    sort: "asc"
  }
);
```

You can see all available options in the API Reference for [Client.getleaderboardscores](/reference/client.client.getleaderboardscores.html).

## Example Code (in Context)

The code above already assumes that you have a session object, if you want to see it in a bit more context you can check out the code below, where it shown once with the jsPsych integration and once when just using the client library directly.

::: code-group

```js [integration-jspsych]
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
  {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "Please press any key to submit your score to the leaderboard.",
    on_finish: async () => {
      // Add a new score to the leaderboard 🏆️
      await jsPsychWorldWideLab.session.addScoreToLeaderboard("my-awesome-leaderboardId", {
        // The score itself
        score: 100,
        // Optionally, some name(s) to associate with the score
        publicIndividualName: "Some individual name",
        publicGroupName: "Some group name",
      });
    },
  },
];

jsPsych.run(timeline);
```

```js [client]
// Normal initialization of the client
import { Client } from "@world-wide-lab/client";

const client = new Client({ url: "http://localhost:8787" });

// Start a new session
const session = await client.createSession({ studyId: "my-awesome-study" });

// ✨ Your whole study goes in between here ✨

// Add a new score to the leaderboard 🏆️
await session.addScoreToLeaderboard("my-awesome-leaderboardId", {
  // The score itself
  score: 100,
  // Optionally, some name(s) to associate with the score
  // (these will be shown on the leaderboard!)
  publicIndividualName: "Some individual name",
  publicGroupName: "Some group name",
})
```

### Updating a Leaderboard Score

You can update a leaderboard score using the `updateLeaderboardScore` method in the `Session` class. This method requires the `leaderboardId`, `scoreId`, and the new `leaderboardScoreData`.

```js
const updated = await session.updateLeaderboardScore(
  "my-awesome-leaderboardId",
  "my-score-id",
  {
    // Score is required, names are optional
    score: 1500,
    publicIndividualName: "Updated Name",
    publicGroupName: "Updated Group",
  }
);

if (updated) {
  console.log("Leaderboard score updated successfully");
} else {
  console.log("Failed to update leaderboard score");
}
```