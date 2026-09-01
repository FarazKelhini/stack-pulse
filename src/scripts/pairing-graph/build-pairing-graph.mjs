#!/usr/bin/env node
/**
 * build-pairing-graph.mjs
 *
 * Reads a StackPulse pairings.json export and generates a single
 * self-contained HTML file with an interactive D3 force-directed
 * graph of the technology pairing network.
 *
 * The HTML shell and client-side D3 logic live in ./pairing-graph/
 * (template.html, graph.client.js) so they can be edited, linted, and
 * diffed like normal front-end files instead of as one giant JS
 * template literal. This script's only job is: load data, filter/cap
 * it, and stitch the template + data + client script together into
 * one output file.
 *
 * Usage:
 *   node scripts/build-pairing-graph.mjs \
 *     --input public/datasets/pairings.json \
 *     --output public/pairing-network.html \
 *     --min-repos 1 \
 *     --pool-size 800
 *
 * All flags are optional; defaults are tuned for the current dataset size.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Template files live next to this script, so this is safe to derive from
// __dirname regardless of where the script itself is invoked from.
const TEMPLATE_DIR = path.join(__dirname, "");
const TEMPLATE_HTML = path.join(TEMPLATE_DIR, "template.html");
const CLIENT_JS = path.join(TEMPLATE_DIR, "graph.client.js");

/**
 * Neither __dirname (depends how deep this script is nested) nor
 * process.cwd() (depends what directory you happened to run the command
 * from) reliably points at the project root. Instead, walk upward from
 * wherever this script lives and find the nearest ancestor that actually
 * contains a `public/` directory — that's the project root by definition
 * for this repo's layout. Falls back to cwd if nothing is found so
 * behavior degrades gracefully rather than throwing.
 */
function findProjectRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "public"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd(); // hit filesystem root, give up
    dir = parent;
  }
}

const PROJECT_ROOT = findProjectRoot(__dirname);

function parseArgs(argv) {
  const args = {
    input: path.resolve(PROJECT_ROOT, "public/datasets/pairings.json"),
    output: path.resolve(PROJECT_ROOT, "public/pairing-network.html"),
    minRepos: 1,      // drop pairs seen in fewer than this many repos (noise floor)
    poolSize: 800,     // how many top pairs (by strength) get embedded in the page
    defaultShown: 60,  // how many are shown on first load, before the user adjusts the slider
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const val = argv[i + 1];
    if (!key || val === undefined) continue;
    if (key === "input") args.input = val;
    else if (key === "output") args.output = val;
    else if (key === "min-repos") args.minRepos = Number(val);
    else if (key === "pool-size") args.poolSize = Number(val);
    else if (key === "default-shown") args.defaultShown = Number(val);
  }
  return args;
}

function loadPairings(inputPath) {
  const raw = fs.readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.pairings)) {
    throw new Error(`Expected a "pairings" array in ${inputPath}`);
  }
  return data;
}

/**
 * Quality-filter and cap the dataset before it ever reaches the browser.
 * Rationale:
 *  - repositoryCount below the noise floor produces unstable Jaccard scores
 *    (a pair seen in 1 repo can score misleadingly high or low).
 *  - Even after that filter there are thousands of pairs; embedding all of
 *    them would bloat the page and produce an unreadable hairball. We keep
 *    a generous top-N pool (sorted by strength) and let the client filter
 *    further via the UI, without needing another network request.
 */
function buildPool(pairings, { minRepos, poolSize }) {
  return pairings
    .filter((p) => p.repositoryCount >= minRepos && p.strengthScore > 0)
    .sort((a, b) => b.strengthScore - a.strengthScore)
    .slice(0, poolSize)
    .map((p) => ({
      a: p.technologyA,
      b: p.technologyB,
      s: Number(p.strengthScore.toFixed(4)),
      n: p.repositoryCount,
    }));
}

/**
 * JSON.stringify is not safe to drop directly inside an inline <script>
 * tag: a string value containing "</script>" (or "<!--") would prematurely
 * close the tag / start an HTML comment and break parsing. Escaping "<"
 * neutralizes that without changing the parsed JSON value.
 */
function jsonForInlineScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderHtml(pool, meta, opts) {
  const template = fs.readFileSync(TEMPLATE_HTML, "utf-8");
  const clientScript = fs.readFileSync(CLIENT_JS, "utf-8");

  const dataScript = `// Pre-filtered pool embedded at build time (top ${pool.length} pairs by
// strength, repositoryCount >= ${meta.minRepos}). Generated ${meta.generatedAt}
// from commit ${meta.commitSha}. Fields are shortened (a/b/s/n) to keep payload small.
const POOL = ${jsonForInlineScript(pool)};
const DEFAULT_SHOWN = ${opts.defaultShown};`;

  return template
    .replace("{{COUNT_SLIDER_MAX}}", String(pool.length))
    .replace("{{REPO_SLIDER_MIN}}", String(meta.minRepos))
    .replace("{{REPO_SLIDER_MAX}}", String(meta.maxRepoCount))
    .replace("{{DATA_SCRIPT}}", dataScript)
    .replace("{{CLIENT_SCRIPT}}", clientScript);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const data = loadPairings(opts.input);
  const pool = buildPool(data.pairings, opts);
  const maxRepoCount = Math.max(...data.pairings.map((p) => p.repositoryCount));

  const html = renderHtml(pool, {
    minRepos: opts.minRepos,
    maxRepoCount,
    generatedAt: data.generatedAt ?? "unknown",
    commitSha: data.commitSha ?? "unknown",
  }, opts);

  fs.mkdirSync(path.dirname(opts.output), { recursive: true });
  fs.writeFileSync(opts.output, html, "utf-8");
  console.log(
    "Wrote " + opts.output + " (" + pool.length + " pairs embedded, repositoryCount >= " + opts.minRepos + ")"
  );
}

main();
