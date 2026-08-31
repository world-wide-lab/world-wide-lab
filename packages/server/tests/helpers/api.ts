import request from "supertest";

import app from "../../src/app.js";

/**
 * A supertest client bound to the in-process express app.
 *
 * No server is listening, supertest calls the express handler directly, which
 * makes these tests both faster and free of port conflicts.
 */
const api = request(app);

const API_KEY = process.env.DEFAULT_API_KEY as string;

/**
 * Add the API key to a request against one of the protected endpoints.
 *
 * ```ts
 * const response = await authed(api.get(`/v1/study/${studyId}/data/...`));
 * ```
 */
function authed<T extends request.Test>(test: T): T {
  return test.set("Authorization", `Bearer ${API_KEY}`) as T;
}

export { API_KEY, api, authed };
