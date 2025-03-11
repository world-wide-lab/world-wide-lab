/**
 * Recursively sanitize objects, arrays, and strings to remove null bytes
 * @param data Any data structure to sanitize
 * @returns Sanitized data structure with all null bytes removed from string values
 */
export function sanitizeNullBytes<T>(data: T): T {
  // Base case: null or undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings
  if (typeof data === "string") {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Character is correct, as this is exactly what we try to remove
    return data.replace(/\u0000/g, "") as unknown as T;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeNullBytes(item)) as unknown as T;
  }

  // Handle objects (but not non-plain objects like Date)
  if (typeof data === "object" && data.constructor === Object) {
    const sanitizedObj: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      // @ts-ignore
      sanitizedObj[key] = sanitizeNullBytes(data[key]);
    }
    return sanitizedObj as T;
  }

  // Return any other data types unchanged
  return data;
}
