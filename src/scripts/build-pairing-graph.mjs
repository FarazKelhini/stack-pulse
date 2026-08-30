#!/usr/bin/env node
/**
 * build-pairing-graph.mjs
 *
 * Reads a StackPulse pairings.json export and generates a single
 * self-contained HTML file with an interactive D3 force-directed
 * graph of the technology pairing network.
 *
 * Usage:
 *   node scripts/build-pairing-graph.mjs \
 *     --input public/datasets/pairings.json \
 *     --output public/pairing-network.html \
 *     --min-repos 3 \
 *     --pool-size 400
 *
 * All flags are optional; defaults are tuned for the current dataset size.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    input: path.resolve(__dirname, "../..", "public/datasets/pairings.json"),
    output: path.resolve(__dirname, "../..", "public/pairing-network.html"),
    minRepos: 3,      // drop pairs seen in fewer than this many repos (noise floor)
    poolSize: 400,     // how many top pairs (by strength) get embedded in the page
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

function renderHtml(pool, meta, opts) {
  const dataJson = JSON.stringify(pool);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>StackPulse — Pairing Network</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<style>
  :root{
    --bg: #0b0e14;
    --bg-panel: #11151d;
    --line: #232936;
    --text: #e6e9ef;
    --text-dim: #7a8394;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  *{ box-sizing: border-box; }
  html,body{ margin:0; height:100%; background:var(--bg); color:var(--text); font-family:var(--sans); overflow:hidden; }
  #app{ position:relative; width:100%; height:100vh; }
  svg{ width:100%; height:100%; display:block; cursor:grab; }
  svg:active{ cursor:grabbing; }

  .hud-top{ position:absolute; top:0; left:0; right:0; display:flex; justify-content:space-between; align-items:flex-start; padding:22px 26px; pointer-events:none; }
  .title{ font-family:var(--mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim); margin:0 0 4px 0; }
  .subtitle{ font-size:20px; font-weight:600; margin:0; letter-spacing:-0.01em; }
  .stats{ font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-top:6px; }

  .panel{ pointer-events:auto; background:var(--bg-panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; width:230px; }
  .panel label{ display:block; font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--text-dim); margin-bottom:6px; }
  .panel .row{ margin-bottom:14px; }
  .panel .row:last-child{ margin-bottom:0; }
  .panel input[type=range]{ width:100%; accent-color:#f0b429; }
  .panel input[type=text]{
    width:100%; background:var(--bg); border:1px solid var(--line); border-radius:6px;
    color:var(--text); font-family:var(--mono); font-size:12px; padding:6px 8px;
  }
  .panel .val{ font-family:var(--mono); font-size:11px; color:var(--text); float:right; }

  .hint{ position:absolute; bottom:22px; left:26px; font-family:var(--mono); font-size:11px; color:var(--text-dim); }

  .node-label{ font-family:var(--mono); font-size:11px; fill:var(--text); pointer-events:none; paint-order:stroke; stroke:var(--bg); stroke-width:3px; stroke-linejoin:round; }
  .node-label.dim{ fill:var(--text-dim); opacity:.3; }

  .tooltip{
    position:absolute; pointer-events:none; opacity:0;
    background:var(--bg-panel); border:1px solid var(--line); border-radius:8px;
    padding:8px 11px; font-family:var(--mono); font-size:12px;
    transition:opacity .1s ease; transform:translate(-50%,-115%); white-space:nowrap;
  }
  .tooltip b{ color:#fff; }
</style>
</head>
<body>
<div id="app">
  <svg id="canvas"></svg>

  <div class="hud-top">
    <div>
      <p class="title">StackPulse / pairing network</p>
      <p class="subtitle">Technology co-occurrence</p>
      <p class="stats" id="stats"></p>
    </div>
    <div class="panel">
      <div class="row">
        <label>Pairings shown <span class="val" id="countVal"></span></label>
        <input type="range" id="countSlider" min="5" max="${pool.length}" step="1">
      </div>
      <div class="row">
        <label>Min repositories <span class="val" id="repoVal"></span></label>
        <input type="range" id="repoSlider" min="${meta.minRepos}" max="${meta.maxRepoCount}" step="1">
      </div>
      <div class="row">
        <label>Focus a technology</label>
        <input type="text" id="search" placeholder="e.g. tailwind-merge">
      </div>
    </div>
  </div>

  <div class="hint">drag nodes · hover to trace connections · scroll to zoom</div>
  <div class="tooltip" id="tooltip"></div>
</div>

<script>
// Pre-filtered pool embedded at build time (top ${pool.length} pairs by strength,
// repositoryCount >= ${meta.minRepos}). Generated ${meta.generatedAt} from
// commit ${meta.commitSha}. Fields are shortened (a/b/s/n) to keep payload small.
const POOL = ${dataJson};
const DEFAULT_SHOWN = ${opts.defaultShown};

const svg = d3.select("#canvas");
const g = svg.append("g");
const tooltip = d3.select("#tooltip");
const countSlider = document.getElementById("countSlider");
const countVal = document.getElementById("countVal");
const repoSlider = document.getElementById("repoSlider");
const repoVal = document.getElementById("repoVal");
const statsEl = document.getElementById("stats");
const searchInput = document.getElementById("search");

countSlider.value = Math.min(DEFAULT_SHOWN, POOL.length);
repoSlider.value = repoSlider.min;

let sim = null;
let linkSel, nodeSel, labelSel;

// Deep-link support: /network?focus=tailwind-merge pins that node on load.
// pinnedId/activeId live at module scope (not inside buildGraph) so a pin
// survives slider changes and window resizes, which both rebuild the graph.
const urlParams = new URLSearchParams(window.location.search);
const requestedFocus = urlParams.get("focus");
let pinnedId = requestedFocus
  ? (POOL.find(p => p.a === requestedFocus || p.b === requestedFocus)
      ? requestedFocus
      : (POOL.find(p => p.a.toLowerCase() === requestedFocus.toLowerCase() || p.b.toLowerCase() === requestedFocus.toLowerCase())?.a ?? null))
  : null;
let activeId = null;
let searchId = null; // node id currently locked in by the search box, if any

if (pinnedId) searchInput.value = pinnedId;

function syncUrl(id){
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("focus", id);
  else url.searchParams.delete("focus");
  history.replaceState(null, "", url.toString());
}

function currentEdges(){
  const minRepos = Number(repoSlider.value);
  const count = Number(countSlider.value);
  const base = POOL.filter(p => p.n >= minRepos).slice(0, count);

  // Whatever's pinned must be visible even if the slider currently excludes
  // it, or a deep link / search focus would silently render nothing.
  if (pinnedId) {
    const seen = new Set(base.map(e => e.a + "|" + e.b));
    POOL.filter(p => p.n >= minRepos && (p.a === pinnedId || p.b === pinnedId))
      .forEach(p => {
        const key = p.a + "|" + p.b;
        if (!seen.has(key)) { base.push(p); seen.add(key); }
      });
  }
  return base;
}

function buildGraph(){
  g.selectAll("*").remove();
  if (sim) sim.stop();

  const edges = currentEdges();
  countVal.textContent = countSlider.value;
  repoVal.textContent = repoSlider.value;

  const nodeIds = Array.from(new Set(edges.flatMap(e => [e.a, e.b])));
  const degree = {};
  nodeIds.forEach(id => degree[id] = 0);
  edges.forEach(e => { degree[e.a]++; degree[e.b]++; });

  const nodes = nodeIds.map(id => ({ id, degree: degree[id] }));
  const links = edges.map(e => ({ source: e.a, target: e.b, value: e.s, repos: e.n }));

  // A pin can go stale (e.g. the tech doesn't exist below the current
  // min-repos floor at all) — drop it quietly rather than pointing at nothing.
  if (pinnedId && !nodeIds.includes(pinnedId)) {
    pinnedId = null;
    syncUrl(null);
  }

  statsEl.textContent = nodes.length + " technologies · " + links.length + " pairings";

  const maxDeg = d3.max(nodes, d => d.degree) || 1;
  // Inferno's low end is near-black, which disappears against the dark
  // background. Remap degree into the [0.32, 0.94] slice of the scale so
  // even degree-1 nodes stay clearly visible.
  const color = (deg) => {
    const t = Math.min(deg / (maxDeg * 1.15), 1);
    return d3.interpolateInferno(0.32 + t * 0.62);
  };
  const radius = d => 8 + Math.sqrt(d.degree) * 6;

  const W = window.innerWidth, H = window.innerHeight;

  sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id)
      .distance(d => 220 - d.value * 160)
      .strength(d => 0.1 + d.value * 0.6))
    .force("charge", d3.forceManyBody().strength(-210))
    .force("center", d3.forceCenter(W/2, H/2))
    .force("collide", d3.forceCollide().radius(d => radius(d) + 18));

  // Each pairing gets two overlapping lines: a thin visible one (unchanged
  // look) and a much fatter invisible one on top that owns all pointer
  // events. This makes hover/click forgiving without widening the actual
  // stroke you see.
  const linkGroup = g.append("g").selectAll("g.link")
    .data(links).join("g").attr("class", "link");

  const linkVisible = linkGroup.append("line")
    .attr("stroke", "#f0b429")
    .attr("stroke-opacity", d => 0.12 + d.value * 0.6)
    .attr("stroke-width", d => 0.8 + d.value * 5)
    .style("pointer-events", "none");

  const linkHit = linkGroup.append("line")
    .attr("stroke", "transparent")
    .attr("stroke-width", d => Math.max(16, 6 + d.value * 10))
    .style("cursor", "pointer")
    .on("mouseenter", function(ev,d){
      if (activeId && !isEndpoint(d, activeId)) return; // don't wake up dimmed edges
      d3.select(this.parentNode).select("line").attr("stroke-opacity", 1);
      tooltip.style("opacity",1).html(
        "<b>"+d.source.id+"</b> \\u2194 <b>"+d.target.id+"</b><br>strength: "+d.value.toFixed(3)+" &middot; "+d.repos+" repos"
      );
    })
    .on("mousemove", (ev,d) => {
      if (activeId && !isEndpoint(d, activeId)) return;
      tooltip.style("left", ev.pageX+"px").style("top", ev.pageY+"px");
    })
    .on("mouseleave", function(ev,d){
      if (activeId && !isEndpoint(d, activeId)) return;
      d3.select(this.parentNode).select("line").attr("stroke-opacity", 0.12 + d.value * 0.6);
      tooltip.style("opacity",0);
    })
    .on("click", function(ev,d){
      if (activeId && !isEndpoint(d, activeId)) {
        // clicking a dimmed edge acts like clicking empty canvas
        pinnedId = null;
        searchId = null;
        searchInput.value = "";
        highlight(null);
        syncUrl(null);
        return;
      }
      ev.stopPropagation(); // clicking a highlighted edge shouldn't clear the pin
    });

  function isEndpoint(link, id){
    const s = link.source.id ?? link.source, t = link.target.id ?? link.target;
    return s === id || t === id;
  }

  const node = g.append("g").selectAll("circle")
    .data(nodes).join("circle")
    .attr("r", radius)
    .attr("fill", d => color(d.degree))
    .attr("fill-opacity", 0.92)
    .attr("stroke", "#1c2230")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .call(d3.drag()
      .on("start", (ev,d) => { if(!ev.active) sim.alphaTarget(0.25).restart(); d.fx=d.x; d.fy=d.y; })
      .on("drag", (ev,d) => { d.fx=ev.x; d.fy=ev.y; })
      .on("end", (ev,d) => { if(!ev.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }))
    .on("mouseenter", (ev,d) => { if(!pinnedId && !searchId) highlight(d.id); })
    .on("mouseleave", () => { if(!pinnedId && !searchId) highlight(null); })
    .on("click", (ev,d) => {
      ev.stopPropagation();
      const newId = (pinnedId === d.id) ? null : d.id;
      pinnedId = newId;
      searchId = newId; // keep the search box in sync with the click-pin
      searchInput.value = newId || "";
      highlight(newId);
      syncUrl(newId);
    });

  // clicking empty canvas clears the pin and the search field
  svg.on("click", () => {
    pinnedId = null;
    searchId = null;
    searchInput.value = "";
    highlight(null);
    syncUrl(null);
  });

  const label = g.append("g").selectAll("text")
    .data(nodes).join("text")
    .attr("class","node-label")
    .attr("text-anchor","middle")
    .attr("dy", d => radius(d) + 14)
    .text(d => d.id);

  linkSel = linkVisible; nodeSel = node; labelSel = label;

  function highlight(id){
    activeId = id;
    if(!id){
      linkVisible.attr("stroke-opacity", d => 0.12 + d.value * 0.6);
      node.attr("opacity", 1).attr("stroke", "#1c2230");
      label.classed("dim", false);
      return;
    }
    const connected = new Set([id]);
    links.forEach(l => {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      if(s===id) connected.add(t);
      if(t===id) connected.add(s);
    });
    linkVisible.attr("stroke-opacity", l => {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      return (s===id||t===id) ? 0.95 : 0.05;
    });
    node.attr("opacity", d => connected.has(d.id) ? 1 : 0.2)
        .attr("stroke", d => d.id === id ? "#fff" : "#1c2230");
    label.classed("dim", d => !connected.has(d.id));
  }
  buildGraph._highlight = (id) => { if(!pinnedId) highlight(id); };

  // Restore (or apply, on first load) the pin after a rebuild — slider
  // changes and window resizes both call buildGraph() and would otherwise
  // drop back to the unhighlighted state.
  if (pinnedId || searchId) highlight(pinnedId || searchId);

  sim.on("tick", () => {
    // Keep nodes on-screen and out from under the title/legend chrome —
    // the force layout otherwise has no idea those areas are occupied.
    const padX = 44, topPad = 130, bottomPad = 44;
    nodes.forEach(d => {
      d.x = Math.max(padX, Math.min(W - padX, d.x));
      d.y = Math.max(topPad, Math.min(H - bottomPad, d.y));
    });
    linkVisible.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y)
        .attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
    linkHit.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y)
        .attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
    node.attr("cx", d=>d.x).attr("cy", d=>d.y);
    label.attr("x", d=>d.x).attr("y", d=>d.y);
  });
}

// Wheel zoom: smaller per-tick steps (finer wheelDelta) plus a rAF loop that
// eases the transform toward each new target, so scrolling feels continuous
// instead of jumping in discrete increments. Drag/pinch panning is applied
// immediately (no easing) so it stays responsive under the pointer.
let currentTransform = d3.zoomIdentity;
let targetTransform = d3.zoomIdentity;

const zoomBehavior = d3.zoom()
  .scaleExtent([0.3, 3])
  .wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.025 : event.deltaMode ? 1 : 0.0015) * (event.ctrlKey ? 6 : 1))
  .on("zoom", (ev) => {
    targetTransform = ev.transform;
    if (!ev.sourceEvent || ev.sourceEvent.type !== "wheel") {
      currentTransform = ev.transform; // drag/pinch: no easing lag
      g.attr("transform", currentTransform);
    }
  });

svg.call(zoomBehavior);

(function easeZoom(){
  const k = currentTransform.k + (targetTransform.k - currentTransform.k) * 0.18;
  const x = currentTransform.x + (targetTransform.x - currentTransform.x) * 0.18;
  const y = currentTransform.y + (targetTransform.y - currentTransform.y) * 0.18;
  currentTransform = new d3.ZoomTransform(k, x, y);
  g.attr("transform", currentTransform);
  requestAnimationFrame(easeZoom);
})();

countSlider.addEventListener("input", buildGraph);
repoSlider.addEventListener("input", buildGraph);
searchInput.addEventListener("input", () => {
  // Editing the field by hand is an explicit new intent — release any
  // click-pin so it doesn't block the highlight from updating.
  if (pinnedId !== null) { pinnedId = null; syncUrl(null); }

  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    searchId = null;
    buildGraph._highlight && buildGraph._highlight(null);
    return;
  }
  const found = nodeSel && nodeSel.data().find(d => d.id.toLowerCase().includes(q));
  searchId = found ? found.id : "__none__";
  buildGraph._highlight && buildGraph._highlight(searchId);
});

window.addEventListener("resize", buildGraph);

buildGraph();
</script>
</body>
</html>
`;
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
