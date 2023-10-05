// Set up fake environment variables
import "./setup_env";

import { Client as DevClient, Participant, Session } from "../src";

// import { init as initProd } from '@world-wide-lab/server/dist/init.js'
import { init as initDev, Server } from "@world-wide-lab/server/src/init.ts";

const Client = process.env.CLIENT === "build" ? import("../dist") : DevClient;

describe("Client", () => {
  let server: Server;
  let client: DevClient;
  beforeAll(async () => {
    server = await initDev();

    // @ts-ignore - We know that the server will only be returned after listen() is finished
    client = new Client({ url: `http://localhost:${server.address().port}` });
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
    const session = await client.createSession({ studyId: "example" });

    expect(session instanceof Session).toBe(true);
    expect(session.sessionId).toBeDefined();
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

  it("should store responses", async () => {
    const session = await client.createSession({ studyId: "example" });

    expect(
      await session.response({
        name: "example_name",
        payload: { ex_key: "ex_value" },
      }),
    ).toBe(true);
  });

  it("should store and retrieve participant data", async () => {
    const participant = await client.createParticipant();

    const participantUpdateResult = await participant.setMetadata({
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

  it("should store and retrieve session data", async () => {
    const session = await client.createSession({ studyId: "example" });

    const sessionUpdateResult = await session.setMetadata({
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

  it("should finish a session", async () => {
    const session = await client.createSession({ studyId: "example" });

    const sessionFinishResult = await session.finish();
    expect(sessionFinishResult).toBe(true);
  });
});
