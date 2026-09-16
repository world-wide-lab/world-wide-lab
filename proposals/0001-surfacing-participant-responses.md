# Proposal 0001 — Surfacing participant responses to other participants

**Status:** Draft / request for comments
**Date:** 2026-09-16

## 1. The problem

Today World-Wide-Lab is a one-way pipe: participants produce data, the data goes
into `wwl_responses`, and the only way back out is an authenticated download
(`/v1/study/:studyId/data/...`) or the admin UI. The one exception is
leaderboards, which feed a *number* back to participants.

A lot of interesting online research needs content, not numbers, to flow back:

| Use case | Shape |
| --- | --- |
| **Transmission chain / iterated learning** | Participant *n* sees what participant *n−1* produced, reproduces it, and their output becomes the stimulus for *n+1*. Strict hand-off, one participant per link. |
| **Peer-generated stimuli** | "Another participant drew this — what do you think it is?", "Rate this caption / argument / explanation another person wrote." Many-to-many, each item wants *k* judgements. |
| **Gallery / wall** | "Here's what other people said." Read-only, no assignment, mostly a display feature (and a recruitment feature). |
| **Asynchronous social games** | The participant plays against a past participant's recorded move (dictator game, trust game, prisoner's dilemma). One past record consumed per new session. |
| **Crowd annotation** | Researcher seeds items, participants label them, each item needs *n* labels before it retires. Same machinery, but the items are not participant-generated. |

All five reduce to the same two primitives: **contribute an item to a pool**, and
**draw an item from a pool under some selection policy**. What differs is who
seeds the pool, how many times an item may be drawn, and how tightly a draw is
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
   replication (`db/replication.ts`). The in-process cache
   (`src/cache.ts`, `memoryStore`, `max: 50`) is per-instance. So "hand this item
   to exactly one participant" has to be enforced in the database, never in
   memory.

Leaderboards are the closest precedent and a good template: a named,
researcher-created container (`wwl_leaderboards`) plus participant-written rows
(`wwl_leaderboard_scores`) that are keyed by `sessionId` and expose only fields
explicitly named "public" (`publicIndividualName`, `publicGroupName`). The
proposal below deliberately copies that shape so it is idiomatic here.

## 3. Requirements

Derived from the use cases above:

- **R1 — Explicit publication.** Content shown to participants is opted into, never inferred. No existing response becomes public by accident.
- **R2 — Moderation.** User-generated content shown to other people needs an approval state, an admin queue, and retraction that takes effect quickly.
- **R3 — Researcher seeding.** A pool must be able to contain items the researcher wrote (generation 0 of a chain, pre-made annotation items) as well as participant-generated ones.
- **R4 — Selection policies.** At minimum: random, least-served, newest/oldest, and "exclude items this participant produced".
- **R5 — Serving limits.** "Show each item to at most *k* people" and "retire after *n* completions" must be enforceable across instances.
- **R6 — Provenance.** Analysis has to be able to reconstruct "response *R* was produced in reaction to item *I*, which came from response *R′*" without parsing free-form payloads.
- **R7 — Privacy.** A draw returns content and an opaque id, never a `sessionId`, `participantId`, or anything from `privateInfo`.
- **R8 — Fits the existing stack.** Sequelize model + umzug migration + yup schema + AdminJS resource + client method, same as leaderboards.

## 4. Options

### Option A — Flag on the existing responses table

Add `shareStatus` (`'private' | 'pending' | 'approved' | 'rejected'`) to
`wwl_responses`, plus a public `GET /v1/study/:studyId/responses/shared`.

```sql
ALTER TABLE wwl_responses ADD COLUMN "shareStatus" VARCHAR DEFAULT 'private';
```

- **For:** smallest possible change; no new concepts; existing `session.response()` calls keep working; single source of truth for content.
- **Against:**
  - Exposes the whole `payload`, which is study-internal by design (R1, R7). You'd need a second "which keys are public" mechanism, at which point you've built a projection layer anyway.
  - `responseId` is enumerable (§2.2), so you need a second public id column regardless.
  - No home for researcher-seeded items (R3) — a seeded item is not a response, it has no session.
  - No home for serving counters (R5) without adding hot-write counter columns to the largest, most append-heavy table in the schema.
  - Moderation queue sits on top of a table that can hold millions of rows per study (R2).
- **Effort:** ~1 migration, ~1 endpoint. Small.
- **Verdict:** fine for the *gallery* use case alone. Collapses under chains, limits, or seeding.

### Option B — A stimulus pool + stimulus table *(recommended core)*

Two new tables mirroring `Leaderboard` / `LeaderboardScore`: a researcher-created
`StimulusPool`, and `Stimulus` rows that may be seeded by the researcher or
contributed by a session.

- **For:** clean separation between "raw data we collected" and "content we show"; satisfies R1–R5 and R7 directly; seeding is natural; counters live on a small table; moderation queue is an AdminJS resource for free; mirrors a pattern the codebase already has.
- **Against:** a second write path — a participant contributing content does two writes (`response` + `stimulus`). Mitigated by a client helper that does both and by storing `sourceResponseId`.
- **Effort:** 1 migration (2 tables), 2 models, 2 yup schemas, ~4 public endpoints, 2 AdminJS resources, 2 client methods, docs. Medium.

### Option C — Option B plus a draws/assignment table

Add `wwl_stimulus_draws`: one row per "item *I* was served to session *S*", with
a status (`served` / `completed` / `expired`).

- **For:** the only way to get *exactly-once* assignment, "don't show this participant anything they've already seen", reclaiming items from participants who dropped out mid-task, and complete provenance (R6) without trusting payload contents.
- **Against:** an extra row per served item; needs an expiry sweep (there is already a periodic services runner in `services/` to hang it off); more moving parts for studies that just want a gallery.
- **Effort:** Medium on top of B. Should be opt-in per pool (`trackDraws`).

### Option D — Link table only, no content table

Keep responses as the only content store; add `wwl_response_links`
(`sessionId`, `shownResponseId`). Selection is computed on the fly over
`wwl_responses`.

- **For:** no content duplication; any response can become a stimulus retroactively; very flexible.
- **Against:** selection queries scan the biggest table in the schema; still no place for moderation state, seeded items, or per-item limits — add those and you have rebuilt Option A's problems plus a join. The flexibility is mostly theoretical, since in practice a study decides up front what it shares.
- **Verdict:** not recommended standalone; the link idea survives as the (much cheaper) `Response.stimulusId` column in §5.

### Option E — Don't build it; document an external pattern

Researchers run their own small service that reads via the protected API and
serves stimuli themselves.

- **For:** zero maintenance for WWL.
- **Against:** the protected API needs an API key, which cannot live in
  participant-facing JavaScript, so every study needs a server — exactly the
  thing World-Wide-Lab exists to avoid. It also means no moderation tooling and
  no standard provenance format for analysis.
- **Verdict:** this is the status quo. Worth naming so the "do nothing" cost is
  explicit, not worth choosing.

### Comparison

| | A: flag on responses | B: pool + stimuli | C: B + draws | D: link table | E: external |
| --- | --- | --- | --- | --- | --- |
| Gallery | ✅ | ✅ | ✅ | ✅ | ✅ |
| Peer-rated stimuli | ⚠️ no limits | ✅ | ✅ | ⚠️ | ✅ |
| Transmission chain | ❌ | ⚠️ counter-based | ✅ | ❌ | ✅ |
| Researcher-seeded items | ❌ | ✅ | ✅ | ❌ | ✅ |
| Exclude already-seen | ❌ | ❌ | ✅ | ✅ | ✅ |
| Moderation UI | ⚠️ huge table | ✅ | ✅ | ❌ | ❌ |
| Provenance for analysis | ⚠️ | ✅ | ✅✅ | ✅ | ⚠️ |
| Effort | S | M | M+ | M | – |

## 5. Recommendation

**Ship Option B, designed so Option C drops in as a per-pool flag.** Concretely:

- *Milestone 1* — `wwl_stimulus_pools` + `wwl_stimuli` with counters, moderation,
  and the four public endpoints. Also add a nullable `stimulusId` column to
  `wwl_responses`. That one column buys most of Option C's provenance (R6) for
  the price of a single FK: every response can say which item provoked it, and
  chain reconstruction becomes a self-join instead of payload archaeology.
- *Milestone 2* — `wwl_stimulus_draws` behind `pool.trackDraws`, adding
  exclude-seen, exactly-once hand-off, and expiry/reclaim.

Counters alone (`timesDrawn` + `maxDrawsPerItem`) already give a usable
approximation of exactly-once for chains; the draws table upgrades it from
"usually right" to "correct under concurrency and abandonment". Splitting it this
way means the gallery and peer-rating use cases ship without waiting for the
harder concurrency work.

## 6. Detailed design (milestone 1)

### 6.1 Schema

```
wwl_stimulus_pools                      -- researcher-created, mirrors wwl_leaderboards
  poolId            STRING   PK, /^[a-zA-Z0-9-_]+$/
  createdAt         DATE
  updatedAt         DATE
  studyId           STRING   nullable FK → wwl_studies   (null = shared across studies)
  moderation        STRING   'review' | 'open' | 'closed'      default 'review'
  drawPolicy        STRING   'random' | 'least-drawn' | 'newest' | 'oldest'   default 'random'
  maxDrawsPerItem   INTEGER  nullable   -- null = unlimited
  maxPayloadBytes   INTEGER  nullable   -- null = server default
  trackDraws        BOOLEAN  default false     -- reserved for milestone 2
  publicInfo        JSON     nullable   -- e.g. prompt text the frontend renders
  privateInfo       JSON     nullable

wwl_stimuli
  stimulusId        UUID     PK, UUIDV4       -- random: not enumerable (§2.2)
  createdAt         DATE
  updatedAt         DATE
  poolId            STRING   FK → wwl_stimulus_pools, not null
  publicPayload     JSON     not null   -- THE content shown to other participants
  status            STRING   'pending' | 'approved' | 'rejected' | 'retired'
  sourceSessionId   UUID     nullable FK → wwl_sessions    (null = researcher-seeded)
  sourceResponseId  INTEGER  nullable FK → wwl_responses
  parentStimulusId  UUID     nullable FK → wwl_stimuli     (chains)
  generation        INTEGER  default 0
  timesDrawn        INTEGER  default 0
  timesCompleted    INTEGER  default 0
  privateInfo       JSON     nullable

wwl_responses
  + stimulusId      UUID     nullable FK → wwl_stimuli     -- what this response reacted to
```

Indices, following the pattern of the leaderboards migration: `poolId`,
`studyId`, `status`, `sourceSessionId`, `parentStimulusId`, `timesDrawn`,
`updatedAt`, and a composite `(poolId, status, timesDrawn)` for the hot draw
query.

Note the field name: **`publicPayload`, not `payload`**. The codebase already
uses the `public*` prefix to mean "this can be read from the public API", and
that prefix is the clearest possible warning at every call site that whatever
goes in here is visible to strangers.

### 6.2 Moderation modes

| `moderation` | New participant items start as | Use for |
| --- | --- | --- |
| `review` *(default)* | `pending` — invisible until an admin approves | anything free-text or free-form drawing |
| `open` | `approved` | constrained payloads (a number, a choice, a coordinate) or pilot studies |
| `closed` | rejected at the API — pool accepts researcher-seeded items only | crowd annotation of pre-made items |

Defaulting to `review` means the unsafe thing is the one you have to type. It
does block live chains, so `open` has to be a first-class documented option
rather than a footgun — the guide should say plainly: use `open` only when the
payload shape makes abuse impossible, e.g. because it is validated to a number
or an enum.

An `admin`-side JSON-schema check per pool (`privateInfo.payloadSchema`) would
let `open` be safe for structured payloads. Flagged as an open question, not
proposed for milestone 1.

### 6.3 Public API

Mounted on `routerPublic` (`/v1`), documented with the same `@openapi` JSDoc
blocks as everything else in `public.ts`.

```
POST /v1/stimulus-pool/:poolId/stimulus
  body  { publicPayload, sessionId?, responseId?, parentStimulusId?, privateInfo? }
  →     { success: true, stimulusId, status }
```
Contribute an item. `sessionId` is optional but strongly encouraged — without it
the item cannot be attributed, excluded from its own author, or retracted by
session. `parentStimulusId` sets `generation = parent.generation + 1`.

```
GET /v1/stimulus-pool/:poolId/draw
  query count=1, policy?, sessionId?, excludeOwn=true, minGeneration?, maxGeneration?
  →     { stimuli: [ { stimulusId, publicPayload, generation, parentStimulusId } ] }
```
Draw items and atomically increment `timesDrawn`. Only `status = 'approved'`
items with `timesDrawn < maxDrawsPerItem` are eligible. `excludeOwn` filters
`sourceSessionId != sessionId` (and, when the session has a participant, all
sessions of that participant). **This endpoint mutates and must never accept
`cacheFor`.**

```
POST /v1/stimulus/:stimulusId/complete
  body  { sessionId, responseId? }
  →     { success: true }
```
Signals the participant actually finished the task with this item: increments
`timesCompleted` and retires the item if `timesCompleted >= maxDrawsPerItem`.
In milestone 2 this closes the matching draw row instead of trusting the client.

```
GET /v1/stimulus-pool/:poolId/stimuli
  query limit?, sort=newest|oldest|random, cacheFor?
  →     { stimuli: [ { stimulusId, publicPayload, generation } ] }
```
Read-only gallery. Non-mutating, so `cacheFor` is safe here — with the caveat in
§6.7.

### 6.4 Selection under concurrency

`timesDrawn` must be incremented in the database, never read-modify-written in
Node. For the counter-only design:

```sql
UPDATE wwl_stimuli
   SET "timesDrawn" = "timesDrawn" + 1, "updatedAt" = now()
 WHERE "stimulusId" IN (
         SELECT "stimulusId" FROM wwl_stimuli
          WHERE "poolId" = :poolId AND status = 'approved'
            AND (:maxDraws IS NULL OR "timesDrawn" < :maxDraws)
            AND (:sessionId IS NULL OR "sourceSessionId" IS DISTINCT FROM :sessionId)
          ORDER BY <policy>
          LIMIT :count
          FOR UPDATE SKIP LOCKED        -- Postgres only
       )
 RETURNING *;
```

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

### 6.5 Client

```js
// Contribute — writes the response and the stimulus, links them both ways
const stimulus = await session.contributeStimulus("drawings", {
  publicPayload: { svg },
  // optional: also log it as ordinary study data
  response: { name: "draw-trial", payload: { svg, rt } },
});

// Draw
const [item] = await client.drawStimuli("drawings", {
  count: 1,
  sessionId: session.sessionId,
  excludeOwn: true,
});

// React to it — stimulusId lands on the response row, not buried in the payload
await session.response({ name: "guess", payload: { guess }, stimulusId: item.stimulusId });
await session.completeStimulus(item.stimulusId);

// Chain: pass your version on as the next link
await session.contributeStimulus("chain", {
  publicPayload: { text },
  parentStimulusId: item.stimulusId,
});
```

`session.response()` gains an optional `stimulusId`, which is the whole of the
`wwl_responses` change. The jsPsych integration gets a matching
`on_finish` helper in a follow-up.

### 6.6 Admin UI

Two AdminJS resources registered in `admin/index.ts` alongside the existing ones:

- **StimulusPool** — visible, `poolId` as `isTitle`, `new`/`edit` enabled (this is how researchers create pools, exactly like leaderboards), a `viewStimuli` record action mirroring `viewLeaderboardScoresHandler`.
- **Stimulus** — visible (unlike `LeaderboardScore`, because this is the moderation queue), `new` enabled for seeding, a default filter on `status = 'pending'`, and bulk `Approve` / `Reject` / `Retire` actions. `publicPayload` rendered with the existing `ShowJsonProp` / `EditJsonProp` components.

Plus a `CREATE_STIMULUS_POOLS` env var next to the existing
`CREATE_STUDIES` / `CREATE_LEADERBOARDS` in `config.ts`, so a deployment can
declare its pools without clicking.

### 6.7 Caching — a caveat worth fixing first

The leaderboard scores endpoint builds its cache key as
`req.path + req.query` (`public.ts:1166`). `req.query` is an object, so it
stringifies to `[object Object]` and every query-parameter variant of a given
path shares one cache entry; `/study/:studyId/count/:countType` similarly keys on
`req.path` alone while accepting a `minResponseCount` parameter
(`public.ts:695`). The gallery endpoint would inherit the same bug, and unlike a
leaderboard, a stale cache entry here can keep showing content that has just been
moderated away. Two things follow:

1. Fix the key (e.g. `req.path + JSON.stringify(req.query)` or `req.originalUrl`) before reusing the pattern — worth a separate small PR either way.
2. The cache is `memoryStore` and per-instance, so a retraction takes effect only after `cacheFor` expires on *every* instance. Recommend capping `cacheFor` on `/stimuli` for pools in `review` mode, and documenting that retraction is eventually-consistent within that window.

### 6.8 Data export

`protected.ts` gains two `dataType` values, `stimuli-raw` and (milestone 2)
`stimulus-draws-raw`, so a downloaded study contains the pool as well as the
responses. Without this, a chain study's data is unanalysable outside the
database — the chain structure lives entirely in `parentStimulusId`.

### 6.9 Privacy and abuse

- Public responses carry `stimulusId`, `publicPayload`, `generation`, `parentStimulusId`. Never `sourceSessionId`, `sourceResponseId`, `privateInfo`, or any participant identifier (R7).
- `stimulusId` is a random UUID, so the pool is not enumerable and pool size is not inferable.
- Per-pool `maxPayloadBytes` (default something like 64 KB) enforced at the API. The global `requestMaxSize` of 256 MB is not a meaningful limit for a public write endpoint whose content other people will see.
- A session can retract its own contributions: `DELETE /v1/stimulus/:stimulusId` with a matching `sessionId` sets `status = 'rejected'`. This is also the mechanism a participant withdrawal request needs.
- Deleting a study should cascade to its pools and stimuli; the existing `deleteStudyHandler` needs updating, and `deletionProtection` already guards the accidental case.
- There is still no rate-limiting middleware in `app.ts`. This feature makes that gap more consequential (a public write endpoint feeding a public read endpoint); suggest a simple per-IP limiter on the contribute endpoint as part of the work, or at minimum a note in the deployment guide.

## 7. Worked examples

**Transmission chain.** Pool `story-chain`, `moderation: 'review'`,
`drawPolicy: 'least-drawn'`, `maxDrawsPerItem: 1`. Researcher seeds generation 0
via the admin UI. Each participant draws one item, retells it, contributes the
retelling with `parentStimulusId` set. Analysis: recursive self-join on
`parentStimulusId`, joined to `wwl_responses.stimulusId` for timings and
raw trial data.

**Peer rating.** Pool `captions`, `moderation: 'review'`,
`drawPolicy: 'least-drawn'`, `maxDrawsPerItem: 10`. Participants contribute in
phase 1; in phase 2 each draws 5 with `excludeOwn: true` and rates them. Every
caption converges on ~10 ratings without a coordinator.

**Gallery.** Pool `answers`, `moderation: 'review'`. Study page calls
`GET /v1/stimulus-pool/answers/stimuli?limit=20&sort=newest&cacheFor=60`. No
draws, no counters, no completes.

**Async dictator game.** Pool `offers`, `moderation: 'open'` (payload is a single
validated integer), `drawPolicy: 'random'`, `maxDrawsPerItem: 1`, `excludeOwn`.
Each new participant responds to exactly one real past offer.

## 8. Open questions

1. **Naming.** `stimulus` is precise for psychology and opaque outside it. `contribution`, `item`, `artifact`, `exhibit`? `stimulus-pool` / `stimulus` reads well in the API and matches the audience; happy to be overruled.
2. **Should a pool own its schema?** A per-pool JSON schema for `publicPayload` would make `moderation: 'open'` genuinely safe for structured payloads, and would catch client bugs early. Cheap with `yup` already in the stack, but it is a new config surface.
3. **Media.** Drawings and audio are the obvious use cases, and JSON payloads mean base64 blobs in the database. Out of scope here, but if file upload is ever on the roadmap, the stimulus table is where it lands, and `maxPayloadBytes` should be set with that in mind.
4. **Does `maxDrawsPerItem` count draws or completions?** Proposed: draws gate eligibility, completions retire the item. Under counter-only (milestone 1) an abandoned session burns a draw permanently. Milestone 2's expiry fixes it; is that acceptable in the interim, or should milestone 1 ship `trackDraws` after all?
5. **Cross-study pools.** `studyId` is nullable, copying leaderboards. Is a pool shared between studies a real requirement or accidental generality?
6. **Retraction latency.** Is eventual consistency within `cacheFor` acceptable for moderated pools, or does retraction need to bust the cache across instances (which the current `memoryStore` cannot do)?
7. **Ordering vs. the leaderboards overlap.** A pool with a numeric payload and a `newest` policy is nearly a leaderboard. Worth unifying eventually, or deliberately keeping them separate?
