import "./setup_env";

import { version as packageVersion } from "../package.json";

import {
  Client as DevClient,
  Participant,
  Session,
  WorldWideLabError,
} from "../src";

import {
  type Server,
  init as initDev,
} from "@world-wide-lab/server/src/init.ts";

const Client = process.env.CLIENT === "build" ? import("../dist") : DevClient;

const API_KEY = process.env.DEFAULT_API_KEY;

describe("Client", () => {
  let server: Server;
  let client: DevClient;
  beforeAll(async () => {
    server = await initDev();

    // @ts-ignore - We know that the server will only be returned after listen() is finished
    client = new Client({ url: `http://localhost:${server.address().port}` });

    global.fetch = vi.fn(fetch);
  }, 10000);
  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(undefined);
        }
      });
    });
  }, 10000);

  it("should create a new participant", async () => {
    const participant = await client.createParticipant();

    expect(participant instanceof Participant).toBe(true);
    expect(participant.participantId).toBeDefined();
  });

  it("should start a new session (without a linked participant)", async () => {
    global.window = {
      location: {
        href: "https://worldwidelab.org/?myId=123&otherId=test",
        search: "?myId=123&otherId=test",
      },
    } as any;

    const session = await client.createSession({ studyId: "example" });

    expect(session instanceof Session).toBe(true);
    expect(session.sessionId).toBeDefined();

    // @ts-ignore Complicated to get typescript to acknowledge that fetch is indeed also a mock function now
    const sessionParams = JSON.parse(global.fetch.mock.calls.pop()[1].body);

    // Version should be up to date
    expect(sessionParams.clientMetadata.version).toBe(packageVersion);

    sessionParams.clientMetadata.version = "VERSION";
    expect(sessionParams).toMatchSnapshot();
  });

  it("should start a new session (with a linked participant)", async () => {
    const participant = await client.createParticipant();
    const session = await client.createSession({
      studyId: "example",
      participant,
    });

    expect(session instanceof Session).toBe(true);
    expect(session.sessionId).toBeDefined();
    expect(session.participant instanceof Participant).toBe(true);
    expect(session.participant?.participantId).toBeDefined();
  });

  it("should throw an error when session creation fails", async () => {
    await expect(async () => {
      const session = await client.createSession({
        studyId: "non-existent-study",
      });
    }).rejects.toThrow("Failed to initialize Session");
  });

  it("should store responses", async () => {
    const studyId = "studyId-check-response-storage";

    // Create a new study
    const createStudyResponseJson = await (
      await client.call("POST", "/study/", { studyId })
    ).json();
    expect(createStudyResponseJson.studyId).toBe(studyId);
    expect(Object.keys(createStudyResponseJson)).toMatchSnapshot();

    const session = await client.createSession({ studyId });

    expect(
      await session.response({
        name: "example_name",
        payload: { ex_key: "ex_value" },
      }),
    ).toBe(true);
    expect(
      await session.response({
        name: undefined,
        payload: { key_n1: "no-name", numerical: 1 },
      }),
    ).toBe(true);

    // Download export from database
    const responseJson = await (
      await client.call(
        "GET",
        `/study/${studyId}/data/responses-raw/json`,
        undefined,
        {
          // Manually set headers to add authorization one
          headers: {
            ContentType: "application/json",
            Authorization: `Bearer ${API_KEY}`,
          },
        },
      )
    ).json();

    expect(responseJson.length).toBe(2);

    const variyngKeys = ["responseId", "sessionId", "updatedAt", "createdAt"];

    for (const response of responseJson) {
      for (const key of variyngKeys) {
        response[key] = "overwritten-as-it-varies";
      }
    }
    expect(responseJson).toMatchSnapshot();
    expect(Object.keys(responseJson)).toMatchSnapshot();
  });

  it("should store and retrieve participant data", async () => {
    const participant = await client.createParticipant();

    const participantUpdateResult = await participant.update({
      privateInfo: {
        name: "John Doe",
      },
      publicInfo: {
        condition: "A",
      },
    });
    expect(participantUpdateResult).toBe(true);

    const publicParticipantInfo = await participant.getPublicInfo();
    expect(publicParticipantInfo.publicInfo.condition).toBe("A");
  });

  it("should store participant data upon creation", async () => {
    const participant = await client.createParticipant({
      privateInfo: {
        name: "John Doe",
      },
      publicInfo: {
        condition: "B",
      },
    });

    const publicParticipantInfo = await participant.getPublicInfo();
    expect(publicParticipantInfo.publicInfo.condition).toBe("B");
  });

  it("should store and retrieve session data", async () => {
    const session = await client.createSession({ studyId: "example" });

    const sessionUpdateResult = await session.update({
      privateInfo: {
        name: "Session No Uno",
      },
      publicInfo: {
        condition: "A",
      },
    });
    expect(sessionUpdateResult).toBe(true);

    const publicSessionInfo = await session.getPublicInfo();
    expect(publicSessionInfo.publicInfo.condition).toBe("A");
  });

  it("should store session data upon creation", async () => {
    const session = await client.createSession({
      studyId: "example",

      privateInfo: {
        name: "Session No Duo",
      },
      publicInfo: {
        condition: "C",
      },
    });

    const publicSessionInfo = await session.getPublicInfo();
    expect(publicSessionInfo.publicInfo.condition).toBe("C");
  });

  it("should finish a session", async () => {
    const session = await client.createSession({ studyId: "example" });

    const sessionFinishResult = await session.finish();
    expect(sessionFinishResult).toBe(true);
  });

  it("should add & retrieve scores from the leaderboard", async () => {
    const session = await client.createSession({ studyId: "example" });

    const tsBeforeScores = new Date();

    const addScoreResult = await session.addScoreToLeaderboard("lb-test", {
      score: 1337,
      publicIndividualName: "Kevin Flynn",
      publicGroupName: "Encom",
    });
    expect(addScoreResult).toBeDefined();
    const addScoreResult2 = await session.addScoreToLeaderboard("lb-test", {
      score: 663,
      publicIndividualName: "Sam Flynn",
      publicGroupName: "Encom",
    });
    expect(addScoreResult2).toBeDefined();

    const getIndividualScoresResult =
      await client.getLeaderboardScores("lb-test");
    expect(getIndividualScoresResult).toMatchSnapshot();

    const getGroupScoresResult = await client.getLeaderboardScores(
      "lb-test",
      "groups",
      { aggregate: "sum" },
    );
    expect(getGroupScoresResult).toMatchSnapshot();

    const tsFuture = new Date();
    tsFuture.setSeconds(tsFuture.getSeconds() + 10);

    // Older timestamp should work just fine
    const getIndividualScoresResultWithTimestamp =
      await client.getLeaderboardScores("lb-test", "individual", {
        updatedAfter: tsBeforeScores,
      });
    expect(getIndividualScoresResultWithTimestamp).toMatchObject(
      getIndividualScoresResult,
    );

    // Future timestamp should return empty leaderboard
    const getIndividualScoresResultInFuture = await client.getLeaderboardScores(
      "lb-test",
      "individual",
      { updatedAfter: tsFuture },
    );
    expect(getIndividualScoresResultInFuture).toMatchObject({ scores: [] });
  });

  it("should update a score on the leaderboard", async () => {
    const session = await client.createSession({ studyId: "example" });

    const leaderboardScoreId = await session.addScoreToLeaderboard("lb-test", {
      score: 1337,
      publicIndividualName: "Legolas",
    });
    expect(leaderboardScoreId).toBeDefined();

    const updateScoreResult = await session.updateLeaderboardScore(
      "lb-test",
      leaderboardScoreId,
      {
        score: 1500,
        publicIndividualName: "Gimli",
        publicGroupName: "Die Gefährten",
      },
    );
    expect(updateScoreResult).toBe(true);

    const getIndividualScoresResult =
      await client.getLeaderboardScores("lb-test");

    expect(getIndividualScoresResult.scores).toEqual(expect.arrayContaining([
      {
        score: 1500,
        publicIndividualName: "Gimli",
        publicGroupName: "Die Gefährten",
      },
    ]));
    expect([
      {
        score: 1337,
        publicIndividualName: "Legolas",
      },
    ]).not.toEqual(expect.arrayContaining(getIndividualScoresResult.scores));
    expect([
      {
        score: 1337,
        publicIndividualName: "Legolas",
        publicGroupName: "Die Gefährten",
      },
    ]).not.toEqual(expect.arrayContaining(getIndividualScoresResult.scores));
  });

  it("should return the leaderboardScoreId when adding a score to the leaderboard", async () => {
    const session = await client.createSession({ studyId: "example" });

    const leaderboardScoreId = await session.addScoreToLeaderboard("lb-test", {
      score: 1337,
      publicIndividualName: "Kevin Flynn",
      publicGroupName: "Encom",
    });
    expect(leaderboardScoreId).toBeDefined();
    expect(typeof leaderboardScoreId).toBe("number");
  });
});
