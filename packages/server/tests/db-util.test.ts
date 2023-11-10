import { sanitizeStudyId } from "../src/db/util";

describe("sanitizeStudyId", () => {
  it("should remove all special characters", () => {
    expect(sanitizeStudyId("a!-\"`'?bäöü;;,?_c;?")).toBe("a-b_c");
  });
  it("should remove especially all characters that may be relevant to SQL injection", () => {
    expect(sanitizeStudyId("`'\";")).toBe("");
  });
});
