import path from "node:path";
import { fileURLToPath } from "node:url";

// Helper function to get current directory, replacing the missing __dirname
// Use this like so: getDirectory(import.meta.url)
// Code is inspired by https://flaviocopes.com/fix-dirname-not-defined-es-module-scope/
export function getDirectory(import_meta_url: string) {
  const filename = fileURLToPath(import_meta_url);
  const dirname = path.dirname(filename);

  return dirname;
}
