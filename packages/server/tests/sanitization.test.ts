import { sanitizeNullBytes } from "../src/validation/sanitization.js";

describe("sanitizeNullBytes", () => {
  it("should remove null bytes from strings", () => {
    expect(sanitizeNullBytes("hello\u0000world")).toBe("helloworld");
    expect(sanitizeNullBytes("\u0000start\u0000middle\u0000end\u0000")).toBe(
      "startmiddleend",
    );
    expect(sanitizeNullBytes("no null bytes here")).toBe("no null bytes here");
  });

  it("should remove null bytes from objects", () => {
    const input = {
      name: "John\u0000Doe",
      age: 30,
      bio: "Some \u0000text\u0000 with nulls",
    };

    const expected = {
      name: "JohnDoe",
      age: 30,
      bio: "Some text with nulls",
    };

    expect(sanitizeNullBytes(input)).toEqual(expected);
  });

  it("should remove null bytes from arrays", () => {
    const input = ["hello\u0000", "world\u0000", "\u0000test"];
    const expected = ["hello", "world", "test"];

    expect(sanitizeNullBytes(input)).toEqual(expected);
  });

  it("should handle nested objects and arrays", () => {
    const input = {
      name: "Test\u0000",
      details: {
        description: "Nested \u0000object",
        tags: ["tag1\u0000", "tag2\u0000"],
      },
      items: [
        { id: 1, value: "value1\u0000" },
        { id: 2, value: "value2\u0000" },
      ],
    };

    const expected = {
      name: "Test",
      details: {
        description: "Nested object",
        tags: ["tag1", "tag2"],
      },
      items: [
        { id: 1, value: "value1" },
        { id: 2, value: "value2" },
      ],
    };

    expect(sanitizeNullBytes(input)).toEqual(expected);
  });

  it("should handle null and undefined", () => {
    expect(sanitizeNullBytes(null)).toBeNull();
    expect(sanitizeNullBytes(undefined)).toBeUndefined();
  });

  it("should not modify non-object data types", () => {
    expect(sanitizeNullBytes(42)).toBe(42);
    expect(sanitizeNullBytes(true)).toBe(true);

    const date = new Date();
    expect(sanitizeNullBytes(date)).toBe(date);
  });
});
