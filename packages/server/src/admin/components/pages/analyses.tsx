import {
  Box,
  H2,
  H4,
  H5,
  Label,
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
  Analyses,
  RecruitmentBreakdown,
} from "../../../analyses/index.js";
import { BarChart } from "../charts/BarChart.js";
import { LineChart } from "../charts/LineChart.js";
import { SessionsOverTimeChart } from "../charts/SessionsOverTimeChart.js";

const PAGE_NAME = "Analyses";
// Number of studies compared in the charts, tables always show all of them
const N_STUDIES_IN_CHARTS = 10;
// Number of bars shown in the responses per session chart
const N_BARS_IN_HISTOGRAM = 25;
const CHART_HEIGHT = 200;

const api = new ApiClient();

const timeframeOptions = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 365 days" },
];
const ALL_STUDIES = { value: "", label: "All studies" };

const Card = styled(Box)`
  position: relative;
  overflow: hidden;
`;
Card.defaultProps = {
  variant: "white",
  boxShadow: "card",
  mb: "lg",
  p: "lg",
};

// Half of a card's width on wider screens, e.g. for two charts next to
// each other
const Half = styled(Box)``;
Half.defaultProps = {
  width: [1, 1, 1 / 2],
  pr: "lg",
};

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

const LargeNumber = styled(Box)`
  font-size: 1.75rem;
  line-height: 1.2;
`;

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

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box width={[1 / 2, 1 / 2, 1 / 4]} pr="lg" pb="default">
    <Text variant="sm">{label}</Text>
    <LargeNumber>{value}</LargeNumber>
  </Box>
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
  hint: string;
  breakdown: RecruitmentBreakdown;
}> = ({ title, hint, breakdown }) => (
  <Box width={[1, 1, 1 / 3]} pr="lg">
    <H5>{title}</H5>
    <Text variant="sm" mb="default">
      {hint}
    </Text>
    <DataTable
      headers={["Value", "Sessions", "Share"]}
      rows={breakdown.entries.map((entry) => [
        entry.value,
        formatNumber(entry.nSessions),
        formatShare(entry.share),
      ])}
    />
    {breakdown.truncated && (
      <MessageBox
        variant="info"
        message="Only the most common values are counted, since there are very many different ones."
        mt="default"
      />
    )}
  </Box>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box flex flexDirection="row" flexWrap="wrap">
    {children}
  </Box>
);

export const AnalysesPage: React.FC = () => {
  const [studyId, setStudyId] = useState<string>(ALL_STUDIES.value);
  const [days, setDays] = useState<number>(30);
  const [analyses, setAnalyses] = useState<Analyses | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let outdated = false;

    api
      .getPage<Analyses>({
        pageName: PAGE_NAME,
        params: { days, ...(studyId ? { studyId } : {}) },
      })
      .then((response) => {
        if (!outdated) {
          setError(null);
          setAnalyses(response.data);
        }
      })
      .catch((error) => {
        console.error("Error retrieving analyses", error);
        if (!outdated) {
          setError(
            "The analyses could not be retrieved. Please check the server logs for more information.",
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
    ...(analyses?.studyIds ?? []).map((id) => ({ value: id, label: id })),
  ];
  const selectedStudy =
    studyOptions.find((option) => option.value === studyId) ?? ALL_STUDIES;
  const selectedTimeframe =
    timeframeOptions.find((option) => option.value === days) ??
    timeframeOptions[1];
  const studyLabel = studyId ? `study ${studyId}` : "all studies";

  const durationsByStudy = new Map(
    (analyses?.durationByStudy ?? []).map((entry) => [entry.studyId, entry]),
  );
  const histogram = fillHistogram(
    analyses?.responsesPerSession.histogram ?? [],
    N_BARS_IN_HISTOGRAM,
  );

  return (
    <Box variant="grey">
      <Box mx={[0, 0, 0, "auto"]} width={[1, 1, 1, 1024]} py="lg" px="lg">
        <Box flex flexDirection="row" flexWrap="wrap" alignItems="flex-end">
          <Box flexGrow={1} pr="lg">
            <H2>Analyses</H2>
          </Box>
          <Box width={[1 / 2, 1 / 2, 200]} pr="lg">
            <Label>Study</Label>
            <Select
              value={selectedStudy}
              options={studyOptions}
              onChange={(selected: { value: string }) =>
                setStudyId(selected?.value ?? "")
              }
            />
          </Box>
          <Box width={[1 / 2, 1 / 2, 200]}>
            <Label>Timeframe</Label>
            <Select
              value={selectedTimeframe}
              options={timeframeOptions}
              onChange={(selected: { value: number }) =>
                setDays(selected?.value ?? 30)
              }
            />
          </Box>
        </Box>
        <Text variant="sm" mt="default" mb="lg">
          Sessions over time, dropout and recruitment cover the selected study
          and timeframe, the other analyses cover all studies.
        </Text>

        {error && <MessageBox variant="danger" message={error} mb="lg" />}

        {!analyses ? (
          <Card>
            <Loader />
          </Card>
        ) : (
          <>
            <Card>
              <Row>
                <Half>
                  <H4>Sessions over Time</H4>
                  <Text variant="sm">
                    Sessions started and finished in {studyLabel}.
                  </Text>
                  <SessionsOverTimeChart
                    data={analyses.sessionsOverTime}
                    height={CHART_HEIGHT}
                  />
                </Half>
                <Half>
                  <H4>Completion Rate over Time</H4>
                  <Text variant="sm">
                    Share of finished sessions, days without sessions show 0%.
                  </Text>
                  <LineChart
                    labels={analyses.sessionsOverTime.map(
                      (entry) => entry.date,
                    )}
                    datasets={[
                      {
                        name: "Completion Rate (%)",
                        values: analyses.sessionsOverTime.map(
                          (entry) => (entry.completionRate ?? 0) * 100,
                        ),
                      },
                    ]}
                    colors={["green"]}
                    height={CHART_HEIGHT}
                    formatValue={(value) => `${value.toFixed(1)}%`}
                  />
                </Half>
              </Row>
            </Card>

            <Card>
              <H4 mb="default">Studies</H4>
              <Row>
                <Half>
                  <DataTable
                    headers={["Study", "Sessions", "Finished", "Ø Duration"]}
                    rows={analyses.completionByStudy.map((entry) => {
                      const duration = durationsByStudy.get(entry.studyId);
                      return [
                        entry.studyId,
                        formatNumber(entry.nSessions),
                        `${formatNumber(entry.nFinished)} (${formatShare(
                          entry.completionRate,
                        )})`,
                        duration
                          ? formatDuration(duration.meanDurationSeconds)
                          : "-",
                      ];
                    })}
                    emptyMessage="There are no studies yet."
                  />
                </Half>
                <Half>
                  {analyses.completionByStudy.length > 0 && (
                    <BarChart
                      labels={analyses.completionByStudy
                        .slice(0, N_STUDIES_IN_CHARTS)
                        .map((entry) => entry.studyId)}
                      values={analyses.completionByStudy
                        .slice(0, N_STUDIES_IN_CHARTS)
                        .map((entry) => (entry.completionRate ?? 0) * 100)}
                      name="Completion Rate (%)"
                      height={CHART_HEIGHT}
                      formatValue={(value) => `${value.toFixed(1)}%`}
                    />
                  )}
                </Half>
              </Row>
            </Card>

            <Card>
              <H4>Dropout</H4>
              <Text variant="sm" mb="default">
                How many responses the sessions in {studyLabel} contain, i.e.
                how far participants get before they leave.
              </Text>
              <Row>
                <Stat
                  label="Sessions"
                  value={formatNumber(analyses.responsesPerSession.nSessions)}
                />
                <Stat
                  label="Responses"
                  value={formatNumber(analyses.responsesPerSession.nResponses)}
                />
                <Stat
                  label="Responses per Session"
                  value={
                    analyses.responsesPerSession.meanResponsesPerSession ===
                    null
                      ? "-"
                      : analyses.responsesPerSession.meanResponsesPerSession.toFixed(
                          1,
                        )
                  }
                />
                <Stat
                  label="Sessions without Responses"
                  value={formatNumber(
                    analyses.responsesPerSession.histogram.find(
                      (entry) => entry.nResponses === 0,
                    )?.nSessions ?? 0,
                  )}
                />
              </Row>
              <Row>
                <Half>
                  <H5>Sessions still going after n Responses</H5>
                  <LineChart
                    labels={analyses.responsesPerSession.retention.map(
                      (entry) => String(entry.nResponses),
                    )}
                    datasets={[
                      {
                        name: "Sessions (%)",
                        values: analyses.responsesPerSession.retention.map(
                          (entry) => entry.share * 100,
                        ),
                      },
                    ]}
                    colors={["green"]}
                    height={CHART_HEIGHT}
                    formatValue={(value) => `${value.toFixed(1)}%`}
                  />
                  {analyses.responsesPerSession.retentionTruncated && (
                    <MessageBox
                      variant="info"
                      message="Only the beginning of the curve is shown, since sessions have very many responses."
                    />
                  )}
                </Half>
                <Half>
                  <H5>Number of Responses per Session</H5>
                  <BarChart
                    labels={histogram.map((entry) => String(entry.nResponses))}
                    values={histogram.map((entry) => entry.nSessions)}
                    name="Sessions"
                    height={CHART_HEIGHT}
                  />
                </Half>
              </Row>
            </Card>

            <Card>
              <H4>Participants</H4>
              <Text variant="sm" mb="default">
                How often participants take part. Only sessions which are linked
                to a participant are counted here.
              </Text>
              <Row>
                <Stat
                  label="Linked Participants"
                  value={formatNumber(
                    analyses.participantLinking.nParticipants,
                  )}
                />
                <Stat
                  label="With multiple Sessions"
                  value={formatNumber(
                    analyses.participantLinking
                      .nParticipantsWithMultipleSessions,
                  )}
                />
                <Stat
                  label="Repeating a Study"
                  value={formatNumber(
                    analyses.participantLinking.nParticipantsRepeatingAStudy,
                  )}
                />
                <Stat
                  label="In multiple Studies"
                  value={formatNumber(
                    analyses.participantLinking
                      .nParticipantsWithMultipleStudies,
                  )}
                />
              </Row>
              <Row>
                <Box width={[1, 1, 1 / 3]} pr="lg">
                  <H5 mb="default">Sessions per Participant</H5>
                  <DataTable
                    headers={["Sessions", "Participants"]}
                    rows={analyses.participantLinking.sessionsPerParticipant.map(
                      (entry) => [
                        formatNumber(entry.nSessions),
                        formatNumber(entry.nParticipants),
                      ],
                    )}
                    emptyMessage="No sessions have been linked to a participant yet."
                  />
                </Box>
                <Box width={[1, 1, 1 / 3]} pr="lg">
                  <H5 mb="default">Studies per Participant</H5>
                  <DataTable
                    headers={["Studies", "Participants"]}
                    rows={analyses.participantLinking.studiesPerParticipant.map(
                      (entry) => [
                        formatNumber(entry.nStudies),
                        formatNumber(entry.nParticipants),
                      ],
                    )}
                    emptyMessage="No sessions have been linked to a participant yet."
                  />
                </Box>
                <Box width={[1, 1, 1 / 3]}>
                  <H5 mb="default">Moving between Studies</H5>
                  <DataTable
                    headers={["From", "To", "Participants"]}
                    rows={analyses.participantLinking.studyTransitions.map(
                      (entry) => [
                        entry.fromStudyId,
                        entry.toStudyId,
                        formatNumber(entry.nTransitions),
                      ],
                    )}
                    emptyMessage="No participant has moved from one study to another yet."
                  />
                </Box>
              </Row>
            </Card>

            <Card>
              <H4>Recruitment</H4>
              <Text variant="sm" mb="default">
                Where the sessions in {studyLabel} are coming from, based on the
                information collected when a session is started.
              </Text>
              <Row>
                <Breakdown
                  title="Source URL"
                  hint="The page a study ran on, without query parameters."
                  breakdown={analyses.recruitment.bySourceUrl}
                />
                <Breakdown
                  title="Referrer"
                  hint="The website participants came from."
                  breakdown={analyses.recruitment.byReferrer}
                />
                <Breakdown
                  title="Source Parameter"
                  hint="The source, utm_source or ref parameter in the URL."
                  breakdown={analyses.recruitment.bySourceParameter}
                />
              </Row>
            </Card>
          </>
        )}
      </Box>
    </Box>
  );
};

export default AnalysesPage;
