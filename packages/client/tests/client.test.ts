// Set up fake environment variables
import "./setup_env";

import { Client as DevClient, Participant, Run } from "../src";

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

  it("should start a new run (without a linked participant)", async () => {
    const run = await client.createRun({ studyId: "example" });

    expect(run instanceof Run).toBe(true);
    expect(run.runId).toBeDefined();
  });

  it("should start a new run (with a linked participant)", async () => {
    const participant = await client.createParticipant();
    const run = await client.createRun({ studyId: "example", participant });

    expect(run instanceof Run).toBe(true);
    expect(run.runId).toBeDefined();
    expect(run.participant instanceof Participant).toBe(true);
    expect(run.participant?.participantId).toBeDefined();
  });

  it("should store responses", async () => {
    const run = await client.createRun({ studyId: "example" });

    expect(
      await run.response({
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

  it("should store and retrieve run data", async () => {
    const run = await client.createRun({ studyId: "example" });

    const runUpdateResult = await run.setMetadata({
      privateInfo: {
        name: "Run No Uno",
      },
      publicInfo: {
        condition: "A",
      },
    });
    expect(runUpdateResult).toBe(true);

    const publicRunInfo = await run.getPublicInfo();
    expect(publicRunInfo.publicInfo.condition).toBe("A");
  });

  it("should finish a run", async () => {
    const run = await client.createRun({ studyId: "example" });

    const runFinishResult = await run.finish();
    expect(runFinishResult).toBe(true);
  });
});
