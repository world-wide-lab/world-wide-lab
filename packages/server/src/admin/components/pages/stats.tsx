import {
  Box,
  Button,
  H2,
  H4,
  H5,
  Icon,
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

import type {
  ParticipantStats,
  RecruitmentBreakdown,
  RecruitmentStats,
  Stats,
} from "../../../stats/index.js";
import { Chart } from "../charts/Chart.js";
import { SessionsOverTimeChart } from "../charts/SessionsOverTimeChart.js";

const PAGE_NAME = "Stats";
// Number of studies compared in the chart, the table always shows all of them
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
const TWO_THIRDS = [1, 1, 2 / 3];
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

// The selection is kept in the page's URL, so that the stats of a single
// study can be linked to, e.g. from the page of that study.
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

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "-";
  }
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
  rows: Array<Array<React.ReactNode>>;
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
        {rows.map((row, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Rows have no id
          <TableRow key={rowIndex}>
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

// Where the sessions in the current scope came from
const Recruitment: React.FC<{
  recruitment: RecruitmentStats;
  scope: string;
}> = ({ recruitment, scope }) => (
  <>
    <Section
      title="Recruitment"
      description={`Where the participants of ${scope} came from, based on information the World-Wide-Lab client collects whenever a session is started. Sessions for which it is missing, e.g. sessions created directly via the API, are counted as (unknown).`}
    />
    <Row>
      <Breakdown
        title="Source URL"
        description={
          <>
            The address of the page your study ran on, without its{" "}
            <ExternalLink href={MDN_QUERY_STRING}>query string</ExternalLink>.
          </>
        }
        breakdown={recruitment.bySourceUrl}
      />
      <Breakdown
        title="Referrer"
        description={
          <>
            The page participants clicked the link to your study on, taken from
            the <ExternalLink href={MDN_REFERRER}>Referer header</ExternalLink>.
            Participants who entered the address directly show up as (none /
            direct).
          </>
        }
        breakdown={recruitment.byReferrer}
      />
      <Breakdown
        title="Source Parameter"
        description={
          <>
            The source, utm_source or ref{" "}
            <ExternalLink href={MDN_QUERY_STRING}>query parameter</ExternalLink>{" "}
            of your study's address, e.g. ?source=newsletter. Use it to tell
            your recruitment channels apart.
          </>
        }
        breakdown={recruitment.bySourceParameter}
      />
    </Row>
  </>
);

// The tables about participants, which are the same for a single study and
// for the overview, only their scope differs
const ParticipantTables: React.FC<{
  participants: ParticipantStats;
  sessionsLabel: string;
  studiesLabel: string;
  transitionsLabel: string;
}> = ({ participants, sessionsLabel, studiesLabel, transitionsLabel }) => (
  <Row alignTop>
    <Tile
      title="Sessions per Participant"
      description={sessionsLabel}
      width={QUARTER_WIDE}
    >
      <DataTable
        headers={["Sessions", "Participants"]}
        rows={participants.sessionsPerParticipant.map((entry) => [
          formatNumber(entry.nSessions),
          formatNumber(entry.nParticipants),
        ])}
        emptyMessage="No sessions have been linked to a participant yet."
      />
    </Tile>
    <Tile
      title="Studies per Participant"
      description={studiesLabel}
      width={QUARTER_WIDE}
    >
      <DataTable
        headers={["Studies", "Participants"]}
        rows={participants.studiesPerParticipant.map((entry) => [
          formatNumber(entry.nStudies),
          formatNumber(entry.nParticipants),
        ])}
        emptyMessage="No sessions have been linked to a participant yet."
      />
    </Tile>
    <Tile
      title="Moving between Studies"
      description={transitionsLabel}
      width={HALF}
    >
      <DataTable
        headers={["From", "To", "Participants"]}
        rows={participants.studyTransitions
          .slice(0, N_TRANSITIONS)
          .map((entry) => [
            entry.fromStudyId,
            entry.toStudyId,
            formatNumber(entry.nTransitions),
          ])}
        emptyMessage="No participant has moved from one study to another yet."
      />
      {participants.studyTransitions.length > N_TRANSITIONS && (
        <Text variant="sm" mt="default">
          Only the {N_TRANSITIONS} most common transitions are shown.
        </Text>
      )}
    </Tile>
  </Row>
);

// Sessions started and finished per day, plus the completion rate
const OverTime: React.FC<{ stats: Stats; scope: string }> = ({
  stats,
  scope,
}) => (
  <>
    <Section
      title="Over Time"
      description={`How the sessions of ${scope} developed within the selected timeframe.`}
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
  </>
);

// The stats of all studies together
const Overview: React.FC<{
  stats: Stats;
  onSelectStudy: (studyId: string) => void;
}> = ({ stats, onSelectStudy }) => {
  const studies = stats.studies ?? [];
  const nSessions = sumOf(stats.sessionsOverTime, "nSessions");
  const nFinished = sumOf(stats.sessionsOverTime, "nFinished");

  return (
    <>
      <Row>
        <StatTile label="Sessions" value={formatNumber(nSessions)} />
        <StatTile
          label="Finished Sessions"
          value={`${formatNumber(nFinished)} (${formatShare(
            nSessions > 0 ? nFinished / nSessions : null,
          )})`}
        />
        <StatTile label="Studies" value={formatNumber(stats.studyIds.length)} />
        <StatTile
          label="Linked Participants"
          value={formatNumber(stats.participants.nParticipants)}
        />
      </Row>

      <OverTime stats={stats} scope="all studies" />

      <Section
        title="Studies"
        description="How your studies compare to each other. Open a study to see how far participants get in it, where they came from and how they moved on."
      />
      <Row>
        <Tile
          title="Sessions per Study"
          description="A session's duration is measured from its start until its last response, so sessions without any responses are not included in it."
          width={TWO_THIRDS}
        >
          <DataTable
            headers={["Study", "Sessions", "Finished", "Mean Duration", ""]}
            rows={studies.map((entry) => [
              entry.studyId,
              formatNumber(entry.nSessions),
              `${formatNumber(entry.nFinished)} (${formatShare(
                entry.completionRate,
              )})`,
              formatDuration(entry.meanDurationSeconds),
              <Button
                key={entry.studyId}
                size="sm"
                rounded
                onClick={() => onSelectStudy(entry.studyId)}
              >
                <Icon icon="BarChart" /> Stats
              </Button>,
            ])}
            emptyMessage="There are no studies yet."
          />
        </Tile>
        <Tile
          title="Completion Rate per Study"
          description="The share of a study's sessions which were finished."
          width={THIRD}
        >
          <Chart
            type="bar"
            labels={studies
              .slice(0, N_STUDIES_IN_CHARTS)
              .map((entry) => entry.studyId)}
            datasets={[
              {
                name: "Completion Rate (%)",
                values: studies
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
        title="Participants"
        description="How often the same person takes part in your studies. Only sessions which are linked to a participant, e.g. via the linkParticipant option of the client, are counted."
      />
      <Row>
        <StatTile
          label="Linked Participants"
          value={formatNumber(stats.participants.nParticipants)}
        />
        <StatTile
          label="With multiple Sessions"
          value={formatNumber(
            stats.participants.nParticipantsWithMultipleSessions,
          )}
        />
        <StatTile
          label="Took the same Study twice"
          value={formatNumber(stats.participants.nParticipantsRepeatingAStudy)}
        />
        <StatTile
          label="Took part in multiple Studies"
          value={formatNumber(
            stats.participants.nParticipantsWithMultipleStudies,
          )}
        />
      </Row>
      <ParticipantTables
        participants={stats.participants}
        sessionsLabel="How many participants took part n times."
        studiesLabel="How many participants took part in n different studies."
        transitionsLabel="How often a participant's next session was in a different study than the one before."
      />

      <Recruitment recruitment={stats.recruitment} scope="all studies" />
    </>
  );
};

// The stats of a single study, including how far participants get in it
const Study: React.FC<{ stats: Stats; studyId: string }> = ({
  stats,
  studyId,
}) => {
  const study = stats.study;
  const dropout = stats.responsesPerSession;
  const scope = `the study ${studyId}`;

  const nSessions = dropout?.nSessions ?? 0;
  const nUnfinishedSessions = nSessions - (dropout?.nFinishedSessions ?? 0);
  // Charts are only drawn for the groups which have any sessions at all
  const groups = [
    {
      name: "Finished (%)",
      color: "green",
      exists: (dropout?.nFinishedSessions ?? 0) > 0,
      retention: (index: number) =>
        (dropout?.retention[index].finished ?? 0) * 100,
      histogram: (entry: { nFinished: number }) => entry.nFinished,
      barName: "Finished",
    },
    {
      name: "Unfinished (%)",
      color: "light-green",
      exists: nUnfinishedSessions > 0,
      retention: (index: number) =>
        (dropout?.retention[index].unfinished ?? 0) * 100,
      histogram: (entry: { nUnfinished: number }) => entry.nUnfinished,
      barName: "Unfinished",
    },
  ].filter((group) => group.exists);

  return (
    <>
      <Row>
        <StatTile
          label="Sessions"
          value={formatNumber(study?.nSessions ?? 0)}
        />
        <StatTile
          label="Finished Sessions"
          value={`${formatNumber(study?.nFinished ?? 0)} (${formatShare(
            study?.completionRate ?? null,
          )})`}
        />
        <StatTile
          label="Responses"
          value={formatNumber(dropout?.nResponses ?? 0)}
        />
        <StatTile
          label="Mean Session Duration"
          value={formatDuration(study?.meanDurationSeconds ?? null)}
        />
      </Row>

      <OverTime stats={stats} scope={scope} />

      <Section
        title="Dropout"
        description={`How far participants get in ${studyId} before they leave, on average ${
          dropout?.meanResponsesPerSession?.toFixed(1) ?? "0"
        } responses per session. Finished and unfinished sessions are counted separately, since the length of finished sessions can vary just as much. This works best if your study stores one response per trial or page.`}
      />
      <Row>
        <Tile
          title="Sessions still going after n Responses"
          description="The share of the finished and of the unfinished sessions with at least n responses, each within their own group."
          width={HALF}
        >
          <Chart
            type="line"
            labels={(dropout?.retention ?? []).map((entry) =>
              String(entry.nResponses),
            )}
            datasets={groups.map((group) => ({
              name: group.name,
              values: (dropout?.retention ?? []).map((_, index) =>
                group.retention(index),
              ),
            }))}
            colors={groups.map((group) => group.color)}
            height={CHART_HEIGHT}
            formatValue={(value) => `${value.toFixed(1)}%`}
          />
          {dropout?.retentionTruncated && (
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
            labels={(dropout?.histogram ?? [])
              .slice(0, N_BARS_IN_HISTOGRAM)
              .map((entry) => String(entry.nResponses))}
            datasets={groups.map((group) => ({
              name: group.barName,
              values: (dropout?.histogram ?? [])
                .slice(0, N_BARS_IN_HISTOGRAM)
                .map((entry) => group.histogram(entry)),
            }))}
            colors={groups.map((group) => group.color)}
            height={CHART_HEIGHT}
          />
        </Tile>
      </Row>

      <Section
        title="Participants"
        description={`The participants of ${studyId} and what else they take part in. Only sessions which are linked to a participant, e.g. via the linkParticipant option of the client, are counted.`}
      />
      <Row>
        <StatTile
          label="Linked Participants"
          value={formatNumber(stats.participants.nParticipants)}
        />
        <StatTile
          label="Took this Study more than once"
          value={formatNumber(
            stats.participants.nParticipantsWithMultipleSessions,
          )}
        />
        <StatTile
          label="Also took other Studies"
          value={formatNumber(
            stats.participants.nParticipantsWithMultipleStudies,
          )}
        />
      </Row>
      <ParticipantTables
        participants={stats.participants}
        sessionsLabel={`How many participants took part in ${studyId} n times.`}
        studiesLabel={`In how many studies the participants of ${studyId} took part, including this one.`}
        transitionsLabel={`How often participants moved to or from ${studyId}.`}
      />

      <Recruitment recruitment={stats.recruitment} scope={scope} />
    </>
  );
};

export const StatsPage: React.FC = () => {
  const initialFilters = getFiltersFromUrl();
  const [studyId, setStudyId] = useState<string>(initialFilters.studyId);
  const [days, setDays] = useState<number>(initialFilters.days);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let outdated = false;

    // Keep the selection in the URL, so that the current view can be
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

  return (
    <Box variant="grey">
      <Box mx={[0, 0, 0, "auto"]} width={[1, 1, 1, 1024]} py="lg" px="lg">
        <Box flex flexDirection="row" flexWrap="wrap" alignItems="flex-end">
          <Box flexGrow={1} px="sm">
            <H2>{studyId ? `Stats: ${studyId}` : "Stats"}</H2>
          </Box>
          {/* Only the stats of a single study can be switched to another one,
              the overview always covers every study */}
          {studyId && (
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
          )}
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
        ) : stats.options.studyId ? (
          <Study stats={stats} studyId={stats.options.studyId} />
        ) : (
          <Overview stats={stats} onSelectStudy={setStudyId} />
        )}
      </Box>
    </Box>
  );
};

export default StatsPage;
