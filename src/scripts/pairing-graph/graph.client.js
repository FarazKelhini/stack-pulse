/* eslint-env browser */
/* global d3, POOL, DEFAULT_SHOWN */
// Client-side rendering for the pairing network. Runs inside the generated
// HTML file, after the data script has defined POOL (array of {a,b,s,n})
// and DEFAULT_SHOWN (initial slider value). See build-pairing-graph.mjs.

const svg = d3.select("#canvas");
const g = svg.append("g");
const tooltip = d3.select("#tooltip");
const countSlider = document.getElementById("countSlider");
const countVal = document.getElementById("countVal");
const repoSlider = document.getElementById("repoSlider");
const repoVal = document.getElementById("repoVal");
const statsEl = document.getElementById("stats");
const warningEl = document.getElementById("warning");
const searchInput = document.getElementById("search");

countSlider.value = Math.min(DEFAULT_SHOWN, POOL.length);
repoSlider.value = repoSlider.min;

function showWarning(show) {
  warningEl.style.opacity = show ? 1 : 0;
}

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

// Track if a focus was requested but not found in the global pool
let focusNotFound = requestedFocus && !pinnedId;
let activeId = null;
let searchId = null; // node id currently locked in by the search box, if any

if (pinnedId) {
  searchInput.value = pinnedId;
} else if (requestedFocus) {
  searchInput.value = requestedFocus;
}

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

  const pinCurrentlyVisible = !pinnedId || nodeIds.includes(pinnedId);
  if (pinnedId && !pinCurrentlyVisible) {
    showWarning(true);   // tell the user why it's hidden right now
    // do NOT clear pinnedId or call syncUrl(null) here
  } else {
    showWarning(false);
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
      if (focusNotFound) return;
      if (activeId && !isEndpoint(d, activeId)) return; // don't wake up dimmed edges
      d3.select(this.parentNode).select("line").attr("stroke-opacity", 1);
      tooltip.style("opacity",1).html(
        "<b>"+d.source.id+"</b> \u2194 <b>"+d.target.id+"</b><br>strength: "+d.value.toFixed(3)+" &middot; "+d.repos+" repos"
      );
    })
    .on("mousemove", (ev,d) => {
      if (focusNotFound) return;
      if (activeId && !isEndpoint(d, activeId)) return;
      tooltip.style("left", ev.pageX+"px").style("top", ev.pageY+"px");
    })
    .on("mouseleave", function(ev,d){
      if (focusNotFound) return;
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
    .on("mouseenter", (ev,d) => { if(!pinnedId && !searchId && !focusNotFound) highlight(d.id); })
    .on("mouseleave", () => { if(!pinnedId && !searchId && !focusNotFound) highlight(null); })
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
    showWarning(false);
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

    // Determine the state to return to if id is null.
    // If we have a pin/search active, we should keep it highlighted.
    // If not, we reset to full display.
    const activeTarget = pinnedId || searchId;

    if(!id){
      if (activeTarget) {
        // If we are currently "highlighting out" of a pin/search,
        // we should re-apply the pin/search highlight instead of full reset.
        highlight(activeTarget);
      } else {
        linkVisible.attr("stroke-opacity", d => 0.12 + d.value * 0.6);
        node.attr("opacity", 1).attr("stroke", "#1c2230");
        label.classed("dim", false);
      }
      return;
    }

    // Check if the node actually exists in our current graph
    const exists = nodes.find(d => d.id === id);
    if (!exists) {
      // De-highlight everything
      linkVisible.attr("stroke-opacity", 0.05);
      node.attr("opacity", 0.2).attr("stroke", "#1c2230");
      label.classed("dim", true);
      // Ensure tooltip is hidden if search fails
      tooltip.style("opacity", 0);
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
  const target = pinnedId || searchId || requestedFocus;
  const found = target ? nodes.find(n => n.id === target) : null;

  if (target) {
    if (found) {
        highlight(target);
        showWarning(false);
    } else {
        highlight("NON_EXISTENT_ID_FORCE_DIM");
        showWarning(true);
    }
  } else {
    highlight(null);
    showWarning(false);
  }

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
    showWarning(false);
    return;
  }
  // Prefer an exact id match, then a prefix match, then fall back to a
  // substring match. Plain "includes" alone would let "react" match
  // "testing-library-react" before the actual "react" node.
  const data = nodeSel ? nodeSel.data() : [];
  const found =
    data.find(d => d.id.toLowerCase() === q) ||
    data.find(d => d.id.toLowerCase().startsWith(q)) ||
    data.find(d => d.id.toLowerCase().includes(q));
  searchId = found ? found.id : "__none__";
  buildGraph._highlight && buildGraph._highlight(searchId);

  if (q && searchId === "__none__") showWarning(true);
  else showWarning(false);
});

window.addEventListener("resize", buildGraph);

buildGraph();
