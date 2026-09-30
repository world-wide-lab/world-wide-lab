// Split a CSV export into lines, ignoring a trailing newline (postgres' COPY
// terminates its last row with one, json-2-csv does not).
export function csvLines(text: string) {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}
