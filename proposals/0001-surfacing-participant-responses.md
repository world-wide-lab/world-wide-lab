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

Four facts constrain any design:

1. **`Response.payload` is private.** The codebase has an explicit convention:
   `privateInfo` is internal, `publicInfo` "must not contain sensitive
   information as its contents can be queried from the public API"
   (`db/models/index.ts`). `payload` is neither — it is raw study data and has
   never been readable without an API key. Anything that makes response payloads
   world-readable is a change in the security model, not just a feature.
2. **`responseId` is a sequential integer.** Publishing it leaks how much data a
   study has collected and invites enumeration. Any public identifier for
   shared content should be a random UUID, as `sessionId` and `participantId`
   already are.
3. **The public API is wide open.** `app.ts` mounts `cors()` with no origin
   restriction, there is no rate-limiting middleware, and `requestMaxSize`
   defaults to `256mb`. A public *write* endpoint whose content is then shown to
   other humans needs size limits and a moderation story that the existing
   `POST /v1/response` never needed.
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
- **R3 — Researcher seeding.** A pool must be able to contain items the researcher wrote (generation 0 of a chain, pre-made annotation items) as well as participant-generated ones.
- **R4 — Selection policies.** At minimum: random, least-drawn, newest/oldest, "exclude items this participant produced", and "exclude items this participant has already seen".
- **R5 — Serving limits.** "Show each item to at most *k* people" and "retire after *n* completions" must be enforceable across instances.
- **R6 — Provenance.** Analysis has to be able to reconstruct "response *R* was produced in reaction to item *I*, which came from response *R′*" without parsing free-form payloads.
- **R7 — Privacy.** A draw returns content and an opaque id, never a `sessionId`, `participantId`, or anything from `privateInfo`.
- **R8 — Fits the existing stack.** Sequelize model + umzug migration + yup schema + AdminJS resource + client method, same as leaderboards.

## 4. Options considered

### Option A — Flag on the existing responses table

Add `shareStatus` (`'private' | 'pending' | 'approved' | 'rejected'`) to
`wwl_responses`, plus a public `GET /v1/study/:studyId/responses/shared`.

- **For:** smallest possible change; no new concepts; existing `session.response()` calls keep working; single source of truth for content.
- **Against:**
  - Exposes the whole `payload`, which is study-internal by design (R1, R7). You'd need a second "which keys are public" mechanism, at which point you've built a projection layer anyway.
  - `responseId` is enumerable (§2.2), so you need a second public id column regardless.
  - No home for researcher-seeded items (R3) — a seeded item is not a response, it has no session.
  - No home for serving counters (R5) without adding hot-write counter columns to the largest, most append-heavy table in the schema.
  - Moderation queue sits on top of a table that can hold millions of rows per study (R2).
- **Verdict:** fine for the *gallery* use case alone. Collapses under chains, limits, or seeding.

### Option B — An item pool + item table

Two new tables mirroring `Leaderboard` / `LeaderboardScore`: a researcher-created
`ItemPool`, and `Item` rows that may be seeded by the researcher or contributed
by a session, with `timesDrawn` / `timesCompleted` counters on each item.

- **For:** clean separation between "raw data we collected" and "content we show"; satisfies R1–R3, R5 and R7; seeding is natural; moderation queue is an AdminJS resource for free; mirrors a pattern the codebase already has.
- **Against:** counters alone cannot express "don't show this participant anything they have already seen" (R4), cannot reclaim an item from a participant who dropped out mid-task, and give only an approximate record of who saw what (R6).

### Option C — Option B plus a draws table *(recommended)*

Add `wwl_item_draws`: one row per "item *I* was served to session *S*", with a
status (`served` / `completed` / `expired`) and a link to the response that
completed it.

- **For:** everything in B, plus exactly-once assignment under concurrency, exclude-already-seen, reclaiming abandoned draws, and complete provenance (R6) that does not depend on trusting payload contents. The draw row is also the natural place to hang the response link that makes chain analysis a plain join.
- **Against:** an extra row per served item; needs an expiry sweep (there is already a periodic services runner in `services/` to hang it off); more moving parts for studies that only want a gallery.

### Option D — Link table only, no content table

Keep responses as the only content store; add `wwl_response_links`
(`sessionId`, `shownResponseId`). Selection is computed on the fly over
`wwl_responses`.

- **For:** no content duplication; any response can become an item retroactively.
- **Against:** selection queries scan the biggest table in the schema; still no place for moderation state, seeded items, or per-item limits — add those and you have rebuilt Option A's problems plus a join.

### Option E — Don't build it; document an external pattern

Researchers run their own small service that reads via the protected API and
serves items themselves.

- **For:** zero maintenance for WWL.
- **Against:** the protected API needs an API key, which cannot live in
  participant-facing JavaScript, so every study needs a server — exactly the
  thing World-Wide-Lab exists to avoid. It also means no moderation tooling and
  no standard provenance format for analysis.
- **Verdict:** this is the status quo. Worth naming so the "do nothing" cost is
  explicit, not worth choosing.

### Comparison

| | A: flag on responses | B: pool + items | **C: B + draws** | D: link table | E: external |
| --- | --- | --- | --- | --- | --- |
| Gallery | ✅ | ✅ | ✅ | ✅ | ✅ |
| Peer-rated items | ⚠️ no limits | ✅ | ✅ | ⚠️ | ✅ |
| Transmission chain | ❌ | ⚠️ approximate | ✅ | ❌ | ✅ |
| Researcher-seeded items | ❌ | ✅ | ✅ | ❌ | ✅ |
| Exclude already-seen | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reclaim abandoned draws | ❌ | ❌ | ✅ | ❌ | ✅ |
| Moderation UI | ⚠️ huge table | ✅ | ✅ | ❌ | ❌ |
| Provenance for analysis | ⚠️ | ✅ | ✅✅ | ✅ | ⚠️ |
| Effort | S | M | M+ | M | – |

## 5. Recommendation

**Option C**: `wwl_item_pools` + `wwl_items` + `wwl_item_draws`, shipped
together. The draws table is what separates "usually right" from "correct under
concurrency and abandonment", and it is also where the response link lives that
makes chain data analysable with an ordinary join.

Naming: **item**, not stimulus. `stimulus` is precise for psychology and opaque
outside it; `item` reads well in the API (`/item-pool/:poolId/draw`), in the
admin UI, and for the non-psychology use cases (gallery, async games).

Suggested build order within the one change: schema and migration → contribute
and draw endpoints → completion (including via the response API) → gallery →
admin moderation → data export.

## 6. Detailed design

### 6.1 Schema

```
wwl_item_pools                          -- researcher-created, mirrors wwl_leaderboards
  poolId            STRING   PK, /^[a-zA-Z0-9-_]+$/
  createdAt         DATE
  updatedAt         DATE
  studyId           STRING   nullable FK → wwl_studies   (null = shared across studies)
  moderation        STRING   'reviewed' | 'unreviewed' | 'closed'   default 'reviewed'
  drawPolicy        STRING   'random' | 'least-drawn' | 'newest' | 'oldest'   default 'random'
  maxPayloadBytes   INTEGER  nullable   -- null = server default
  drawExpiresAfter  INTEGER  nullable   -- seconds; null = draws never expire
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
  status            STRING   'served' | 'completed' | 'expired'   default 'served'
  expiresAt         DATE     nullable
  responseId        INTEGER  nullable FK → wwl_responses   -- the response that completed it
```

`wwl_item_draws` is the source of truth for who saw what; `timesDrawn` and
`timesCompleted` are denormalised onto the item so that the selection query can
order by them without a `COUNT` join on every draw. They are maintained in the
same statement that writes the draw (§6.4).

Indices, following the pattern of the leaderboards migration: on items `poolId`,
`status`, `sourceSessionId`, `parentItemId`, `timesDrawn`, `updatedAt`, and a
composite `(poolId, status, timesDrawn)` for the hot draw query; on draws
`itemId`, `sessionId`, `responseId`, `status`, and a composite
`(sessionId, itemId)` for the exclude-already-seen filter.

Note the field name: **`publicPayload`, not `payload`**. The codebase already
uses the `public*` prefix to mean "this can be read from the public API", and
that prefix is the clearest possible warning at every call site that whatever
goes in here is visible to strangers.

### 6.2 Moderation modes

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

### 6.3 Public API

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
  query sessionId (required), count=1, policy?, excludeOwn=true, excludeSeen=true,
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
POST /v1/draw/:drawId/complete
  body  { sessionId, responseId? }
  →     { success: true }
```
Marks the draw `completed`, links `responseId` if given, and increments
`timesCompleted` on the item.

```
POST /v1/response
  body  { ..., drawId? }        -- existing endpoint, one new optional field
```
When `drawId` is supplied, the response is created and the matching draw is
completed and linked to the new `responseId` in a single transaction. This is
the convenient path for the common case where one response *is* the completion,
and it means a study does not have to make two calls in sequence and handle the
second one failing. `POST /v1/draw/:drawId/complete` stays for completions that
are not a single response (or not a response at all).

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

### 6.4 Draw limits: query parameters, not pool columns

`maxDrawsPerItem` and `maxCompletionsPerItem` are **query parameters on the draw
endpoint**, not columns on the pool. They are just filters on the selection
query (`timesDrawn < :maxDraws`, `timesCompleted < :maxCompletions`), this
matches how `limit` / `sort` / `aggregate` already work on the leaderboard
endpoint, and it means tuning a study's *k* does not need a migration or an
admin round-trip.

The honest cost: the threshold comes from the client, so a buggy study could
over-serve an item. The atomic claim in §6.5 still prevents two concurrent draws
from both slipping past the same threshold, so this is a "wrong number" risk,
not a race. If a study ever needs a guarantee the client cannot weaken, the
answer is pool-level caps that a query may tighten but not loosen — additive
later, deliberately not built now.

### 6.5 Selection under concurrency

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

| `drawPolicy` | `ORDER BY` |
| --- | --- |
| `random` | `RANDOM()` |
| `least-drawn` | `"timesDrawn" ASC, RANDOM()` |
| `newest` | `"createdAt" DESC` |
| `oldest` | `"createdAt" ASC` |

`least-drawn` is what makes crowd annotation and balanced *k*-ratings work, and
it is also the right default for chains: it hands out the least-used tip first.

### 6.6 Expiry and reclaim

When a pool sets `drawExpiresAfter`, each draw gets `expiresAt = now() +
drawExpiresAfter`. A periodic job — a new service alongside
`service-alerts.ts` / `service-instances.ts`, which already follow this
pattern — flips overdue `served` draws to `expired` and decrements the item's
`timesDrawn`, putting the item back in circulation.

This is what stops a transmission chain from dying because one participant
closed the tab, which under a counters-only design (Option B) would burn the
only draw of that chain tip permanently.

The sweep must only run on the primary instance; `service-instances.ts` already
elects one.

### 6.7 Client

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

// Chain: pass your version on as the next link
await session.contributeItem("chain", {
  publicPayload: { text },
  parentItemId: draw.itemId,
});
```

`session.response()` gains an optional `drawId`, which is the whole of the
change to the existing response path. The jsPsych integration gets a matching
`on_finish` helper in a follow-up.

### 6.8 Admin UI

Three AdminJS resources registered in `admin/index.ts` alongside the existing
ones:

- **ItemPool** — visible, `poolId` as `isTitle`, `new`/`edit` enabled (this is how researchers create pools, exactly like leaderboards), a `viewItems` record action mirroring `viewLeaderboardScoresHandler`.
- **Item** — visible (unlike `LeaderboardScore`, because this is the moderation queue), `new` enabled for seeding, a default filter on `status = 'pending'`, and bulk `Approve` / `Reject` / `Retire` actions. `publicPayload` rendered with the existing `ShowJsonProp` / `EditJsonProp` components.
- **ItemDraw** — read-only, `navigation: false` like `LeaderboardScore`, reachable from an item's show page. Useful for debugging a stuck chain, not for day-to-day work.

Plus a `CREATE_ITEM_POOLS` env var next to the existing `CREATE_STUDIES` /
`CREATE_LEADERBOARDS` in `config.ts`, so a deployment can declare its pools
without clicking.

### 6.9 Data export

`protected.ts` gains two `dataType` values, `items-raw` and `item-draws-raw`, so
a downloaded study contains the pool and the serving record as well as the
responses. Without this, a chain study's data is unanalysable outside the
database — the chain structure lives entirely in `parentItemId`, and who-saw-what
lives entirely in the draws table.

Pools with `studyId = NULL` are shared across studies, so a per-study export has
to decide what to include. Proposed: export the items and draws that are
reachable from that study's sessions, not the entire shared pool.

### 6.10 Privacy and abuse

- Public API responses carry `drawId`, `itemId`, `publicPayload`, `generation`, `parentItemId`. Never `sourceSessionId`, `sourceResponseId`, `privateInfo`, or any participant identifier (R7).
- `itemId` and `drawId` are random UUIDs, so pools are not enumerable and pool size is not inferable.
- Per-pool `maxPayloadBytes` (default something like 64 KB) enforced at the API. The global `requestMaxSize` of 256 MB is not a meaningful limit for a public write endpoint whose content other people will see.
- Deleting a study should cascade to its pools, items and draws; the existing `deleteStudyHandler` needs updating, and `deletionProtection` already guards the accidental case. Shared pools (`studyId = NULL`) must survive the deletion of any one study.
- There is still no rate-limiting middleware in `app.ts`. This feature makes that gap more consequential (a public write endpoint feeding a public read endpoint); suggest a simple per-IP limiter on the contribute endpoint as part of the work, or at minimum a note in the deployment guide.

## 7. Worked examples

**Transmission chain.** Pool `story-chain`, `moderation: 'reviewed'`,
`drawPolicy: 'least-drawn'`, `drawExpiresAfter: 600`. Researcher seeds
generation 0 via the admin UI. Each participant draws one item with
`maxDrawsPerItem=1`, retells it, and contributes the retelling with
`parentItemId` set. Abandoned tabs return their chain tip after ten minutes.
Analysis: recursive self-join on `parentItemId`, joined to `wwl_item_draws` for
timings and the response that each link produced.

**Peer rating.** Pool `captions`, `moderation: 'reviewed'`,
`drawPolicy: 'least-drawn'`. Participants contribute in phase 1; in phase 2 each
draws 5 with `excludeOwn=true`, `excludeSeen=true` and
`maxCompletionsPerItem=10`, and rates them. Every caption converges on ~10
ratings without a coordinator, and nobody rates the same caption twice.

**Gallery.** Pool `answers`, `moderation: 'reviewed'`. Study page calls
`GET /v1/item-pool/answers/items?limit=20&sort=newest&cacheFor=60`. No draws, no
completions.

**Async dictator game.** Pool `offers`, `moderation: 'unreviewed'` (payload is a
single validated integer), `drawPolicy: 'random'`, drawn with
`maxDrawsPerItem=1` and `excludeOwn=true`. Each new participant responds to
exactly one real past offer.

## 8. Open questions

1. **Should `wwl_responses` also carry a `drawId`?** As designed, the link is
   `wwl_item_draws.responseId` — one response per draw, the one that completed
   it. A trial that produces several responses from one drawn item (a rating
   plus a confidence judgement plus free text) can only designate one of them.
   A nullable `wwl_responses.drawId` would make that many-to-one and is one
   cheap column, at the cost of two places expressing nearly the same link.
2. **Media.** Drawings and audio are the obvious use cases, and JSON payloads
   mean base64 blobs in the database. Out of scope here, but if file upload is
   ever on the roadmap, `wwl_items` is where it lands, and `maxPayloadBytes`
   should be set with that in mind.
3. **Should `drawPolicy` live on the pool at all?** Every other selection knob
   ended up as a query parameter (§6.4). `drawPolicy` is currently a pool
   column for discoverability, but the same argument would move it to the query.
4. **Sharing granularity.** `studyId = NULL` means "shared with every study on
   this instance", which covers the stated requirement. Scoping a pool to a
   *specific subset* of studies would need a join table; is that ever wanted, or
   is all-or-one enough?

Explicitly **not** open, for the record:

- **Leaderboards stay separate.** A pool with a numeric payload and a `newest`
  policy is nearly a leaderboard, and unifying them is an interesting idea, but
  not now.
- **Retraction latency.** Eventual consistency within the caller's `cacheFor`
  window is acceptable, and the frontend chooses that number per request.
- **Custom payload schemas.** Not in this change; possible later (§6.2).
