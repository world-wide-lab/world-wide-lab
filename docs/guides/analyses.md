# Analyses

World-Wide-Lab automatically computes a set of basic analyses of the data that has already been collected. To see them, click **Analyses** in the sidebar of the admin UI.

![A screenshot of the analyses view in World-Wide-Lab](/img/screenshots/generated/admin_pages_Analyses.png){.screenshot}

At the top of the page you can pick a **study** and a **timeframe**. Analyses of sessions over time, dropout and recruitment are limited to the study and timeframe you selected. Comparisons between studies and the analyses of participants always cover all studies.

::: tip
The analyses are meant to give you a quick overview of your data. If you want to run your own analyses, you can always [download the full data](/guides/download-data.md) of a study.
:::

## Sessions over Time

The number of sessions which have been started and finished per day, along with the share of sessions which have been finished on each day.

A session is only counted as finished if your study calls `session.finish()` at its end, which the [jsPsych integration](/guides/integration-jsPsych.md) does automatically. If your study never calls it, every session will show up as unfinished.

## Completion between Studies

How many sessions each study has, how many of them have been finished and how long they took on average.

The duration of a session is measured from the moment it is started until its last response, since sessions do not have an explicit end. Sessions without any responses can therefore not be timed and are not included in the mean duration.

## Dropout

How many responses the sessions of a study contain. Since most studies store one response per part of the study, this shows how far participants tend to get before they drop out.

- **Sessions still going after n Responses** shows the share of sessions which have at least `n` responses. The steeper this curve drops, the more participants leave early.
- **Number of Responses per Session** shows how many sessions have exactly `n` responses.

## Participants

How often participants take part in your studies. This requires sessions to be linked to a participant, which happens when you use the `linkParticipant` option of the [client](/guides/client.md) or the jsPsych integration. Sessions without a participant are not included here.

Apart from how many sessions and studies each participant takes part in, the page also shows how often participants moved from one study to another one, i.e. how often a participant's next session was in a different study than the one before.

## Recruitment

Where the sessions of a study are coming from, based on the information that is collected automatically when a session is started:

- **Source URL**: the page a study has been running on, without any query parameters.
- **Referrer**: the website participants visited before they started a session. Sessions without a referrer, e.g. because participants entered the address directly, are listed as `(none / direct)`.
- **Source Parameter**: the value of the `source`, `utm_source` or `ref` parameter in the URL of a study. You can use this to compare different recruitment channels by linking to your study with e.g. `https://my-study.org/?source=newsletter`.

This information is only available for sessions which have been started via the World-Wide-Lab client. Sessions created directly via the API are listed as `(unknown)`.
