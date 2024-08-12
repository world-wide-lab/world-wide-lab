interface GenericObject {
  [key: string]: any;
}

export function extractJsonObjectFromRecord(
  name: string,
  record: any,
): GenericObject | undefined {
  const object: GenericObject = {};

  // Iterate over all params in the record and get all the start with "<name>."
  const prefix = `${name}.`;

  let isEmpty = true;
  for (const [key, value] of Object.entries(record.params)) {
    if (key.startsWith(prefix)) {
      isEmpty = false;
      object[key.replace(prefix, "")] = value;
    }
  }

  return isEmpty ? undefined : object;
}

export function randomString(length: number): string {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
