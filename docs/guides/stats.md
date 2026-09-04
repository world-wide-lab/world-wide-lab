# Stats

World-Wide-Lab automatically computes a set of basic statistics about the data you have already collected. To see them, click **Stats** in the sidebar of the admin UI.

![A screenshot of the stats view in World-Wide-Lab](/img/screenshots/generated/admin_pages_Stats.png){.screenshot}

At the top of the page you can pick a **study** and a **timeframe**. The numbers at the top as well as the sessions over time, dropout and recruitment are then based on that study and timeframe. The comparison between studies and the statistics about participants always cover all of your data.

Your selection is kept in the address of the page, so you can bookmark or share the stats of a particular study. To jump straight to the stats of one study, open that study and click **View Stats for this Study** (the same option is available via the `...` menu in the list of studies).

::: tip
The stats are meant to give you a quick overview of your data. If you want to run your own analyses, you can always [download the full data](/guides/download-data.md) of a study.
:::

## Over Time

How many sessions were started per day and how many of them were finished, along with the share of finished sessions per day.

A session only counts as finished once your study calls `session.finish()` at its end, which the [jsPsych integration](/guides/integration-jsPsych.md) does automatically. If your study never calls it, every session will show up as unfinished.

## Studies

How many sessions each study has collected, how many of them were finished and how long a session took on average.

A session's duration is measured from the moment it is started until its last response, since sessions do not have an explicit end. Sessions without any responses can therefore not be timed and are not included in the mean duration.

## Dropout

How many responses the sessions of a study contain. Since most studies store one response per trial or page, this shows how far participants usually get before they drop out.

- **Sessions still going after n Responses** is the share of sessions with at least `n` responses. The steeper this curve drops, the earlier participants leave.
- **Number of Responses per Session** shows how many sessions have exactly `n` responses.

## Participants

How often the same person takes part in your studies. This is only possible for sessions which are linked to a participant, which happens when you use the `linkParticipant` option of the [client](/guides/client.md) or the jsPsych integration. Sessions without a participant are not counted here.

Apart from how many sessions and studies each participant takes part in, the page also shows how often participants moved from one study to another one, i.e. how often a participant's next session was in a different study than the one before.

## Recruitment

Where your participants came from, based on information the World-Wide-Lab client collects automatically whenever a session is started:

- **Source URL**: the address of the page your study ran on, without its [query string](https://developer.mozilla.org/en-US/docs/Glossary/Query_string).
- **Referrer**: the page participants clicked the link to your study on, taken from the [`Referer` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer) their browser sends. Participants who entered the address of your study directly are listed as `(none / direct)`.
- **Source Parameter**: the value of the `source`, `utm_source` or `ref` [query parameter](https://developer.mozilla.org/en-US/docs/Glossary/Query_string) of your study's address.

The source parameter is the most reliable of the three, since browsers often omit the referrer and many pages hide it on purpose. If you want to tell your recruitment channels apart, link to your study with a parameter of your choice, e.g. `https://my-study.org/?source=newsletter` for a link in your newsletter and `?source=twitter` for one you post on social media.

Sessions for which this information is missing, e.g. sessions created directly via the API, are counted as `(unknown)`.
