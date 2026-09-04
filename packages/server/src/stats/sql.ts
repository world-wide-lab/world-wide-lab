import type { Sequelize } from "sequelize";

// World-Wide-Lab can run on top of both PostgreSQL and SQLite, which
// unfortunately disagree about most of the SQL needed for the statistics. These
// helpers return the correct snippet for whichever dialect is currently used.

type SupportedDialect = "postgres" | "sqlite";

function getDialect(sequelize: Sequelize): SupportedDialect {
  const dialect = sequelize.getDialect();
  if (dialect !== "postgres" && dialect !== "sqlite") {
    throw new Error(`Statistics are not supported on the ${dialect} dialect.`);
  }
  return dialect;
}

// Format a timestamp column as a YYYY-MM-DD string in UTC.
function sqlDateString(dialect: SupportedDialect, column: string): string {
  return dialect === "sqlite"
    ? `strftime('%Y-%m-%d', ${column})`
    : `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
}

// The number of seconds which have passed between two timestamp columns.
function sqlSecondsBetween(
  dialect: SupportedDialect,
  later: string,
  earlier: string,
): string {
  return dialect === "sqlite"
    ? `(julianday(${later}) - julianday(${earlier})) * 86400`
    : `EXTRACT(EPOCH FROM (${later} - ${earlier}))`;
}

// Read a (possibly nested) value out of a JSON column as text.
function sqlJsonValue(
  dialect: SupportedDialect,
  column: string,
  path: Array<string>,
): string {
  for (const key of path) {
    // The path is always hard-coded, this is just to make sure it stays that
    // way, since the keys can not be passed as query replacements.
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      throw new Error(`Unsupported key in JSON path: ${key}`);
    }
  }
  return dialect === "sqlite"
    ? `json_extract(${column}, '$.${path.join(".")}')`
    : `${column}::jsonb #>> '{${path.join(",")}}'`;
}

// Everything in front of the query string of a URL.
function sqlUrlWithoutQuery(
  dialect: SupportedDialect,
  expression: string,
): string {
  return dialect === "sqlite"
    ? `CASE WHEN instr(${expression}, '?') > 0 ` +
        `THEN substr(${expression}, 1, instr(${expression}, '?') - 1) ` +
        `ELSE ${expression} END`
    : `split_part(${expression}, '?', 1)`;
}

// Count the rows matching a condition. A portable version of the
// COUNT(*) FILTER (WHERE ...) syntax.
function sqlCountIf(condition: string): string {
  return `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`;
}

// Numeric aggregates are returned as strings by the postgres driver and
// summing over zero rows results in NULL, so every count has to be converted
// before it is used.
function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export {
  type SupportedDialect,
  getDialect,
  sqlCountIf,
  sqlDateString,
  sqlJsonValue,
  sqlSecondsBetween,
  sqlUrlWithoutQuery,
  toNumber,
};
