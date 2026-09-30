// Set up fake environment variables
import "./setup_env";

import { QueryTypes } from "sequelize";
import request from "supertest";
import app from "../src/app";
import config from "../src/config";
import sequelize from "../src/db";

const endpoint = request(app);
const API_KEY = process.env.DEFAULT_API_KEY;

const STUDY_ID = "keyset-replication";
const N_SESSIONS = 4;
const N_RESPONSES_PER_SESSION = 10;
const N_RESPONSES = N_SESSIONS * N_RESPONSES_PER_SESSION;

// Only a handful of distinct timestamps across all responses, so that most
// pages end in the middle of a group of rows sharing the same "updatedAt".
// This is exactly the case an offset-paginated, "updatedAt"-ordered query
// cannot get right, since that order does not identify a row uniquely.
const N_DISTINCT_TIMESTAMPS = 3;

function getTable(table: string, params: Record<string, string | number>) {
  const search = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  ).toString();
  return endpoint
    .get(`/v1/replication/source/get-table/${table}/?${search}`)
    .set("Authorization", `Bearer ${API_KEY}`)
    .send();
}

describe("Replication source, keyset pagination", () => {
  beforeAll(async () => {
    await sequelize.sync();
    config.replication.role = "source";

    await sequelize.models.Study.create({ studyId: STUDY_ID });
    const participant: any = await sequelize.models.Participant.create({});

    for (let s = 0; s < N_SESSIONS; s++) {
      const session: any = await sequelize.models.Session.create({
        studyId: STUDY_ID,
        participantId: participant.participantId,
      });
      for (let r = 0; r < N_RESPONSES_PER_SESSION; r++) {
        await sequelize.models.Response.create({
          sessionId: session.sessionId,
          name: `trial_${r}`,
          payload: { r },
        });
      }
    }

    // Collapse the responses onto just a few distinct timestamps
    const responses: any[] = await sequelize.models.Response.findAll({
      order: [["responseId", "ASC"]],
      raw: true,
    });
    for (const [index, response] of responses.entries()) {
      const bucket = index % N_DISTINCT_TIMESTAMPS;
      // Set the timestamp with raw SQL, so that sequelize's own handling of
      // "updatedAt" does not overwrite it again
      await sequelize.query(
        'UPDATE wwl_responses SET "updatedAt" = :updatedAt WHERE "responseId" = :responseId',
        {
          replacements: {
            updatedAt: new Date(Date.UTC(2024, 0, 1 + bucket)),
            responseId: response.responseId,
          },
        },
      );
    }

    // Make sure the setup above actually produced the ties this suite is
    // about, so that it cannot silently turn into a test of unique timestamps
    const distinct: any[] = await sequelize.query(
      'SELECT DISTINCT "updatedAt" FROM wwl_responses',
      { type: QueryTypes.SELECT },
    );
    expect(distinct.length).toBe(N_DISTINCT_TIMESTAMPS);
  });

  // Walk the whole table the way a replication destination does
  async function walkTable(table: string, limit: number) {
    const rows: any[] = [];
    let cursor: { updatedAt: string; id: string } | undefined = undefined;
    let rowCount = limit;
    // Guard against a walk that never terminates
    let iterations = 0;

    while (rowCount === limit) {
      if (iterations++ > 100) {
        throw new Error("Walking the table did not terminate");
      }

      const response = await getTable(table, {
        limit,
        ...(cursor && {
          after_updated_at: cursor.updatedAt,
          after_id: cursor.id,
        }),
      });
      expect(response.status).toBe(200);

      const page = response.body;
      rowCount = page.length;
      rows.push(...page);

      if (rowCount > 0) {
        const lastRow = page[rowCount - 1];
        cursor = {
          updatedAt: new Date(lastRow.updatedAt).toISOString(),
          id: String(lastRow.responseId ?? lastRow.sessionId),
        };
      }
    }
    return rows;
  }

  describe.each([1, 3, 7, 40])("with a page size of %i", (limit) => {
    it("should return every response exactly once", async () => {
      const rows = await walkTable("wwl_responses", limit);

      expect(rows.length).toBe(N_RESPONSES);
      expect(new Set(rows.map((row) => row.responseId)).size).toBe(N_RESPONSES);
    });

    it("should return rows ordered by updatedAt, then primary key", async () => {
      const rows = await walkTable("wwl_responses", limit);

      const keys = rows.map((row) => [
        new Date(row.updatedAt).toISOString(),
        row.responseId,
      ]);
      const sorted = [...keys].sort((a, b) =>
        a[0] === b[0]
          ? (a[1] as number) - (b[1] as number)
          : (a[0] as string) < (b[0] as string)
            ? -1
            : 1,
      );
      expect(keys).toEqual(sorted);
    });
  });

  it("should respect the requested limit", async () => {
    const response = await getTable("wwl_responses", { limit: 6 });

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(6);
  });

  it("should combine the cursor with updated_after", async () => {
    const all = await walkTable("wwl_responses", 40);
    const secondDay = new Date(Date.UTC(2024, 0, 2)).toISOString();

    const response = await getTable("wwl_responses", {
      limit: 100,
      updated_after: secondDay,
    });

    expect(response.status).toBe(200);
    const expected = all.filter(
      (row) => new Date(row.updatedAt).toISOString() >= secondDay,
    );
    expect(response.body.length).toBe(expected.length);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.length).toBeLessThan(N_RESPONSES);
  });

  it("should reject a cursor that is missing after_id", async () => {
    const response = await getTable("wwl_responses", {
      limit: 10,
      after_updated_at: new Date(Date.UTC(2024, 0, 1)).toISOString(),
    });

    expect(response.status).toBe(400);
  });

  it("should reject a cursor that is missing after_updated_at", async () => {
    const response = await getTable("wwl_responses", {
      limit: 10,
      after_id: "1",
    });

    expect(response.status).toBe(400);
  });

  it("should reject an after_id that does not fit the primary key", async () => {
    const response = await getTable("wwl_responses", {
      limit: 10,
      after_updated_at: new Date(Date.UTC(2024, 0, 1)).toISOString(),
      after_id: "not-a-number",
    });

    expect(response.status).toBe(400);
  });

  it("should still support legacy offset pagination", async () => {
    const all = await walkTable("wwl_responses", 40);

    const response = await getTable("wwl_responses", { limit: 5, offset: 10 });

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(5);
    expect(response.body.map((row: any) => row.responseId)).toEqual(
      all.slice(10, 15).map((row) => row.responseId),
    );
  });

  it("should paginate tables with a string primary key", async () => {
    const response = await getTable("wwl_studies", { limit: 100 });

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);

    const first = response.body[0];
    const next = await getTable("wwl_studies", {
      limit: 100,
      after_updated_at: new Date(first.updatedAt).toISOString(),
      after_id: first.studyId,
    });

    expect(next.status).toBe(200);
    expect(next.body.length).toBe(response.body.length - 1);
    expect(next.body.map((row: any) => row.studyId)).not.toContain(
      first.studyId,
    );
  });
});
