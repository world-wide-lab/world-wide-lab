// Set up fake environment variables
import "./setup_env";

import request from "supertest";

// The whitelist is read from the environment when the app is created, so it
// has to be set before importing the app
process.env.PRIVATE_IP_WHITELIST = "10.0.0.1,192.168.0.0/24";
const { default: app } = await import("../src/app");

const endpoint = request(app);

describe("PRIVATE_IP_WHITELIST", () => {
  it("should still allow access to public endpoints", async () => {
    const response = await endpoint.get("/");

    expect(response.status).toBe(200);
  });

  it("should ignore requests to private endpoints", async () => {
    await expect(
      endpoint
        .get("/v1/study/example/data/responses-raw/json")
        .set("Authorization", `Bearer ${process.env.DEFAULT_API_KEY}`),
    ).rejects.toThrow(/socket hang up|ECONNRESET/);
  });
});
