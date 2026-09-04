import {
  Box,
  H2,
  H4,
  H5,
  Label,
  Link,
  Loader,
  MessageBox,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Text,
} from "@adminjs/design-system";
import { styled } from "@adminjs/design-system/styled-components";
import { ApiClient } from "adminjs";
import type React from "react";
import { useEffect, useState } from "react";

import type { RecruitmentBreakdown, Stats } from "../../../stats/index.js";
import { Chart } from "../charts/Chart.js";
import { SessionsOverTimeChart } from "../charts/SessionsOverTimeChart.js";

const PAGE_NAME = "Stats";
// Number of studies compared in the charts, tables always show all of them
const N_STUDIES_IN_CHARTS = 10;
// Number of bars shown in the responses per session chart
const N_BARS_IN_HISTOGRAM = 25;
// Number of rows shown in the table of transitions between studies
const N_TRANSITIONS = 8;
const CHART_HEIGHT = 200;

// Explanations of the web technologies behind the recruitment statistics
const MDN_REFERRER =
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer";
const MDN_QUERY_STRING =
  "https://developer.mozilla.org/en-US/docs/Glossary/Query_string";

// Widths of the tiles, from small screens to large ones
const HALF = [1, 1, 1 / 2];
const THIRD = [1, 1, 1 / 3];
const QUARTER = [1 / 2, 1 / 2, 1 / 4];
// Quarter of the width, but full width on medium screens
const QUARTER_WIDE = [1, 1, 1 / 4];

const api = new ApiClient();

const DEFAULT_DAYS = 30;
const timeframeOptions = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 365 days" },
];
const ALL_STUDIES = { value: "", label: "All studies" };

// The selected filters are kept in the page's URL, so that the stats of a
// single study can be linked to, e.g. from the page of that study.
function getFiltersFromUrl(): { studyId: string; days: number } {
  if (typeof window === "undefined") {
    return { studyId: ALL_STUDIES.value, days: DEFAULT_DAYS };
  }
  const params = new URLSearchParams(window.location.search);
  const days = Number(params.get("days"));
  return {
    studyId: params.get("studyId") ?? ALL_STUDIES.value,
    days: timeframeOptions.some((option) => option.value === days)
      ? days
      : DEFAULT_DAYS,
  };
}

function updateUrl(studyId: string, days: number) {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams();
  if (studyId) {
    params.set("studyId", studyId);
  }
  if (days !== DEFAULT_DAYS) {
    params.set("days", String(days));
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `?${query}` : window.location.pathname,
  );
}

const numberFormat = new Intl.NumberFormat("en-US");

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function formatShare(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 60 * 60) {
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

// URLs are shown without their scheme, since they are displayed in a rather
// narrow column
function shortenUrl(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// Add the counts which are missing from a histogram, so that it is drawn
// without any gaps in it
function fillHistogram(
  histogram: Array<{ nResponses: number; nSessions: number }>,
  maxBars: number,
): Array<{ nResponses: number; nSessions: number }> {
  const counts = new Map(
    histogram.map((entry) => [entry.nResponses, entry.nSessions]),
  );
  const highest = histogram.length
    ? histogram[histogram.length - 1].nResponses
    : 0;

  const filled = [];
  for (let n = 0; n <= Math.min(highest, maxBars - 1); n++) {
    filled.push({ nResponses: n, nSessions: counts.get(n) ?? 0 });
  }
  return filled;
}

function sumOf<T>(entries: Array<T>, key: keyof T): number {
  return entries.reduce((sum, entry) => sum + Number(entry[key]), 0);
}

const Card = styled(Box)`
  position: relative;
  overflow: hidden;
  width: 100%;
`;
Card.defaultProps = {
  variant: "white",
  boxShadow: "card",
  p: "lg",
};

const LargeNumber = styled(Box)`
  font-size: 1.75rem;
  line-height: 1.2;
`;

// A row of tiles, which wrap onto the next line on smaller screens. Tiles are
// stretched to the same height, unless they are aligned at the top.
const Row: React.FC<{
  children: React.ReactNode;
  alignTop?: boolean;
}> = ({ children, alignTop }) => (
  <Box
    flex
    flexDirection="row"
    flexWrap="wrap"
    alignItems={alignTop ? "flex-start" : "stretch"}
  >
    {children}
  </Box>
);

// Every statistic gets its own tile, with a title and a short explanation of
// what it shows
const Tile: React.FC<{
  title?: string;
  description?: React.ReactNode;
  width?: Array<number>;
  children: React.ReactNode;
}> = ({ title, description, width = [1], children }) => (
  <Box width={width} p="sm" flex>
    <Card>
      {title && <H5>{title}</H5>}
      {description && (
        <Text variant="sm" mb="default">
          {description}
        </Text>
      )}
      {children}
    </Card>
  </Box>
);

const StatTile: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <Tile width={QUARTER}>
    <Text variant="sm">{label}</Text>
    <LargeNumber>{value}</LargeNumber>
  </Tile>
);

const Section: React.FC<{ title: string; description: React.ReactNode }> = ({
  title,
  description,
}) => (
  <Box px="sm" pt="lg">
    <H4>{title}</H4>
    <Text variant="sm">{description}</Text>
  </Box>
);

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <Link href={href} target="_blank" rel="noreferrer">
    {children}
  </Link>
);

const DataTable: React.FC<{
  headers: Array<string>;
  rows: Array<Array<string>>;
  emptyMessage?: string;
}> = ({
  headers,
  rows,
  emptyMessage = "There is no data to show here yet.",
}) =>
  rows.length === 0 ? (
    <Text variant="sm">{emptyMessage}</Text>
  ) : (
    <Table>
      <TableHead>
        <TableRow>
          {headers.map((header) => (
            <TableCell key={header}>{header}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row[0]}>
            {row.map((cell, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Cells have no id
              <TableCell key={index}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

const Breakdown: React.FC<{
  title: string;
  description: React.ReactNode;
  breakdown: RecruitmentBreakdown;
}> = ({ title, description, breakdown }) => (
  <Tile title={title} description={description} width={THIRD}>
    <DataTable
      // The values need all the room they can get, so the number of sessions
      // and their share share a column
      headers={["Value", "Sessions"]}
      rows={breakdown.entries.map((entry) => [
        shortenUrl(entry.value),
        `${formatNumber(entry.nSessions)} (${formatShare(entry.share)})`,
      ])}
    />
    {breakdown.truncated && (
      <MessageBox
        variant="info"
        message="Only the most common values are counted, since there are very many different ones."
        mt="default"
      />
    )}
  </Tile>
);

export const StatsPage: React.FC = () => {
  const initialFilters = getFiltersFromUrl();
  const [studyId, setStudyId] = useState<string>(initialFilters.studyId);
  const [days, setDays] = useState<number>(initialFilters.days);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let outdated = false;

    // Keep the filters in the URL, so that the current view can be
    // bookmarked and shared
    updateUrl(studyId, days);

    api
      .getPage<Stats>({
        pageName: PAGE_NAME,
        params: { days, ...(studyId ? { studyId } : {}) },
      })
      .then((response) => {
        if (!outdated) {
          setError(null);
          setStats(response.data);
        }
      })
      .catch((error) => {
        console.error("Error retrieving stats", error);
        if (!outdated) {
          setError(
            "The stats could not be retrieved. Please check the server logs for more information.",
          );
        }
      });

    // Responses to requests which have been replaced by a newer one are
    // ignored, so that they can not overwrite more recent results.
    return () => {
      outdated = true;
    };
  }, [studyId, days]);

  const studyOptions = [
    ALL_STUDIES,
    ...(stats?.studyIds ?? []).map((id) => ({ value: id, label: id })),
  ];
  const selectedStudy =
    studyOptions.find((option) => option.value === studyId) ??
    (studyId ? { value: studyId, label: studyId } : ALL_STUDIES);
  const selectedTimeframe =
    timeframeOptions.find((option) => option.value === days) ??
    timeframeOptions[1];
  const studyLabel = studyId ? `the study ${studyId}` : "all studies";
  const allData = "This always covers all of your data.";

  const histogram = fillHistogram(
    stats?.responsesPerSession.histogram ?? [],
    N_BARS_IN_HISTOGRAM,
  );
  const nSessions = sumOf(stats?.sessionsOverTime ?? [], "nSessions");
  const nFinished = sumOf(stats?.sessionsOverTime ?? [], "nFinished");

  return (
    <Box variant="grey">
      <Box mx={[0, 0, 0, "auto"]} width={[1, 1, 1, 1024]} py="lg" px="lg">
        <Box flex flexDirection="row" flexWrap="wrap" alignItems="flex-end">
          <Box flexGrow={1} px="sm">
            <H2>Stats</H2>
          </Box>
          <Box width={[1 / 2, 1 / 2, 200]} px="sm">
            <Label>Study</Label>
            <Select
              value={selectedStudy}
              options={studyOptions}
              onChange={(selected: { value: string }) =>
                setStudyId(selected?.value ?? "")
              }
            />
          </Box>
          <Box width={[1 / 2, 1 / 2, 200]} px="sm">
            <Label>Timeframe</Label>
            <Select
              value={selectedTimeframe}
              options={timeframeOptions}
              onChange={(selected: { value: number }) =>
                setDays(selected?.value ?? DEFAULT_DAYS)
              }
            />
          </Box>
        </Box>

        {error && <MessageBox variant="danger" message={error} m="sm" />}

        {!stats ? (
          <Tile>
            <Loader />
          </Tile>
        ) : (
          <>
            <Row>
              <StatTile label="Sessions" value={formatNumber(nSessions)} />
              <StatTile
                label="Finished Sessions"
                value={`${formatNumber(nFinished)} (${formatShare(
                  nSessions > 0 ? nFinished / nSessions : null,
                )})`}
              />
              <StatTile
                label="Responses"
                value={formatNumber(stats.responsesPerSession.nResponses)}
              />
              <StatTile
                label="Responses per Session"
                value={
                  stats.responsesPerSession.meanResponsesPerSession === null
                    ? "-"
                    : stats.responsesPerSession.meanResponsesPerSession.toFixed(
                        1,
                      )
                }
              />
            </Row>

            <Section
              title="Over Time"
              description={`How the sessions of ${studyLabel} developed within the selected timeframe.`}
            />
            <Row>
              <Tile
                title="Sessions per Day"
                description="Sessions which were started and finished each day. A session only counts as finished once your study calls the client's finish() function at its end."
                width={HALF}
              >
                <SessionsOverTimeChart
                  data={stats.sessionsOverTime}
                  height={CHART_HEIGHT}
                />
              </Tile>
              <Tile
                title="Completion Rate per Day"
                description="The share of each day's sessions which were finished. Days without any sessions are shown as 0%."
                width={HALF}
              >
                <Chart
                  type="line"
                  labels={stats.sessionsOverTime.map((entry) => entry.date)}
                  datasets={[
                    {
                      name: "Completion Rate (%)",
                      values: stats.sessionsOverTime.map(
                        (entry) => (entry.completionRate ?? 0) * 100,
                      ),
                    },
                  ]}
                  colors={["green"]}
                  height={CHART_HEIGHT}
                  formatValue={(value) => `${value.toFixed(1)}%`}
                />
              </Tile>
            </Row>

            <Section
              title="Studies"
              description={`How your studies compare to each other. ${allData}`}
            />
            <Row>
              <Tile
                title="Sessions per Study"
                description="A session's duration is measured from its start until its last response, so sessions without any responses are not included in it."
                width={HALF}
              >
                <DataTable
                  headers={["Study", "Sessions", "Finished", "Mean Duration"]}
                  rows={stats.studies.map((entry) => [
                    entry.studyId,
                    formatNumber(entry.nSessions),
                    `${formatNumber(entry.nFinished)} (${formatShare(
                      entry.completionRate,
                    )})`,
                    entry.meanDurationSeconds === null
                      ? "-"
                      : formatDuration(entry.meanDurationSeconds),
                  ])}
                  emptyMessage="There are no studies yet."
                />
              </Tile>
              <Tile
                title="Completion Rate per Study"
                description="The share of a study's sessions which were finished."
                width={HALF}
              >
                <Chart
                  type="bar"
                  labels={stats.studies
                    .slice(0, N_STUDIES_IN_CHARTS)
                    .map((entry) => entry.studyId)}
                  datasets={[
                    {
                      name: "Completion Rate (%)",
                      values: stats.studies
                        .slice(0, N_STUDIES_IN_CHARTS)
                        .map((entry) => (entry.completionRate ?? 0) * 100),
                    },
                  ]}
                  colors={["green"]}
                  height={CHART_HEIGHT}
                  formatValue={(value) => `${value.toFixed(1)}%`}
                />
              </Tile>
            </Row>

            <Section
              title="Dropout"
              description={`How far participants get in ${studyLabel} before they leave. This works best if your study stores one response per trial or page.`}
            />
            <Row>
              <Tile
                title="Sessions still going after n Responses"
                description="The share of sessions with at least n responses. The steeper this drops, the earlier participants leave."
                width={HALF}
              >
                <Chart
                  type="line"
                  labels={stats.responsesPerSession.retention.map((entry) =>
                    String(entry.nResponses),
                  )}
                  datasets={[
                    {
                      name: "Sessions (%)",
                      values: stats.responsesPerSession.retention.map(
                        (entry) => entry.share * 100,
                      ),
                    },
                  ]}
                  colors={["green"]}
                  height={CHART_HEIGHT}
                  formatValue={(value) => `${value.toFixed(1)}%`}
                />
                {stats.responsesPerSession.retentionTruncated && (
                  <MessageBox
                    variant="info"
                    message="Only the beginning of the curve is shown, since sessions have very many responses."
                  />
                )}
              </Tile>
              <Tile
                title="Responses per Session"
                description="How many sessions have exactly n responses. Sessions without any responses are the ones at 0."
                width={HALF}
              >
                <Chart
                  type="bar"
                  labels={histogram.map((entry) => String(entry.nResponses))}
                  datasets={[
                    {
                      name: "Sessions",
                      values: histogram.map((entry) => entry.nSessions),
                    },
                  ]}
                  colors={["green"]}
                  height={CHART_HEIGHT}
                />
              </Tile>
            </Row>

            <Section
              title="Participants"
              description={`How often the same person takes part in your studies. Only sessions which are linked to a participant, e.g. via the linkParticipant option of the client, are counted. ${allData}`}
            />
            <Row>
              <StatTile
                label="Linked Participants"
                value={formatNumber(stats.participantLinking.nParticipants)}
              />
              <StatTile
                label="With multiple Sessions"
                value={formatNumber(
                  stats.participantLinking.nParticipantsWithMultipleSessions,
                )}
              />
              <StatTile
                label="Took the same Study twice"
                value={formatNumber(
                  stats.participantLinking.nParticipantsRepeatingAStudy,
                )}
              />
              <StatTile
                label="Took part in multiple Studies"
                value={formatNumber(
                  stats.participantLinking.nParticipantsWithMultipleStudies,
                )}
              />
            </Row>
            <Row alignTop>
              <Tile
                title="Sessions per Participant"
                description="How many participants took part n times."
                width={QUARTER_WIDE}
              >
                <DataTable
                  headers={["Sessions", "Participants"]}
                  rows={stats.participantLinking.sessionsPerParticipant.map(
                    (entry) => [
                      formatNumber(entry.nSessions),
                      formatNumber(entry.nParticipants),
                    ],
                  )}
                  emptyMessage="No sessions have been linked to a participant yet."
                />
              </Tile>
              <Tile
                title="Studies per Participant"
                description="How many participants took part in n different studies."
                width={QUARTER_WIDE}
              >
                <DataTable
                  headers={["Studies", "Participants"]}
                  rows={stats.participantLinking.studiesPerParticipant.map(
                    (entry) => [
                      formatNumber(entry.nStudies),
                      formatNumber(entry.nParticipants),
                    ],
                  )}
                  emptyMessage="No sessions have been linked to a participant yet."
                />
              </Tile>
              <Tile
                title="Moving between Studies"
                description="How often a participant's next session was in a different study than the one before."
                width={HALF}
              >
                <DataTable
                  headers={["From", "To", "Participants"]}
                  rows={stats.participantLinking.studyTransitions
                    .slice(0, N_TRANSITIONS)
                    .map((entry) => [
                      entry.fromStudyId,
                      entry.toStudyId,
                      formatNumber(entry.nTransitions),
                    ])}
                  emptyMessage="No participant has moved from one study to another yet."
                />
                {stats.participantLinking.studyTransitions.length >
                  N_TRANSITIONS && (
                  <Text variant="sm" mt="default">
                    Only the {N_TRANSITIONS} most common transitions are shown.
                  </Text>
                )}
              </Tile>
            </Row>

            <Section
              title="Recruitment"
              description={`Where the participants of ${studyLabel} came from, based on information the World-Wide-Lab client collects whenever a session is started. Sessions for which it is missing, e.g. sessions created directly via the API, are counted as (unknown).`}
            />
            <Row>
              <Breakdown
                title="Source URL"
                description={
                  <>
                    The address of the page your study ran on, without its{" "}
                    <ExternalLink href={MDN_QUERY_STRING}>
                      query string
                    </ExternalLink>
                    .
                  </>
                }
                breakdown={stats.recruitment.bySourceUrl}
              />
              <Breakdown
                title="Referrer"
                description={
                  <>
                    The page participants clicked the link to your study on,
                    taken from the{" "}
                    <ExternalLink href={MDN_REFERRER}>
                      Referer header
                    </ExternalLink>
                    . Participants who entered the address directly show up as
                    (none / direct).
                  </>
                }
                breakdown={stats.recruitment.byReferrer}
              />
              <Breakdown
                title="Source Parameter"
                description={
                  <>
                    The source, utm_source or ref{" "}
                    <ExternalLink href={MDN_QUERY_STRING}>
                      query parameter
                    </ExternalLink>{" "}
                    of your study's address, e.g. ?source=newsletter. Use it to
                    tell your recruitment channels apart.
                  </>
                }
                breakdown={stats.recruitment.bySourceParameter}
              />
            </Row>
          </>
        )}
      </Box>
    </Box>
  );
};

export default StatsPage;
