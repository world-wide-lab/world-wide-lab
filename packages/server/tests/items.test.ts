// Set up fake environment variables
import "./setup_env";

import request from "supertest";
import { deleteStudyItems } from "../src/admin/handlers/study";
import app from "../src/app";
import sequelize from "../src/db";

const endpoint = request(app);

const STUDY_ID = "items-study";
const OTHER_STUDY_ID = "items-other-study";
const API_KEY = process.env.DEFAULT_API_KEY;
const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

async function createSession(
  participantId?: string,
  studyId: string = STUDY_ID,
): Promise<string> {
  const session: any = await sequelize.models.Session.create({
    studyId,
    participantId,
  });
  return session.sessionId;
}

async function createPool(
  poolId: string,
  options: { [key: string]: any } = {},
) {
  await sequelize.models.ItemPool.create({ poolId, ...options });
}

async function createItem(poolId: string, options: { [key: string]: any } = {}) {
  const item: any = await sequelize.models.Item.create({
    poolId,
    publicPayload: { text: "hello" },
    ...options,
  });
  return item.itemId;
}

function getItem(itemId: string): Promise<any> {
  return sequelize.models.Item.findOne({ where: { itemId } });
}

describe("Items", () => {
  beforeAll(async () => {
    await sequelize.sync();
    await sequelize.models.Study.create({ studyId: STUDY_ID });
    await sequelize.models.Study.create({ studyId: OTHER_STUDY_ID });
  });

  describe("POST /item-pool/:poolId/item", () => {
    const POOL_ID = "contribute";

    beforeAll(async () => {
      await createPool(POOL_ID);
    });

    it("should contribute an item", async () => {
      const sessionId = await createSession();
      const response = await endpoint
        .post(`/v1/item-pool/${POOL_ID}/item`)
        .send({ publicPayload: { text: "a contribution" }, sessionId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty("itemId");
      // Contributions are never visible until the pool says they are
      expect(response.body.status).toBe("pending");

      const item = await getItem(response.body.itemId);
      expect(item).toHaveProperty("sourceSessionId", sessionId);
      expect(item).toHaveProperty("generation", 0);
    });

    it("should contribute an item without a session", async () => {
      const response = await endpoint
        .post(`/v1/item-pool/${POOL_ID}/item`)
        .send({ publicPayload: { text: "anonymous" } });

      expect(response.status).toBe(200);
      const item = await getItem(response.body.itemId);
      expect(item).toHaveProperty("sourceSessionId", null);
    });

    it("should count generations up from the parent item", async () => {
      const parentItemId = await createItem(POOL_ID, { generation: 2 });
      const response = await endpoint
        .post(`/v1/item-pool/${POOL_ID}/item`)
        .send({ publicPayload: { text: "next link" }, parentItemId });

      expect(response.status).toBe(200);
      const item = await getItem(response.body.itemId);
      expect(item).toHaveProperty("generation", 3);
      expect(item).toHaveProperty("parentItemId", parentItemId);
    });

    it("should reject an unknown poolId", async () => {
      const response = await endpoint
        .post("/v1/item-pool/does-not-exist/item")
        .send({ publicPayload: { text: "nowhere to go" } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown poolId");
    });

    it("should reject an unknown sessionId", async () => {
      const response = await endpoint
        .post(`/v1/item-pool/${POOL_ID}/item`)
        .send({
          publicPayload: { text: "who?" },
          sessionId: NON_EXISTENT_UUID,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown sessionId");
    });

    it("should reject an unknown parentItemId", async () => {
      const response = await endpoint
        .post(`/v1/item-pool/${POOL_ID}/item`)
        .send({
          publicPayload: { text: "orphan" },
          parentItemId: NON_EXISTENT_UUID,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown parentItemId");
    });

    it("should reject a contribution without a payload", async () => {
      const response = await endpoint
        .post(`/v1/item-pool/${POOL_ID}/item`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("should reject a contribution to a closed pool", async () => {
      await createPool("closed-pool", { moderation: "closed" });
      const response = await endpoint
        .post("/v1/item-pool/closed-pool/item")
        .send({ publicPayload: { text: "let me in" } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("closed");
    });

    it("should reject a payload above the pool's limit", async () => {
      await createPool("tiny-payloads", { maxPayloadBytes: 32 });
      const response = await endpoint
        .post("/v1/item-pool/tiny-payloads/item")
        .send({ publicPayload: { text: "x".repeat(100) } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("too large");
    });
  });

  describe("GET /item-pool/:poolId/draw", () => {
    it("should not hand out items nobody has approved", async () => {
      await createPool("reviewed-pool");
      await createItem("reviewed-pool");
      const sessionId = await createSession();

      const response = await endpoint
        .get(`/v1/item-pool/reviewed-pool/draw?sessionId=${sessionId}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.draws).toEqual([]);
    });

    it("should hand out approved items", async () => {
      await createPool("approved-pool");
      const itemId = await createItem("approved-pool", { status: "approved" });
      const sessionId = await createSession();

      const response = await endpoint
        .get(`/v1/item-pool/approved-pool/draw?sessionId=${sessionId}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.draws).toHaveLength(1);
      const draw = response.body.draws[0];
      expect(draw.itemId).toBe(itemId);
      expect(draw.publicPayload).toEqual({ text: "hello" });
      expect(draw).toHaveProperty("drawId");
      expect(draw).toHaveProperty("generation", 0);

      // Nothing internal ever leaves the server
      expect(draw).not.toHaveProperty("sourceSessionId");
      expect(draw).not.toHaveProperty("privateInfo");
      expect(draw).not.toHaveProperty("timesDrawn");

      const item = await getItem(itemId);
      expect(item).toHaveProperty("timesDrawn", 1);

      const drawRow = await sequelize.models.ItemDraw.findOne({
        where: { drawId: draw.drawId },
      });
      expect(drawRow).toHaveProperty("sessionId", sessionId);
      expect(drawRow).toHaveProperty("status", "served");
    });

    it("should hand out pending items in an unreviewed pool", async () => {
      await createPool("unreviewed-pool", { moderation: "unreviewed" });
      await createItem("unreviewed-pool");
      const sessionId = await createSession();

      const response = await endpoint
        .get(`/v1/item-pool/unreviewed-pool/draw?sessionId=${sessionId}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.draws).toHaveLength(1);
    });

    it("should hide unapproved items again when a pool is set to reviewed", async () => {
      await createPool("kill-switch", { moderation: "unreviewed" });
      await createItem("kill-switch");
      const approvedItemId = await createItem("kill-switch", {
        status: "approved",
      });

      await sequelize.models.ItemPool.update(
        { moderation: "reviewed" },
        { where: { poolId: "kill-switch" } },
      );

      const sessionId = await createSession();
      const response = await endpoint
        .get(`/v1/item-pool/kill-switch/draw?sessionId=${sessionId}&count=10`)
        .send();

      expect(response.status).toBe(200);
      // Only the item somebody explicitly approved survives the switch
      expect(response.body.draws).toHaveLength(1);
      expect(response.body.draws[0].itemId).toBe(approvedItemId);
    });

    it("should not hand out an item to the same session twice", async () => {
      await createPool("exclude-seen");
      await createItem("exclude-seen", { status: "approved" });
      const sessionId = await createSession();

      const first = await endpoint
        .get(`/v1/item-pool/exclude-seen/draw?sessionId=${sessionId}`)
        .send();
      expect(first.body.draws).toHaveLength(1);

      const second = await endpoint
        .get(`/v1/item-pool/exclude-seen/draw?sessionId=${sessionId}`)
        .send();
      expect(second.body.draws).toHaveLength(0);

      // …unless the study explicitly asks for repeats
      const third = await endpoint
        .get(
          `/v1/item-pool/exclude-seen/draw?sessionId=${sessionId}&excludeSeen=false`,
        )
        .send();
      expect(third.body.draws).toHaveLength(1);
    });

    it("should not hand a session its own contribution", async () => {
      await createPool("exclude-own");
      const sessionId = await createSession();
      await createItem("exclude-own", {
        status: "approved",
        sourceSessionId: sessionId,
      });

      const response = await endpoint
        .get(`/v1/item-pool/exclude-own/draw?sessionId=${sessionId}`)
        .send();
      expect(response.body.draws).toHaveLength(0);

      const withOwn = await endpoint
        .get(
          `/v1/item-pool/exclude-own/draw?sessionId=${sessionId}&excludeOwn=false`,
        )
        .send();
      expect(withOwn.body.draws).toHaveLength(1);
    });

    it("should not hand a participant what they contributed in another session", async () => {
      const participant: any = await sequelize.models.Participant.create({});
      const firstSessionId = await createSession(participant.participantId);
      const secondSessionId = await createSession(participant.participantId);

      await createPool("exclude-participant");
      await createItem("exclude-participant", {
        status: "approved",
        sourceSessionId: firstSessionId,
      });

      const response = await endpoint
        .get(`/v1/item-pool/exclude-participant/draw?sessionId=${secondSessionId}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.draws).toHaveLength(0);
    });

    it("should respect maxDrawsPerItem", async () => {
      await createPool("draw-cap");
      await createItem("draw-cap", { status: "approved" });

      const first = await endpoint
        .get(
          `/v1/item-pool/draw-cap/draw?sessionId=${await createSession()}&maxDrawsPerItem=1`,
        )
        .send();
      expect(first.body.draws).toHaveLength(1);

      const second = await endpoint
        .get(
          `/v1/item-pool/draw-cap/draw?sessionId=${await createSession()}&maxDrawsPerItem=1`,
        )
        .send();
      expect(second.body.draws).toHaveLength(0);
    });

    it("should respect maxCompletionsPerItem", async () => {
      await createPool("completion-cap");
      const itemId = await createItem("completion-cap", { status: "approved" });
      const sessionId = await createSession();

      const drawn = await endpoint
        .get(`/v1/item-pool/completion-cap/draw?sessionId=${sessionId}`)
        .send();
      const { drawId } = drawn.body.draws[0];

      await endpoint
        .post(`/v1/draw/${drawId}/complete`)
        .send({ sessionId })
        .expect(200);

      const response = await endpoint
        .get(
          `/v1/item-pool/completion-cap/draw?sessionId=${await createSession()}&maxCompletionsPerItem=1`,
        )
        .send();
      expect(response.body.draws).toHaveLength(0);

      const item = await getItem(itemId);
      expect(item).toHaveProperty("timesCompleted", 1);
    });

    it("should hand out the least-drawn item first", async () => {
      await createPool("least-drawn-pool");
      const hotItemId = await createItem("least-drawn-pool", {
        status: "approved",
        timesDrawn: 5,
      });
      const coldItemId = await createItem("least-drawn-pool", {
        status: "approved",
        timesDrawn: 0,
      });

      const response = await endpoint
        .get(
          `/v1/item-pool/least-drawn-pool/draw?sessionId=${await createSession()}&policy=least-drawn`,
        )
        .send();

      expect(response.body.draws).toHaveLength(1);
      expect(response.body.draws[0].itemId).toBe(coldItemId);
      expect(response.body.draws[0].itemId).not.toBe(hotItemId);
    });

    it("should filter by generation", async () => {
      await createPool("generations");
      await createItem("generations", { status: "approved", generation: 0 });
      const lateItemId = await createItem("generations", {
        status: "approved",
        generation: 4,
      });

      const response = await endpoint
        .get(
          `/v1/item-pool/generations/draw?sessionId=${await createSession()}&minGeneration=3&count=10`,
        )
        .send();

      expect(response.body.draws).toHaveLength(1);
      expect(response.body.draws[0].itemId).toBe(lateItemId);
    });

    it("should draw several items at once", async () => {
      await createPool("many");
      for (let i = 0; i < 5; i++) {
        await createItem("many", { status: "approved" });
      }

      const response = await endpoint
        .get(`/v1/item-pool/many/draw?sessionId=${await createSession()}&count=3`)
        .send();

      expect(response.body.draws).toHaveLength(3);
      const itemIds = response.body.draws.map((draw: any) => draw.itemId);
      expect(new Set(itemIds).size).toBe(3);
    });

    it("should never serve an item more often than the cap allows, even in parallel", async () => {
      await createPool("race");
      const itemId = await createItem("race", { status: "approved" });

      const sessionIds = await Promise.all(
        [0, 1, 2, 3, 4].map(() => createSession()),
      );
      const responses = await Promise.all(
        sessionIds.map((sessionId) =>
          endpoint
            .get(
              `/v1/item-pool/race/draw?sessionId=${sessionId}&maxDrawsPerItem=2`,
            )
            .send(),
        ),
      );

      const totalDraws = responses.reduce(
        (sum, response) => sum + response.body.draws.length,
        0,
      );
      expect(totalDraws).toBe(2);

      const item = await getItem(itemId);
      expect(item).toHaveProperty("timesDrawn", 2);
      expect(
        await sequelize.models.ItemDraw.count({ where: { itemId } }),
      ).toBe(2);
    });

    it("should reject an unknown poolId", async () => {
      const response = await endpoint
        .get(`/v1/item-pool/nope/draw?sessionId=${await createSession()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown poolId");
    });

    it("should reject an unknown sessionId", async () => {
      await createPool("unknown-session");
      const response = await endpoint
        .get(
          `/v1/item-pool/unknown-session/draw?sessionId=${NON_EXISTENT_UUID}`,
        )
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown sessionId");
    });

    it("should reject a draw without a sessionId", async () => {
      await createPool("no-session");
      const response = await endpoint
        .get("/v1/item-pool/no-session/draw")
        .send();

      expect(response.status).toBe(400);
    });
  });

  describe("POST /response with a drawId", () => {
    let poolCount = 0;

    // Draw a single item from a pool of its own, so that every test knows
    // exactly which item it is reacting to
    async function drawOne(sessionId: string) {
      const poolId = `reactions-${poolCount++}`;
      await createPool(poolId);
      const itemId = await createItem(poolId, { status: "approved" });
      const response = await endpoint
        .get(`/v1/item-pool/${poolId}/draw?sessionId=${sessionId}`)
        .send();
      return { itemId, drawId: response.body.draws[0].drawId };
    }

    it("should link the response to the draw and complete it", async () => {
      const sessionId = await createSession();
      const { itemId, drawId } = await drawOne(sessionId);

      const response = await endpoint.post("/v1/response").send({
        sessionId,
        name: "guess",
        payload: { guess: "a house" },
        drawId,
      });

      expect(response.status).toBe(200);

      const stored = await sequelize.models.Response.findOne({
        where: { responseId: response.body.responseId },
      });
      expect(stored).toHaveProperty("drawId", drawId);

      const draw = await sequelize.models.ItemDraw.findOne({
        where: { drawId },
      });
      expect(draw).toHaveProperty("status", "completed");
      expect(await getItem(itemId)).toHaveProperty("timesCompleted", 1);
    });

    it("should leave the draw open when completesDraw is false", async () => {
      const sessionId = await createSession();
      const { itemId, drawId } = await drawOne(sessionId);

      await endpoint
        .post("/v1/response")
        .send({
          sessionId,
          name: "rating",
          payload: { rating: 3 },
          drawId,
          completesDraw: false,
        })
        .expect(200);

      let draw = await sequelize.models.ItemDraw.findOne({ where: { drawId } });
      expect(draw).toHaveProperty("status", "served");
      expect(await getItem(itemId)).toHaveProperty("timesCompleted", 0);

      // The last trial of the reaction closes the draw
      await endpoint
        .post("/v1/response")
        .send({ sessionId, name: "why", payload: { text: "because" }, drawId })
        .expect(200);

      draw = await sequelize.models.ItemDraw.findOne({ where: { drawId } });
      expect(draw).toHaveProperty("status", "completed");
      expect(await getItem(itemId)).toHaveProperty("timesCompleted", 1);
    });

    it("should only count a completion once", async () => {
      const sessionId = await createSession();
      const { itemId, drawId } = await drawOne(sessionId);

      await endpoint
        .post("/v1/response")
        .send({ sessionId, name: "first", payload: {}, drawId })
        .expect(200);
      await endpoint
        .post("/v1/response")
        .send({ sessionId, name: "second", payload: {}, drawId })
        .expect(200);
      await endpoint
        .post(`/v1/draw/${drawId}/complete`)
        .send({ sessionId })
        .expect(200);

      expect(await getItem(itemId)).toHaveProperty("timesCompleted", 1);
    });

    it("should reject an unknown drawId", async () => {
      const sessionId = await createSession();
      const response = await endpoint.post("/v1/response").send({
        sessionId,
        name: "guess",
        payload: {},
        drawId: NON_EXISTENT_UUID,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown drawId");
    });

    it("should reject a draw belonging to another session", async () => {
      const sessionId = await createSession();
      const { drawId } = await drawOne(sessionId);
      const otherSessionId = await createSession();

      const response = await endpoint.post("/v1/response").send({
        sessionId: otherSessionId,
        name: "guess",
        payload: {},
        drawId,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown drawId");

      // Nothing should have been written for the failed attempt
      expect(
        await sequelize.models.Response.count({
          where: { sessionId: otherSessionId },
        }),
      ).toBe(0);
    });
  });

  describe("POST /draw/:drawId/complete", () => {
    it("should reject a draw belonging to another session", async () => {
      await createPool("complete-pool");
      await createItem("complete-pool", { status: "approved" });
      const sessionId = await createSession();

      const drawn = await endpoint
        .get(`/v1/item-pool/complete-pool/draw?sessionId=${sessionId}`)
        .send();
      const { drawId } = drawn.body.draws[0];

      const response = await endpoint
        .post(`/v1/draw/${drawId}/complete`)
        .send({ sessionId: await createSession() });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown drawId");
    });
  });

  describe("GET /item-pool/:poolId/items", () => {
    const POOL_ID = "gallery";

    beforeAll(async () => {
      await createPool(POOL_ID);
      await createItem(POOL_ID, {
        status: "approved",
        publicPayload: { text: "first" },
      });
      await createItem(POOL_ID, {
        status: "approved",
        publicPayload: { text: "second" },
      });
      // Neither of these should ever show up on the wall
      await createItem(POOL_ID, { publicPayload: { text: "unapproved" } });
      await createItem(POOL_ID, {
        status: "rejected",
        publicPayload: { text: "rejected" },
      });
    });

    it("should return only visible items", async () => {
      const response = await endpoint
        .get(`/v1/item-pool/${POOL_ID}/items`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      for (const item of response.body.items) {
        expect(Object.keys(item).sort()).toEqual([
          "generation",
          "itemId",
          "publicPayload",
        ]);
      }
    });

    it("should sort and limit items", async () => {
      const newest = await endpoint
        .get(`/v1/item-pool/${POOL_ID}/items?sort=newest&limit=1`)
        .send();
      expect(newest.body.items).toHaveLength(1);
      expect(newest.body.items[0].publicPayload).toEqual({ text: "second" });

      const oldest = await endpoint
        .get(`/v1/item-pool/${POOL_ID}/items?sort=oldest&limit=1`)
        .send();
      expect(oldest.body.items[0].publicPayload).toEqual({ text: "first" });
    });

    it("should reject an unknown poolId", async () => {
      const response = await endpoint
        .get("/v1/item-pool/no-gallery-here/items")
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Unknown poolId");
    });
  });

  describe("DELETE /item/:itemId", () => {
    it("should let a session retract its own item", async () => {
      await createPool("retraction");
      const sessionId = await createSession();
      const itemId = await createItem("retraction", {
        status: "approved",
        sourceSessionId: sessionId,
      });

      const response = await endpoint
        .delete(`/v1/item/${itemId}`)
        .send({ sessionId });

      expect(response.status).toBe(200);
      expect(await getItem(itemId)).toHaveProperty("status", "rejected");

      const gallery = await endpoint
        .get("/v1/item-pool/retraction/items")
        .send();
      expect(gallery.body.items).toHaveLength(0);
    });

    it("should not let a session retract somebody else's item", async () => {
      await createPool("retraction-denied");
      const itemId = await createItem("retraction-denied", {
        status: "approved",
        sourceSessionId: await createSession(),
      });

      const response = await endpoint
        .delete(`/v1/item/${itemId}`)
        .send({ sessionId: await createSession() });

      expect(response.status).toBe(400);
      expect(await getItem(itemId)).toHaveProperty("status", "approved");
    });
  });

  describe("GET /study/:studyId/data/:dataType/json", () => {
    const EXPORT_STUDY_ID = "items-export";
    let ownItemId: string;
    let sharedItemId: string;
    let foreignItemId: string;
    let drawId: string;

    beforeAll(async () => {
      await sequelize.models.Study.create({ studyId: EXPORT_STUDY_ID });
      const sessionId = await createSession(undefined, EXPORT_STUDY_ID);

      // A pool of the study's own, plus a pool shared across studies which
      // this study both contributes to and draws from
      await createPool("export-own", { studyId: EXPORT_STUDY_ID });
      await createPool("export-shared");

      ownItemId = await createItem("export-own", { status: "approved" });
      sharedItemId = await createItem("export-shared", {
        status: "approved",
        sourceSessionId: sessionId,
      });
      // Somebody else's contribution to the shared pool, which this study
      // never touched
      foreignItemId = await createItem("export-shared", {
        status: "approved",
        sourceSessionId: await createSession(undefined, OTHER_STUDY_ID),
      });

      const drawn = await endpoint
        .get(
          `/v1/item-pool/export-own/draw?sessionId=${sessionId}&excludeOwn=false`,
        )
        .send();
      drawId = drawn.body.draws[0].drawId;
    });

    function download(dataType: string) {
      return endpoint
        .get(`/v1/study/${EXPORT_STUDY_ID}/data/${dataType}/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();
    }

    it("should export the items reachable from the study", async () => {
      const response = await download("items-raw");

      expect(response.status).toBe(200);
      const itemIds = response.body.map((item: any) => item.itemId).sort();
      expect(itemIds).toEqual([ownItemId, sharedItemId].sort());
      // Another study's contribution to the shared pool is not ours to export
      expect(itemIds).not.toContain(foreignItemId);
    });

    it("should export the study's draws", async () => {
      const response = await download("item-draws-raw");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].drawId).toBe(drawId);
      expect(response.body[0].itemId).toBe(ownItemId);
    });

    it("should carry the drawId along with the responses", async () => {
      const response = await download("responses-raw");

      expect(response.status).toBe(200);
      for (const row of response.body) {
        expect(row).toHaveProperty("drawId");
      }
    });
  });

  describe("Deleting a study", () => {
    it("should remove its pools and draws but leave shared pools alone", async () => {
      const DELETE_STUDY_ID = "items-deletion";
      await sequelize.models.Study.create({ studyId: DELETE_STUDY_ID });
      const sessionId = await createSession(undefined, DELETE_STUDY_ID);

      await createPool("deletion-own", { studyId: DELETE_STUDY_ID });
      await createPool("deletion-shared");

      const ownItemId = await createItem("deletion-own", {
        status: "approved",
      });
      const sharedItemId = await createItem("deletion-shared", {
        status: "approved",
        sourceSessionId: sessionId,
      });

      const drawn = await endpoint
        .get(
          `/v1/item-pool/deletion-own/draw?sessionId=${sessionId}&excludeOwn=false`,
        )
        .send();
      const { drawId } = drawn.body.draws[0];
      await endpoint
        .post("/v1/response")
        .send({ sessionId, name: "reaction", payload: {}, drawId })
        .expect(200);

      await deleteStudyItems(DELETE_STUDY_ID);

      // The study's own pool and everything in it is gone
      expect(await getItem(ownItemId)).toBe(null);
      expect(
        await sequelize.models.ItemPool.findOne({
          where: { poolId: "deletion-own" },
        }),
      ).toBe(null);
      expect(
        await sequelize.models.ItemDraw.findOne({ where: { drawId } }),
      ).toBe(null);

      // The shared pool survives, its item just loses the link to the study
      expect(
        await sequelize.models.ItemPool.findOne({
          where: { poolId: "deletion-shared" },
        }),
      ).not.toBe(null);
      const sharedItem = await getItem(sharedItemId);
      expect(sharedItem).not.toBe(null);
      expect(sharedItem).toHaveProperty("sourceSessionId", null);

      // Responses stay behind for the study's own deletion step to remove,
      // but must not point at a draw which no longer exists
      const responses = await sequelize.models.Response.findAll({
        where: { sessionId },
      });
      for (const response of responses as any[]) {
        expect(response.drawId).toBe(null);
      }
    });
  });
});
