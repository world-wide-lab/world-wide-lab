# Items 🎨

Sometimes what participants produce is the most interesting material a study
has, and you want to show it to the *next* participant. Items are how
World-Wide-Lab does that: a participant contributes something to a **pool**,
and other participants **draw** items back out of it.

The same two moves cover a lot of ground:

- **Transmission chains** — each participant sees what the last one produced, reproduces it, and passes their version on.
- **Peer ratings** — participants write captions, arguments or explanations in one phase and rate each other's in the next.
- **Galleries** — a wall of "here is what other people said", which is also a nice recruitment device.
- **Asynchronous social games** — a participant plays against a past participant's recorded move.
- **Crowd annotation** — you seed the items and participants label them, with each item retiring after enough labels.

::: warning
Whatever you put in an item's payload is shown to strangers. Treat it like
anything else you publish, and read [Moderation](#moderation) before you let
participants contribute freely.
:::

## Creating a Pool

Pools are created in the admin interface under `Item Pools` > `Create New`,
the same way leaderboards are. A pool needs an id, and can optionally be tied
to a single study — leave the study empty to share the pool across all of your
studies.

If you would rather not click, the `CREATE_ITEM_POOLS` environment variable
creates pools on startup (see [Configuring the Server](./configuration)).

## Contributing Items

Items are contributed from a session, so that World-Wide-Lab knows who
produced what and can keep people from being shown their own work.

```js
// Contribute something a participant made 🎨
const item = await session.contributeItem("my-awesome-pool", {
  // This is what other participants will see
  publicPayload: { drawing: svg },
});
```

If the contribution is also study data — and it usually is — you can store
both in one call. The response is written first and the item then points back
at it, so your analysis can go from the item to the trial it came from.

```js
const item = await session.contributeItem("my-awesome-pool", {
  publicPayload: { drawing: svg },
  response: { name: "draw-trial", payload: { drawing: svg, rt: 1234 } },
});
```

## Drawing Items

Drawing hands items to a participant *and* records that they were shown, which
is what makes serving limits and "don't show me this twice" work.

```js
// Draw a single item 🎲
const [draw] = await session.drawItems("my-awesome-pool");

if (draw === undefined) {
  // The pool has run out of items matching your query — always handle this,
  // it happens at the start of a study and at the end of a long one.
} else {
  showToParticipant(draw.publicPayload);
}
```

A draw comes back with a `drawId`, the `itemId`, the `publicPayload`, and the
item's `generation` and `parentItemId`. It never contains anything about the
participant who contributed it.

### Choosing what to draw

| Option | What it does | Default |
| --- | --- | --- |
| `count` | How many items to draw at once | `1` |
| `policy` | `random`, `least-drawn`, `newest` or `oldest` | `random` |
| `excludeOwn` | Skip items this participant contributed, in this or any of their other sessions | `true` |
| `excludeSeen` | Skip items this session has already been shown | `true` |
| `maxDrawsPerItem` | Only draw items served fewer than this many times | _no limit_ |
| `maxCompletionsPerItem` | Only draw items completed fewer than this many times | _no limit_ |
| `maxChildrenPerItem` | Only draw items that fewer than this many items have been contributed as a continuation of (see [Building a Chain](#building-a-chain)) | _no limit_ |
| `minGeneration` / `maxGeneration` | Only draw items within this part of a chain | _no limit_ |

`least-drawn` is the one to reach for most of the time: it spreads
participants evenly over the pool, which is what balanced ratings need and
what hands out the freshest tip of a chain first.

```js
const draws = await session.drawItems("my-awesome-pool", {
  count: 5,
  policy: "least-drawn",
  // Stop showing a caption once ten people have rated it
  maxCompletionsPerItem: 10,
});
```

::: tip
A draw counts the moment it is served and is never given back, so a
participant who closes their tab keeps their draw forever. With
`maxDrawsPerItem: 1` an abandoned tab takes that item out of circulation for
good. For chains, use `maxChildrenPerItem` instead (see
[Building a Chain](#building-a-chain)).
:::

::: warning Caps on completions and children are approximate
`maxDrawsPerItem` is exact, because a draw counts the moment it is handed out.
`maxCompletionsPerItem` and `maxChildrenPerItem` can only count what has
already happened, though, and participants who drew an item but have not
finished with it yet do not show up there. If ten participants draw at the
same time, all of them can be handed an item that has 9 of its 10
completions, which ends up with 19. The same goes for a chain link that two
participants draw before either has continued it: the chain branches.

How much this matters depends on how many participants are active at once. If
it has to be exact, add `maxDrawsPerItem` as a hard ceiling, e.g.
`maxCompletionsPerItem: 10` together with `maxDrawsPerItem: 12`, and accept
that an abandoned draw can then cost an item one of its completions. For
chains, `policy: "least-drawn"` spreads simultaneous participants across
different links, which keeps branching rare as long as there are more links
than participants active at the same time.
:::

## Reacting to an Item

Pass the `drawId` along with the response the participant produced. That links
the response to what they were reacting to and marks the draw as completed, in
one call.

```js
await session.response({
  name: "guess",
  payload: { guess },
  drawId: draw.drawId,
});
```

If a single drawn item produces several responses — a rating, a confidence
judgement and a justification, say — mark all but the last with
`completesDraw: false`, so the draw closes exactly once.

```js
await session.response({ name: "rating",     payload: { rating },     drawId: draw.drawId, completesDraw: false });
await session.response({ name: "confidence", payload: { confidence }, drawId: draw.drawId, completesDraw: false });
await session.response({ name: "why",        payload: { text },       drawId: draw.drawId });
```

For tasks whose outcome is not stored as study data, close the draw on its own:

```js
await session.completeDraw(draw.drawId);
```

## Building a Chain

A chain is contributing with the item you drew as the parent. World-Wide-Lab
counts the generations for you.

```js
const [draw] = await session.drawItems("story-chain", {
  policy: "least-drawn",
  // Only hand out links nobody has continued yet
  maxChildrenPerItem: 1,
});

const retelling = await getRetellingFromParticipant(draw.publicPayload);

await session.contributeItem("story-chain", {
  publicPayload: { text: retelling },
  parentItemId: draw.itemId,
});
```

Seed generation 0 yourself in the admin interface, under `Items` > `Add New`.

`maxChildrenPerItem` counts the items contributed with a given parent, so the
latest link of a chain is handed out until someone has continued it, and then
never again. A continuation that is still waiting for review counts, so the
chain does not branch while you get to it. If you reject it, its parent goes
back into circulation. A participant who draws a link and then closes their
tab therefore costs you nothing, unlike with `maxDrawsPerItem: 1`.

## Showing a Gallery

Reading a pool without drawing from it records nothing, so the results can be
cached.

```js
const items = await client.getItems("my-awesome-pool", {
  limit: 20,
  sort: "newest",
  // Fine to serve a slightly stale wall
  cacheFor: 60,
});
```

`limit` defaults to 100 if you leave it out, and `sort` to `newest`. Items
contributed in the same millisecond have no defined order between them, so do
not rely on `newest` to separate near-simultaneous contributions.

Because of the cache, a retracted item can still show up until the window
passes. Pick `cacheFor` based on how fresh the wall needs to be.

## Moderation

Content one participant wrote and another one reads needs a way to say no. A
pool is in one of three modes:

| Mode | Contributions | What other participants see |
| --- | --- | --- |
| **Reviewed** (default) | accepted, stored as pending | approved items only |
| **Unreviewed** | accepted, stored as pending | pending and approved items |
| **Closed** | rejected | approved items only |

Approving, rejecting and retiring items is done in the admin interface under
`Items`, which opens on everything nobody has decided on yet. Select as many
as you like and use the `Approve`, `Reject` or `Retire` actions.

Two things are worth knowing:

- What is visible depends on the **pool's mode and the item's status together**, not on the status alone. Switching a pool from unreviewed back to reviewed therefore hides every item nobody approved, immediately. That is your kill switch if something goes wrong mid-study; items you explicitly approved stay up.
- `Closed` is for pools that only ever hold items you seeded yourself. Items you add from the admin interface are approved straight away.

Only use **unreviewed** when the shape of the payload makes abuse impossible —
a number, a coordinate, a choice from a fixed set. Live transmission chains
need it, because nobody can approve every link in real time, but do not reach
for it to save yourself the reviewing of free text or drawings.

Participants can withdraw what they contributed themselves:

```js
await session.retractItem(item.itemId);
```

This marks the item as **withdrawn**, which hides it just like rejecting it
would, but keeps the two apart in your data. The `Approve`, `Reject` and
`Retire` actions skip withdrawn items, so a participant's withdrawal is not
undone by accident. Should you ever need to, you can still change the status
of a single withdrawn item by editing it.

## Payload Size

An item's payload is limited to 64 KB by default. Pools can set their own
limit, and the server-wide default can be changed with
`ITEMS_DEFAULT_MAX_PAYLOAD_BYTES`.

## Downloading the Data

Two extra data types are available alongside the usual ones (see
[Downloading Data](./download-data)):

- `items-raw` — the items themselves, including `parentItemId`, which is where the structure of a chain lives.
- `item-draws-raw` — one row per "item was shown to session", i.e. the record of who saw what.

Your responses already carry a `drawId`, so `responses-raw` is enough to join
a reaction back to the item that produced it.

For a pool shared across studies, a study's download contains the items and
draws reachable from that study's sessions, not the whole pool.

## A Worked Example: Peer Ratings

```js
// Phase 1 — everybody writes a caption
await session.contributeItem("captions", {
  publicPayload: { caption },
  response: { name: "write-caption", payload: { caption, rt } },
});

// Phase 2 — everybody rates five captions that are not their own
// (a caption can end up with a few more than ten ratings, see the caps above)
const draws = await session.drawItems("captions", {
  count: 5,
  policy: "least-drawn",
  maxCompletionsPerItem: 10,
});

for (const draw of draws) {
  const rating = await showCaptionAndAskForRating(draw.publicPayload);
  await session.response({
    name: "rate-caption",
    payload: { rating },
    drawId: draw.drawId,
  });
}
```

Every caption converges on roughly ten ratings without anyone coordinating it,
and nobody ever rates the same caption twice or rates their own.
