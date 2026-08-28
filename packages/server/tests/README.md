# Server tests

```bash
npm test                          # run everything
npx vitest                        # watch mode
npx vitest run tests/api          # run one directory
npx vitest run --sequence.shuffle.files   # prove tests don't depend on each other
```

## How the suite is laid out

| Path | What lives there |
| --- | --- |
| `tests/api/` | One file per API resource. Black-box HTTP tests through supertest, plus database assertions where the response alone doesn't prove the endpoint did the right thing. |
| `tests/*.test.ts` | Everything else: pure units (`sanitization`, `db-util`), the database (`db`, `migrations`, `schema-parity`) and the background services. |
| `tests/helpers/` | The shared toolkit described below. |

`packages/test-server` is a separate, deliberately small smoke suite that runs
against a *running* server (a docker container, typically). Detailed cases
belong here, not there.

## Writing a test

Everything you normally need comes from one import:

```ts
import { api, authed, seedStudy, useTestDatabase } from "../helpers/index.js";

beforeAll(useTestDatabase);

it("should count the sessions of a study", async () => {
  const { studyId } = await seedStudy({
    sessions: [{ finished: true, responses: 3 }, { responses: 1 }],
  });

  const response = await api.get(`/v1/study/${studyId}/count/all`).send();

  expect(response.status).toBe(200);
  expect(response.body.count).toBe(2);
});
```

- **`api`** is a supertest client bound to the express app in-process — no
  server is started and no port is bound. `authed(api.get(...))` adds the API
  key for the protected endpoints.
- **`useTestDatabase()`** runs the migrations once per worker. Tests run against
  the schema the migrations produce, which is the schema every deployment has —
  never against `sequelize.sync()`, which produces a slightly different one (see
  `schema-parity.test.ts`).
- **`seedStudy()`** and the `create*` factories in `helpers/factories.ts` build
  fixtures straight in the database. That is much faster than driving the API to
  set up state, and it keeps the "arrange" step out of the code paths under
  test.

## The two rules

Test files share a module registry — and therefore a database — with the other
files running in the same worker (`isolate: false` in `vite.config.ts`). That is
what makes the suite fast: the server is imported once per worker instead of
once per file. In exchange:

1. **Create the data you assert on.** Every id the factories hand out is unique,
   so a test never sees another test's data. Never assert on a global count
   ("there are 4 sessions") unless the file owns the database — see
   `replication.test.ts` and `service-alerts.test.ts`, which call
   `resetDatabase()` for exactly that reason.
2. **Put back what you change.** Config values, `global.fetch`, spies and timers
   are shared. Restore them in `afterAll`/`afterEach`. Avoid `vi.mock()` of a
   module: with a shared registry it may or may not apply, depending on whether
   something else imported that module first. `vi.spyOn` on an object is
   reliable and undoable.

A test that genuinely needs a pristine database creates its own connection, as
`migrations.test.ts` does via `createUmzug()`.

`npx vitest run --sequence.shuffle.files` runs the files in random order and is
the quickest way to check that a new test respects rule 1.

## Assertions

Prefer an explicit `toEqual({ error: "Unknown sessionId", type: "AppError" })`
over `toMatchSnapshot()`. Snapshots are worth it for things that are tedious to
write out and valuable to pin down — the column list of a data export, the table
structures produced by the migrations — and a liability everywhere else.
