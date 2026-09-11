// Set up fake environment variables
import "./setup_env";

import express from "express";
import request from "supertest";

import {
  createIpWhitelistMiddleware,
  isIpWhitelisted,
  parseIpWhitelist,
} from "../src/ipWhitelist";

function createTestApp(
  whitelist: string[],
  options: { trustProxy?: boolean | number | string } = {},
) {
  const app = express();
  app.set("trust proxy", options.trustProxy ?? false);
  app.use(createIpWhitelistMiddleware(whitelist, "TEST_IP_WHITELIST"));
  app.get("/", (req, res) => {
    res.send("ok");
  });
  return app;
}

describe("parseIpWhitelist", () => {
  it("should parse IPs and subnets", () => {
    const ranges = parseIpWhitelist(
      ["127.0.0.1", "10.0.0.0/8", "::1", "2001:db8::/32"],
      "TEST_IP_WHITELIST",
    );

    expect(
      ranges.map(([address, bits]) => `${address.toString()}/${bits}`),
    ).toEqual(["127.0.0.1/32", "10.0.0.0/8", "::1/128", "2001:db8::/32"]);
  });

  it("should ignore empty entries", () => {
    expect(parseIpWhitelist([], "TEST_IP_WHITELIST")).toEqual([]);
    expect(parseIpWhitelist([""], "TEST_IP_WHITELIST")).toEqual([]);
  });

  it("should throw an error on invalid entries", () => {
    expect(() => parseIpWhitelist(["not-an-ip"], "TEST_IP_WHITELIST")).toThrow(
      /Invalid entry in TEST_IP_WHITELIST/,
    );
    expect(() =>
      parseIpWhitelist(["10.0.0.0/64"], "TEST_IP_WHITELIST"),
    ).toThrow(/Invalid entry in TEST_IP_WHITELIST/);
  });
});

describe("isIpWhitelisted", () => {
  const ranges = parseIpWhitelist(
    ["127.0.0.1", "10.0.0.0/8", "2001:db8::/32"],
    "TEST_IP_WHITELIST",
  );

  it("should match individual IPs", () => {
    expect(isIpWhitelisted("127.0.0.1", ranges)).toBe(true);
    expect(isIpWhitelisted("127.0.0.2", ranges)).toBe(false);
  });

  it("should match IPs within a subnet", () => {
    expect(isIpWhitelisted("10.0.0.1", ranges)).toBe(true);
    expect(isIpWhitelisted("10.255.255.255", ranges)).toBe(true);
    expect(isIpWhitelisted("11.0.0.1", ranges)).toBe(false);
  });

  it("should match IPv6 addresses", () => {
    expect(isIpWhitelisted("2001:db8::1", ranges)).toBe(true);
    expect(isIpWhitelisted("2001:db9::1", ranges)).toBe(false);
  });

  it("should treat IPv4-mapped IPv6 addresses as IPv4", () => {
    expect(isIpWhitelisted("::ffff:127.0.0.1", ranges)).toBe(true);
    expect(isIpWhitelisted("::ffff:127.0.0.2", ranges)).toBe(false);
  });

  it("should not match anything with an empty whitelist", () => {
    expect(isIpWhitelisted("127.0.0.1", [])).toBe(false);
  });

  it("should reject missing or invalid IPs", () => {
    expect(isIpWhitelisted(undefined, ranges)).toBe(false);
    expect(isIpWhitelisted("", ranges)).toBe(false);
    expect(isIpWhitelisted("not-an-ip", ranges)).toBe(false);
  });
});

describe("createIpWhitelistMiddleware", () => {
  it("should let all requests pass when the whitelist is empty", async () => {
    const response = await request(createTestApp([])).get("/");

    expect(response.status).toBe(200);
  });

  it("should let requests from whitelisted IPs pass", async () => {
    const response = await request(createTestApp(["127.0.0.0/8"])).get("/");

    expect(response.status).toBe(200);
  });

  it("should ignore requests from non-whitelisted IPs", async () => {
    // Non-whitelisted requests are dropped without a response, so the
    // connection is closed before any status code is sent
    await expect(request(createTestApp(["10.0.0.1"])).get("/")).rejects.toThrow(
      /socket hang up|ECONNRESET/,
    );
  });

  it("should ignore proxy headers by default", async () => {
    await expect(
      request(createTestApp(["10.0.0.1"]))
        .get("/")
        .set("X-Forwarded-For", "10.0.0.1"),
    ).rejects.toThrow(/socket hang up|ECONNRESET/);
  });

  it("should use proxy headers when proxies are trusted", async () => {
    const app = createTestApp(["10.0.0.1"], { trustProxy: true });

    const allowed = await request(app)
      .get("/")
      .set("X-Forwarded-For", "10.0.0.1");
    expect(allowed.status).toBe(200);

    await expect(
      request(app).get("/").set("X-Forwarded-For", "10.0.0.2"),
    ).rejects.toThrow(/socket hang up|ECONNRESET/);
  });
});
