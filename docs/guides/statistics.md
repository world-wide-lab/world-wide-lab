# Statistics

World-Wide-Lab automatically computes a set of basic statistics about the data you have already collected. To see them, click **Statistics** in the sidebar of the admin UI.

There are two views: an **overview** of everything you have collected, and the **statistics of a single study**. Both are limited to a **timeframe**, which you can pick at the top of the page.

## Overview

![A screenshot of the statistics overview in World-Wide-Lab](/img/screenshots/generated/admin_pages_Statistics.png){.screenshot}

The overview covers all of your studies together:

- **Over Time**: how many sessions were started per day, how many of them were finished, and the share of finished sessions per day.

  A session only counts as finished once your study calls `session.finish()` at its end, which the [jsPsych integration](/guides/integration-jsPsych.md) does automatically. If your study never calls it, every session will show up as unfinished.

- **Studies**: how many sessions each study collected, how many of them were finished and how long a session took on average. A session's duration is measured from the moment it is started until its last response, since sessions do not have an explicit end, so sessions without any responses are not included in it.

  Every row has a small **Statistics** button, which opens the statistics of that study.

- **Participants** and **Recruitment**, as described below.

## Statistics of a Study

![A screenshot of the statistics of a single study in World-Wide-Lab](/img/screenshots/generated/admin_pages_Statistics_study.png){.screenshot}

The statistics of a single study show the same sessions over time, participants and recruitment for that study alone, plus how far participants get in it. You can reach them from the **Statistics** button in the overview's list of studies or via **View Statistics** in the `...` menu of the list of studies. A second dropdown at the top switches to another study, or back to the overview.

Your selection is kept in the address of the page, so you can bookmark or share the statistics of a particular study.

::: tip
The statistics are meant to give you a quick overview of your data. If you want to run your own analyses, you can always [download the full data](/guides/download-data.md) of a study.
:::

### Dropout

How many responses the sessions of the study contain. Since most studies store one response per trial or page, this shows how far participants get before they leave.

Finished and unfinished sessions are counted **separately**, each as a share of its own group. Unfinished sessions are the ones which were abandoned, while finished ones can still differ in length — for example when your study has several conditions or an optional part at the end — and mixing the two would hide both effects.

- **Sessions still going after n Responses** is the share of sessions with at least `n` responses. The steeper a curve drops, the earlier those participants left.
- **Responses per Session** shows how many sessions have exactly `n` responses.

## Participants

How often the same person takes part in your studies. This is only possible for sessions which are linked to a participant, which happens when you use the `linkParticipant` option of the [client](/guides/client.md) or the jsPsych integration. Sessions without a participant are not counted here.

Apart from how many sessions each participant takes part in, the page also shows how often participants moved from one study to another one, i.e. how often a participant's next session was in a different study than the one before. The overview additionally shows in how many different studies participants take part. In the statistics of a single study, all of this covers the participants of that study, and the moves to and from it.

## Recruitment

Where your participants came from, based on information the World-Wide-Lab client collects automatically whenever a session is started:

- **Source URL**: the address of the page your study ran on, without its [query string](https://developer.mozilla.org/en-US/docs/Glossary/Query_string).
- **Referrer**: the page participants clicked the link to your study on, taken from the [`Referer` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer) their browser sends. Participants who entered the address of your study directly are listed as `(none / direct)`.
- **Source Parameter**: the value of the `source`, `utm_source` or `ref` [query parameter](https://developer.mozilla.org/en-US/docs/Glossary/Query_string) of your study's address.

The source parameter is the most reliable of the three, since browsers often omit the referrer and many pages hide it on purpose. If you want to tell your recruitment channels apart, link to your study with a parameter of your choice, e.g. `https://my-study.org/?source=newsletter` for a link in your newsletter and `?source=twitter` for one you post on social media.

Sessions for which this information is missing, e.g. sessions created directly via the API, are counted as `(unknown)`.
