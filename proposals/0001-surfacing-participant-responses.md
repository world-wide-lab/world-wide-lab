# Proposal 0001 — Surfacing participant responses to other participants

**Status:** Draft / request for comments
**Date:** 2026-09-17

## 1. The problem

Today World-Wide-Lab is a one-way pipe: participants produce data, the data goes
into `wwl_responses`, and the only way back out is an authenticated download
(`/v1/study/:studyId/data/...`) or the admin UI. The one exception is
leaderboards, which feed a *number* back to participants.

A lot of interesting online research needs content, not numbers, to flow back:

| Use case | Shape |
| --- | --- |
| **Transmission chain / iterated learning** | Participant *n* sees what participant *n−1* produced, reproduces it, and their output becomes the item for *n+1*. Strict hand-off, one participant per link. |
| **Peer-generated items** | "Another participant drew this — what do you think it is?", "Rate this caption / argument / explanation another person wrote." Many-to-many, each item wants *k* judgements. |
| **Gallery / wall** | "Here's what other people said." Read-only, no assignment, mostly a display feature (and a recruitment feature). |
| **Asynchronous social games** | The participant plays against a past participant's recorded move (dictator game, trust game, prisoner's dilemma). One past record consumed per new session. |
| **Crowd annotation** | Researcher seeds items, participants label them, each item needs *n* labels before it retires. Same machinery, but the items are not participant-generated. |

All five reduce to the same two primitives: **contribute an item to a pool**, and
**draw an item from a pool under some selection policy**. What differs is who
seeds the pool, how many times an item may be used, and how tightly a draw is
tied to a particular session.

## 2. What exists today, and why it doesn't fit

Relevant code:

- `packages/server/src/db/models/index.ts` — `Study`, `Participant`, `Session`, `Response`, `Leaderboard`, `LeaderboardScore`.
- `packages/server/src/api/public.ts` — the unauthenticated API.
- `packages/server/src/api/protected.ts` — API-key protected data download.

The obvious cheap answer — a "share this" flag on `wwl_responses` plus a public
read endpoint — does not survive contact with the existing schema. Four facts
constrain any design:

1. **`Response.payload` is private.** The codebase has an explicit convention:
   `privateInfo` is internal, `publicInfo` "must not contain sensitive
   information as its contents can be queried from the public API"
   (`db/models/index.ts`). `payload` is neither — it is raw study data and has
   never been readable without an API key. Making response payloads
   world-readable is a change in the security model, not just a feature, and it
   needs a separate "which keys are public" projection anyway.
2. **`responseId` is a sequential integer.** Publishing it leaks how much data a
   study has collected and invites enumeration. Any public identifier for
   shared content should be a random UUID, as `sessionId` and `participantId`
   already are.
3. **Responses are the wrong home for this.** A researcher-seeded item (chain
   generation 0, a pre-made annotation item) is not a response and has no
   session. Serving counters would mean hot-write columns on the largest,
   most append-heavy table in the schema, and the moderation queue would sit on
   a table holding millions of rows per study.
4. **Deployments can be multi-instance.** There is an `Instance` model, a
   heartbeat, and a `primary` election (`services/service-instances.ts`), plus
   replication (`db/replication.ts`). The response cache (`src/cache.ts`) is an
   in-process `memoryStore` and therefore per-instance. So "hand this item to
   exactly one participant" has to be enforced in the database, never in memory.

Leaderboards are the closest precedent and a good template: a named,
researcher-created container (`wwl_leaderboards`) plus participant-written rows
(`wwl_leaderboard_scores`) that are keyed by `sessionId` and expose only fields
explicitly named "public" (`publicIndividualName`, `publicGroupName`). The
design below deliberately copies that shape so it is idiomatic here.

## 3. Requirements

Derived from the use cases above:

- **R1 — Explicit publication.** Content shown to participants is opted into, never inferred. No existing response becomes public by accident.
- **R2 — Moderation.** User-generated content shown to other people needs an approval state, an admin queue, and retraction.
- **R3 — Researcher seeding.** A pool must be able to contain items the researcher wrote as well as participant-generated ones.
- **R4 — Selection policies.** At minimum: random, least-drawn, newest/oldest, "exclude items this participant produced", and "exclude items this participant has already seen".
- **R5 — Serving limits.** "Show each item to at most *k* people" and "retire after *n* completions" must be enforceable across instances.
- **R6 — Provenance.** Analysis has to be able to reconstruct "response *R* was produced in reaction to item *I*, which came from response *R′*" without parsing free-form payloads.
- **R7 — Privacy.** A draw returns content and an opaque id, never a `sessionId`, `participantId`, or anything from `privateInfo`.
- **R8 — Fits the existing stack.** Sequelize model + umzug migration + yup schema + AdminJS resource + client method, same as leaderboards.

## 4. Approach

Three new tables — `wwl_item_pools`, `wwl_items`, `wwl_item_draws` — plus one
nullable column on `wwl_responses`, shipped together.

The first two mirror `Leaderboard` / `LeaderboardScore`: a researcher-created
pool, and item rows that may be seeded by the researcher or contributed by a
session. That covers R1–R3, R5 and R7.

The third, one row per "item *I* was served to session *S*", is what separates
"usually right" from "correct under concurrency". Counters on the item alone
cannot express "don't show this participant anything they have already seen"
(R4), and give only an approximate record of who saw what (R6). Responses then
point back at the draw they were produced under, which makes chain analysis a
plain join rather than payload archaeology.

Naming: **item**, not stimulus. `stimulus` is precise for psychology and opaque
outside it; `item` reads well in the API (`/item-pool/:poolId/draw`), in the
admin UI, and for the non-psychology use cases (gallery, async games).

Suggested build order: schema and migration → contribute and draw endpoints →
completion (including via the response API) → gallery → admin moderation → data
export.

## 5. Detailed design

### 5.1 Schema

```
wwl_item_pools                          -- researcher-created, mirrors wwl_leaderboards
  poolId            STRING   PK, /^[a-zA-Z0-9-_]+$/
  createdAt         DATE
  updatedAt         DATE
  studyId           STRING   nullable FK → wwl_studies   (null = shared across studies)
  moderation        STRING   'reviewed' | 'unreviewed' | 'closed'   default 'reviewed'
  maxPayloadBytes   INTEGER  nullable   -- null = server default
  publicInfo        JSON     nullable   -- e.g. prompt text the frontend renders
  privateInfo       JSON     nullable

wwl_items
  itemId            UUID     PK, UUIDV4       -- random: not enumerable (§2.2)
  createdAt         DATE
  updatedAt         DATE
  poolId            STRING   FK → wwl_item_pools, not null
  publicPayload     JSON     not null   -- THE content shown to other participants
  status            STRING   'pending' | 'approved' | 'rejected' | 'retired'   default 'pending'
  sourceSessionId   UUID     nullable FK → wwl_sessions    (null = researcher-seeded)
  sourceResponseId  INTEGER  nullable FK → wwl_responses
  parentItemId      UUID     nullable FK → wwl_items       (chains)
  generation        INTEGER  default 0
  timesDrawn        INTEGER  default 0       -- denormalised from wwl_item_draws
  timesCompleted    INTEGER  default 0       -- denormalised from wwl_item_draws
  privateInfo       JSON     nullable

wwl_item_draws
  drawId            UUID     PK, UUIDV4       -- handed to the client, so not enumerable
  createdAt         DATE
  updatedAt         DATE
  itemId            UUID     FK → wwl_items, not null
  sessionId         UUID     FK → wwl_sessions, not null
  status            STRING   'served' | 'completed'   default 'served'

wwl_responses
  + drawId          UUID     nullable FK → wwl_item_draws   -- what this response reacted to
```

`wwl_item_draws` is the source of truth for who saw what; `timesDrawn` and
`timesCompleted` are denormalised onto the item so that the selection query can
order by them without a `COUNT` join on every draw. They are maintained in the
same statement that writes the draw (§5.5).

The provenance link lives on the **response**, not on the draw, because one
drawn item routinely produces several responses: a rating trial, a confidence
judgement and a free-text justification are three separate `session.response()`
calls in a jsPsych timeline. A pointer on the draw could only name one of them
and would leave the rest to be correlated by session and timestamp. Pointing the
other way makes it many-to-one for free, and keeps a single source of truth for
the link.

Indices, following the pattern of the leaderboards migration: on items `poolId`,
`status`, `sourceSessionId`, `parentItemId`, `timesDrawn`, `updatedAt`, and a
composite `(poolId, status, timesDrawn)` for the hot draw query; on draws
`itemId`, `sessionId`, `status`, and a composite `(sessionId, itemId)` for the
exclude-already-seen filter; on responses `drawId`.

Note the field name: **`publicPayload`, not `payload`**. The codebase already
uses the `public*` prefix to mean "this can be read from the public API", and
that prefix is the clearest possible warning at every call site that whatever
goes in here is visible to strangers.

### 5.2 Moderation modes

| `moderation` | Participant contributions | What is drawable / visible |
| --- | --- | --- |
| `reviewed` *(default)* | accepted, stored as `pending` | `status = 'approved'` only |
| `unreviewed` | accepted, stored as `pending` | `status IN ('pending', 'approved')` |
| `closed` | rejected at the API (400) | `status = 'approved'` only |

The important detail in `unreviewed` is that contributions do **not** get the
`approved` flag. They are visible because the *pool* is in a mode where pending
items are visible by default, not because anything vetted them. Visibility is
therefore a function of `(pool.moderation, item.status)`, not of `item.status`
alone.

That has a useful consequence: flipping a pool from `unreviewed` to `reviewed`
immediately hides every item nobody has approved, which is exactly the kill
switch you want if abuse shows up mid-study. Items that *were* explicitly
approved stay visible across the switch. It also means `unreviewed` can later
grow a "bulk approve everything currently visible" admin action without any
schema change.

`closed` differs from `reviewed` only at write time — it rejects contributions
outright — since a closed pool contains only researcher-seeded items, which are
created `approved` from the admin UI. Its read path is identical.

Defaulting to `reviewed` means the unsafe thing is the one you have to type.
`unreviewed` is a first-class documented option rather than a footgun, since
live chains need it; the guide should say plainly that it is for payloads whose
shape makes abuse impossible (a number, a coordinate, a choice from a fixed
set).

*Future:* a per-pool JSON schema for `publicPayload` would let `unreviewed` be
safe for structured payloads generally, and would catch client bugs early. Cheap
with `yup` already in the stack, but it is a new config surface and is
deliberately out of scope here.

### 5.3 Public API

Mounted on `routerPublic` (`/v1`), documented with the same `@openapi` JSDoc
blocks as everything else in `public.ts`.

```
POST /v1/item-pool/:poolId/item
  body  { publicPayload, sessionId?, responseId?, parentItemId?, privateInfo? }
  →     { success: true, itemId, status }
```
Contribute an item. `sessionId` is optional but strongly encouraged — without it
the item cannot be attributed, excluded from its own author, or retracted by
session. `parentItemId` sets `generation = parent.generation + 1`.

```
GET /v1/item-pool/:poolId/draw
  query sessionId (required), count=1, policy=random, excludeOwn=true, excludeSeen=true,
        maxDrawsPerItem?, maxCompletionsPerItem?, minGeneration?, maxGeneration?
  →     { draws: [ { drawId, itemId, publicPayload, generation, parentItemId } ] }
```
Draw items, writing a `wwl_item_draws` row per item and incrementing
`timesDrawn`. `sessionId` is required here (unlike on contribute) because a draw
is by definition served *to* someone. `excludeOwn` filters
`sourceSessionId != sessionId` and, when the session has a participant, all
sessions of that participant; `excludeSeen` filters out items with an existing
draw for this session. This endpoint mutates, so it does not accept `cacheFor`.

```
POST /v1/response
  body  { ..., drawId?, completesDraw? }   -- existing endpoint, two new optional fields
```
When `drawId` is supplied, the response is created with that link and — unless
`completesDraw: false` — the draw is marked `completed` and the item's
`timesCompleted` incremented, all in one transaction. A single-trial reaction
therefore needs one call and no extra arguments. A multi-trial reaction passes
`completesDraw: false` on the early trials and lets the last one close the draw.

`completesDraw` defaults to **true** because the single-response case is the
common one, and because the failure mode of forgetting it is mild: the draw
completes early, which only inflates `timesCompleted` and so slightly
*under*-serves the item. The opposite default would make the common case carry a
flag and would silently leave draws open.

An unknown `drawId`, or one belonging to another session, is a 400 — the same
`ForeignKeyConstraintError` handling `POST /v1/response` already does for
`sessionId`.

```
POST /v1/draw/:drawId/complete
  body  { sessionId }
  →     { success: true }
```
Completes a draw without a response — for tasks whose outcome is not logged as
study data, or where the completion signal arrives separately.

```
GET /v1/item-pool/:poolId/items
  query limit?, sort=newest|oldest|random, cacheFor?
  →     { items: [ { itemId, publicPayload, generation } ] }
```
Read-only gallery. Non-mutating, so `cacheFor` is safe. Retraction is therefore
eventually consistent within the caller's chosen `cacheFor` window, which is
fine — the frontend picks that number based on how fresh it needs the wall to
be.

```
DELETE /v1/item/:itemId
  body  { sessionId }
  →     { success: true }
```
A session retracts its own contribution (sets `status = 'rejected'`). This is
also the mechanism a participant withdrawal request needs.

### 5.4 Selection knobs: query parameters, not pool columns

`policy`, `maxDrawsPerItem` and `maxCompletionsPerItem` are **query parameters
on the draw endpoint**, not columns on the pool. This matches how `limit` /
`sort` / `aggregate` already work on the leaderboard endpoint, and it means
tuning a study does not need a migration or an admin round-trip.

It also draws a line that keeps every future knob from being a judgement call:

> The **pool** governs what may exist and who may see it — moderation, study
> scope, payload limits. The **query** governs what to hand out right now —
> policy, caps, exclusions.

Keeping `policy` out of the pool buys one thing a column cannot: two draw
contexts over the same pool can want different policies. The main task draws
`least-drawn` for balanced coverage while a debrief screen draws one at
`random` and records that the participant saw it. With a pool column that needs
two pools over the same content, which is not possible.

The honest cost of query parameters: the values come from the client, so a buggy
study could over-serve an item. The atomic claim in §5.5 still prevents two
concurrent draws from both slipping past the same threshold, so this is a "wrong
number" risk, not a race. If a study ever needs a guarantee the client cannot
weaken, the answer is pool-level caps that a query may tighten but not loosen —
additive later, deliberately not built now.

One behaviour to be aware of when choosing these numbers: a draw counts towards
`maxDrawsPerItem` the moment it is served, and nothing later returns it. A
participant who abandons the task still consumes their draw permanently. With
`maxDrawsPerItem=1` — the natural setting for a strict transmission chain — that
means an abandoned tab takes its chain tip out of circulation for good, so
either pair it with `maxCompletionsPerItem` and a looser draw cap, or accept
some attrition in the chain.

### 5.5 Selection under concurrency

Claiming has to be one atomic statement in the database, never a read in Node
followed by a write (§2.4). Sketch for the Postgres path:

```sql
WITH claimed AS (
  SELECT "itemId" FROM wwl_items
   WHERE "poolId" = :poolId
     AND (CASE WHEN :moderation = 'unreviewed'
               THEN status IN ('pending', 'approved')
               ELSE status = 'approved' END)
     AND (:maxDraws IS NULL OR "timesDrawn" < :maxDraws)
     AND (:maxCompletions IS NULL OR "timesCompleted" < :maxCompletions)
     AND (NOT :excludeOwn OR "sourceSessionId" IS DISTINCT FROM :sessionId)
     AND (NOT :excludeSeen OR NOT EXISTS (
           SELECT 1 FROM wwl_item_draws d
            WHERE d."itemId" = wwl_items."itemId" AND d."sessionId" = :sessionId))
   ORDER BY <policy>
   LIMIT :count
   FOR UPDATE SKIP LOCKED
)
UPDATE wwl_items SET "timesDrawn" = "timesDrawn" + 1, "updatedAt" = now()
 WHERE "itemId" IN (SELECT "itemId" FROM claimed)
 RETURNING *;
```

…then insert the `wwl_item_draws` rows in the same transaction.

`RETURNING` works on both supported dialects (Postgres, and SQLite ≥ 3.35 for
the Electron app). `FOR UPDATE SKIP LOCKED` is Postgres-only and must be omitted
for SQLite, which serialises writes anyway — the same
`sequelize.getDialect() === "sqlite"` branch already used in the
`usingResponses` count query in `public.ts`. Policy ordering:

| `policy` | `ORDER BY` |
| --- | --- |
| `random` *(default)* | `RANDOM()` |
| `least-drawn` | `"timesDrawn" ASC, RANDOM()` |
| `newest` | `"createdAt" DESC` |
| `oldest` | `"createdAt" ASC` |

`least-drawn` is what makes crowd annotation and balanced *k*-ratings work, and
it is also the right choice for chains: it hands out the least-used tip first.

### 5.6 Client

```js
// Contribute — writes the response and the item, linking them both ways
const item = await session.contributeItem("drawings", {
  publicPayload: { svg },
  // optional: also log it as ordinary study data
  response: { name: "draw-trial", payload: { svg, rt } },
});

// Draw
const [draw] = await client.drawItems("drawings", {
  count: 1,
  sessionId: session.sessionId,
  policy: "least-drawn",
  excludeOwn: true,
  excludeSeen: true,
  maxCompletionsPerItem: 10,
});

// React to it — one call creates the response, completes the draw and links them
await session.response({
  name: "guess",
  payload: { guess },
  drawId: draw.drawId,
});

// …or several trials off one drawn item, with only the last one closing it
await session.response({ name: "rating",     payload: { rating },     drawId: draw.drawId, completesDraw: false });
await session.response({ name: "confidence", payload: { confidence }, drawId: draw.drawId, completesDraw: false });
await session.response({ name: "why",        payload: { text },       drawId: draw.drawId });

// Chain: pass your version on as the next link
await session.contributeItem("chain", {
  publicPayload: { text },
  parentItemId: draw.itemId,
});
```

`session.response()` gains optional `drawId` and `completesDraw`, which is the
whole of the change to the existing response path. The jsPsych integration gets
a matching `on_finish` helper in a follow-up.

### 5.7 Admin UI

Three AdminJS resources registered in `admin/index.ts` alongside the existing
ones:

- **ItemPool** — visible, `poolId` as `isTitle`, `new`/`edit` enabled (this is how researchers create pools, exactly like leaderboards), a `viewItems` record action mirroring `viewLeaderboardScoresHandler`.
- **Item** — visible (unlike `LeaderboardScore`, because this is the moderation queue), `new` enabled for seeding, a default filter on `status = 'pending'`, and bulk `Approve` / `Reject` / `Retire` actions. `publicPayload` rendered with the existing `ShowJsonProp` / `EditJsonProp` components.
- **ItemDraw** — read-only, `navigation: false` like `LeaderboardScore`, reachable from an item's show page. Useful for debugging a stuck chain, not for day-to-day work.

Plus a `CREATE_ITEM_POOLS` env var next to the existing `CREATE_STUDIES` /
`CREATE_LEADERBOARDS` in `config.ts`, so a deployment can declare its pools
without clicking.

### 5.8 Data export

`protected.ts` gains two `dataType` values, `items-raw` and `item-draws-raw`, so
a downloaded study contains the pool and the serving record as well as the
responses. Without this, a chain study's data is unanalysable outside the
database — the chain structure lives entirely in `parentItemId`, and who-saw-what
lives entirely in the draws table.

The response-side provenance rides along for free: `drawId` is an ordinary
column on `wwl_responses`, so the existing `responses-raw` export carries it
without any change to that code path.

Pools with `studyId = NULL` are shared across studies, so a per-study export has
to decide what to include. Proposed: export the items and draws that are
reachable from that study's sessions, not the entire shared pool.

### 5.9 Privacy and abuse

- Public API responses carry `drawId`, `itemId`, `publicPayload`, `generation`, `parentItemId`. Never `sourceSessionId`, `sourceResponseId`, `privateInfo`, or any participant identifier (R7).
- `itemId` and `drawId` are random UUIDs, so pools are not enumerable and pool size is not inferable.
- Per-pool `maxPayloadBytes` (default something like 64 KB) enforced at the API. The global `requestMaxSize` of 256 MB is not a meaningful limit for a public write endpoint whose content other people will see.
- Deleting a study should cascade to its pools, items and draws; the existing `deleteStudyHandler` needs updating, and `deletionProtection` already guards the accidental case. Shared pools (`studyId = NULL`) must survive the deletion of any one study.
- There is still no rate-limiting middleware in `app.ts`. This feature makes that gap more consequential (a public write endpoint feeding a public read endpoint); suggest a simple per-IP limiter on the contribute endpoint as part of the work, or at minimum a note in the deployment guide.

## 6. Worked examples

**Transmission chain.** Pool `story-chain`, `moderation: 'reviewed'`. Researcher
seeds generation 0 via the admin UI. Each participant draws one item with
`policy=least-drawn`, retells it, and contributes the retelling with
`parentItemId` set. Analysis: recursive self-join on `parentItemId`, joined to
`wwl_responses.drawId` for timings and the responses each link produced.

**Peer rating.** Pool `captions`, `moderation: 'reviewed'`. Participants
contribute in phase 1; in phase 2 each draws 5 with `policy=least-drawn`,
`excludeOwn=true`, `excludeSeen=true` and `maxCompletionsPerItem=10`, and rates
them. Every caption converges on ~10 ratings without a coordinator, and nobody
rates the same caption twice.

**Gallery.** Pool `answers`, `moderation: 'reviewed'`. Study page calls
`GET /v1/item-pool/answers/items?limit=20&sort=newest&cacheFor=60`. No draws, no
completions.

**Async dictator game.** Pool `offers`, `moderation: 'unreviewed'` (payload is a
single validated integer), drawn with `policy=random`, `maxDrawsPerItem=1` and
`excludeOwn=true`. Each new participant responds to exactly one real past offer.

## 7. Out of scope

Deliberately not part of this change:

- **Media / file upload.** A later extension. When it lands, `wwl_items` is where it belongs, and `maxPayloadBytes` should be set with that in mind.
- **Expiring and reclaiming abandoned draws.** See the attrition note in §5.4 for what leaving this out means in practice.
- **Custom payload schemas.** Possible later (§5.2).
- **Merging with leaderboards.** A pool with a numeric payload and a `newest` policy is nearly a leaderboard, and unifying them is an interesting idea, but not now.
- **Pool-level caps.** Query parameters cover the need; see §5.4 for when a column would earn its place.
