/**
 * Guard for the Pulumi SDK pruning in electron-builder.yml.
 *
 * @pulumi/azure-native and @pulumi/aws are generated SDKs that ship a
 * subdirectory for every service the provider supports - 236 and 217 of them
 * respectively. @world-wide-lab/deploy imports a handful, but electron-builder
 * has no way of knowing that, so electron-builder.yml keeps only the
 * subdirectories we actually use and drops the rest to save file size.
 *
 * This script walks the import graph of @world-wide-lab/deploy, collects every
 * Pulumi submodule it can reach, and fails the build if one of them is not
 * kept by electron-builder.yml.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const deploySrc = path.resolve(__dirname, "../packages/deploy/src");
const builderConfig = path.resolve(__dirname, "electron-builder.yml");
const lockfile = path.resolve(__dirname, "../package-lock.json");

const PRUNED_SDKS = ["@pulumi/azure-native", "@pulumi/aws"];

/** Every `from "..."` / `require("...")` specifier in a source file. */
function readImports(file) {
  const source = fs.readFileSync(file, "utf8");
  const specifiers = [];
  const patterns = [
    /(?:^|\s)(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolve a relative import to a file on disk, the way tsc would. */
function resolveRelative(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    `${base.replace(/\.js$/, "")}.ts`,
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

/**
 * Walk the import graph from the package entry point. Only what is reachable
 * counts: pulumiDeployments/ecs.ts still exists, but nothing imports it any
 * more, so the services it uses do not need to be bundled.
 */
function collectUsedModules(entry) {
  const used = new Map();
  const packages = new Map();
  const seen = new Set();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    for (const specifier of readImports(file)) {
      if (specifier.startsWith(".")) {
        const resolved = resolveRelative(file, specifier);
        if (resolved) queue.push(resolved);
        continue;
      }
      // Which npm package this specifier belongs to, scope included.
      const segments = specifier.split("/");
      const name = specifier.startsWith("@")
        ? segments.slice(0, 2).join("/")
        : segments[0];
      if (!packages.has(name))
        packages.set(name, path.relative(deploySrc, file));

      for (const sdk of PRUNED_SDKS) {
        if (specifier === sdk) {
          throw new Error(
            `${path.relative(deploySrc, file)} imports all of "${sdk}".
The barrel module eagerly requires every service, which cannot work against a
pruned SDK. Import the service directly instead, e.g. "${sdk}/resources".`,
          );
        }
        if (specifier.startsWith(`${sdk}/`)) {
          const submodule = specifier.slice(sdk.length + 1).split("/")[0];
          if (!used.has(sdk)) used.set(sdk, new Set());
          used.get(sdk).add(submodule);
        }
      }
    }
  }
  return { used, packages };
}

/** The submodules electron-builder.yml re-includes for a given SDK. */
function readKeptModules(sdk) {
  const config = fs.readFileSync(builderConfig, "utf8");
  const escaped = sdk.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = new RegExp(
    `["']node_modules/${escaped}/\\{([^}]+)\\}/\\*\\*["']`,
  );
  const match = config.match(pattern);
  if (!match) {
    throw new Error(
      `electron-builder.yml has no keep-list for "${sdk}".
Expected a line of the form:
  - "node_modules/${sdk}/{app,resources}/**"`,
    );
  }
  return new Set(match[1].split(",").map((m) => m.trim()));
}

/** Packages electron-builder.yml drops entirely: `- "!node_modules/<pkg>/**"`. */
function readExcludedPackages() {
  const config = fs.readFileSync(builderConfig, "utf8");
  const excluded = new Set();
  for (const match of config.matchAll(
    /["']!node_modules\/((?:@[^/*"']+\/)?[^/*"']+)\/\*\*["']/g,
  )) {
    excluded.add(match[1]);
  }
  return excluded;
}

/**
 * Which packages in the lockfile declare a dependency on `name`. A package that
 * is itself excluded does not count - the point is to catch a *reachable*
 * package starting to need something the app no longer ships.
 */
function findDependents(name, excluded) {
  const lock = JSON.parse(fs.readFileSync(lockfile, "utf8"));
  const dependents = [];
  for (const [location, entry] of Object.entries(lock.packages)) {
    const deps = {
      ...(entry.dependencies ?? {}),
      ...(entry.optionalDependencies ?? {}),
    };
    if (!(name in deps)) continue;
    // The deploy package's own imports are checked by the import-graph walk.
    if (location === "packages/deploy") continue;
    const owner = location.startsWith("node_modules/")
      ? location.slice("node_modules/".length).split("/node_modules/").pop()
      : location;
    if (excluded.has(owner)) continue;
    dependents.push(owner);
  }
  return dependents;
}

let used;
let importedPackages;
try {
  ({ used, packages: importedPackages } = collectUsedModules(
    path.join(deploySrc, "index.ts"),
  ));
} catch (error) {
  console.error(`\n${error.message}\n`);
  process.exit(1);
}

const problems = [];

// Packages dropped wholesale must be unreachable, or the app breaks at runtime.
const excludedPackages = readExcludedPackages();
for (const name of excludedPackages) {
  const importer = importedPackages.get(name);
  if (importer) {
    problems.push(
      `${name} is imported by ${importer} but excluded from the bundle in electron-builder.yml.
  Either stop importing it, or drop the "!node_modules/${name}/**" line.`,
    );
  }
  const dependents = findDependents(name, excludedPackages);
  if (dependents.length > 0) {
    problems.push(
      `${name} is excluded from the bundle but ${[...new Set(dependents)].sort().join(", ")} depend(s) on it.
  Something the app does ship now needs it; drop the "!node_modules/${name}/**" line.`,
    );
  }
}

for (const sdk of PRUNED_SDKS) {
  const kept = readKeptModules(sdk);
  const needed = used.get(sdk) ?? new Set();
  const missing = [...needed].filter((m) => !kept.has(m));
  if (missing.length > 0) {
    const one = missing.length === 1;
    problems.push(
      `${sdk}: ${missing.join(", ")} ${one ? "is" : "are"} imported but not bundled.
  Add ${one ? "it" : "them"} to the "node_modules/${sdk}/{...}/**" line in electron-builder.yml.`,
    );
  }
}

if (problems.length > 0) {
  console.error(
    `\nThe app would ship without something it needs:\n\n${problems.join("\n\n")}\n`,
  );
  process.exit(1);
}

for (const sdk of PRUNED_SDKS) {
  const needed = [...(used.get(sdk) ?? [])].sort();
  console.log(`${sdk}: bundling ${needed.join(", ") || "(nothing)"}`);
}
console.log(`excluded entirely: ${[...excludedPackages].sort().join(", ")}`);
