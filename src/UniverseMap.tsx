import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Neighbor = [string, number];
type Plugin = {
  id: string; name: string; author: string; description: string; repo: string;
  downloads: number; updated: number; x: number; y: number; cluster: number; neighbors: Neighbor[];
};
type Cluster = { id: number; name: string; color: string; x: number; y: number; count: number };
type MapData = { version: number; generatedAt: string; source: string; method: string; count: number; clusters: Cluster[]; plugins: Plugin[] };
type Camera = { x: number; y: number; k: number };

const WORLD = { width: 2400, height: 1600 };
const INITIAL_CAMERA: Camera = { x: 0, y: 0, k: .45 };

function formatDownloads(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return value.toLocaleString();
}

function updatedLabel(value: number) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function worldPoint(plugin: Pick<Plugin, "x" | "y">) {
  return { x: plugin.x / 100 * WORLD.width, y: plugin.y / 100 * WORLD.height };
}

export default function UniverseMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; cameraX: number; cameraY: number; moved: boolean } | null>(null);
  const size = useRef({ width: 1200, height: 800 });

  useEffect(() => {
    let cancelled = false;
    fetch("/map-v1.json")
      .then((response) => { if (!response.ok) throw new Error("The map data could not be loaded."); return response.json(); })
      .then((payload: MapData) => {
        if (cancelled) return;
        setData(payload);
        const initial = location.hash.slice(1);
        if (payload.plugins.some((plugin) => plugin.id === initial)) setSelectedId(initial);
      })
      .catch((reason: Error) => !cancelled && setError(reason.message));
    return () => { cancelled = true; };
  }, []);

  const pluginById = useMemo(() => new Map(data?.plugins.map((plugin) => [plugin.id, plugin]) ?? []), [data]);
  const clusterById = useMemo(() => new Map(data?.clusters.map((cluster) => [cluster.id, cluster]) ?? []), [data]);
  const selected = selectedId ? pluginById.get(selectedId) : undefined;
  const hovered = hoveredId ? pluginById.get(hoveredId) : undefined;

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value || !data) return [];
    return data.plugins
      .filter((plugin) => `${plugin.name} ${plugin.author} ${plugin.description} ${clusterById.get(plugin.cluster)?.name}`.toLowerCase().includes(value))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 8);
  }, [clusterById, data, query]);

  const fitCamera = useCallback(() => {
    const { width, height } = size.current;
    const k = Math.min(width / WORLD.width, height / WORLD.height) * .92;
    setCamera({ x: (width - WORLD.width * k) / 2, y: (height - WORLD.height * k) / 2, k });
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      setViewportSize({ width, height });
      const pixelRatio = Math.min(devicePixelRatio || 1, 2);
      size.current = { width, height };
      if (canvas.current) {
        canvas.current.width = Math.round(width * pixelRatio);
        canvas.current.height = Math.round(height * pixelRatio);
        canvas.current.style.width = `${width}px`;
        canvas.current.style.height = `${height}px`;
      }
      setCamera((current) => current === INITIAL_CAMERA ? { x: (width - WORLD.width * Math.min(width / WORLD.width, height / WORLD.height) * .92) / 2, y: (height - WORLD.height * Math.min(width / WORLD.width, height / WORLD.height) * .92) / 2, k: Math.min(width / WORLD.width, height / WORLD.height) * .92 } : { ...current });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const element = canvas.current;
    if (!element || !data) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const ratio = element.width / Math.max(size.current.width, 1);
    const { width, height } = size.current;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.k, camera.k);
    for (const plugin of data.plugins) {
      const point = worldPoint(plugin);
      const sx = point.x * camera.k + camera.x;
      const sy = point.y * camera.k + camera.y;
      if (sx < -20 || sy < -20 || sx > width + 20 || sy > height + 20) continue;
      const cluster = clusterById.get(plugin.cluster);
      const dimmed = activeCluster !== null && activeCluster !== plugin.cluster;
      const radius = 2 + Math.log10(plugin.downloads + 10) * .8;
      ctx.globalAlpha = dimmed ? .07 : .78;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius / camera.k, 0, Math.PI * 2);
      ctx.fillStyle = cluster?.color ?? "#93a2b8";
      ctx.fill();
    }

    if (selected) {
      const source = worldPoint(selected);
      for (const [neighborId, score] of selected.neighbors) {
        const neighbor = pluginById.get(neighborId);
        if (!neighbor) continue;
        const target = worldPoint(neighbor);
        ctx.globalAlpha = Math.max(.16, score * .55);
        ctx.strokeStyle = clusterById.get(neighbor.cluster)?.color ?? "#aab6c7";
        ctx.lineWidth = 1.2 / camera.k;
        ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); ctx.stroke();
      }
    }

    for (const focusId of [selectedId, hoveredId]) {
      const plugin = pluginById.get(focusId);
      if (!plugin) continue;
      const point = worldPoint(plugin);
      const radius = 2 + Math.log10(plugin.downloads + 10) * .8;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 / camera.k;
      ctx.globalAlpha = focusId === selectedId ? .95 : .7;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (radius + 6) / camera.k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Region names stay a constant screen size. Previously these were clamped
    // in world units, which made them grow dramatically as the camera zoomed.
    for (const cluster of data.clusters) {
      const sx = cluster.x / 100 * WORLD.width * camera.k + camera.x;
      const sy = cluster.y / 100 * WORLD.height * camera.k + camera.y;
      if (sx < -180 || sy < -40 || sx > width + 180 || sy > height + 40) continue;
      ctx.globalAlpha = activeCluster === null || activeCluster === cluster.id ? .16 : .035;
      ctx.fillStyle = cluster.color;
      ctx.font = "600 22px Georgia, serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "2px";
      ctx.fillText(cluster.name.toUpperCase(), sx, sy - 28);
    }

    // Greedily place plugin labels in screen space. Important plugins are
    // considered first and an occupancy grid rejects overlapping text boxes.
    const threshold = camera.k < .45 ? 1_500_000
      : camera.k < .75 ? 450_000
      : camera.k < 1.1 ? 150_000
      : camera.k < 1.6 ? 50_000
      : camera.k < 2.3 ? 12_000
      : 0;
    const neighborIds = new Set(selected?.neighbors.map(([id]) => id) ?? []);
    const labels: Plugin[] = [];
    for (const plugin of data.plugins) {
      const point = worldPoint(plugin);
      const sx = point.x * camera.k + camera.x;
      const sy = point.y * camera.k + camera.y;
      if (sx < -80 || sy < -30 || sx > width + 80 || sy > height + 30) continue;
      if (activeCluster !== null && activeCluster !== plugin.cluster && plugin.id !== selectedId && plugin.id !== hoveredId) continue;
      if (plugin.id === selectedId || plugin.id === hoveredId || neighborIds.has(plugin.id) || plugin.downloads >= threshold) labels.push(plugin);
    }
    const priority = (plugin: Plugin) => plugin.id === selectedId ? 4
      : plugin.id === hoveredId ? 3
      : neighborIds.has(plugin.id) ? 2
      : Math.log10(plugin.downloads + 10) / 10;
    labels.sort((a, b) => priority(b) - priority(a) || b.downloads - a.downloads);

    type LabelBox = { left: number; right: number; top: number; bottom: number };
    const grid = new Map<string, LabelBox[]>();
    const cellSize = 64;
    const overlaps = (box: LabelBox) => {
      const minX = Math.floor(box.left / cellSize), maxX = Math.floor(box.right / cellSize);
      const minY = Math.floor(box.top / cellSize), maxY = Math.floor(box.bottom / cellSize);
      for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
        for (const other of grid.get(`${gx}:${gy}`) ?? []) {
          if (box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top) return true;
        }
      }
      return false;
    };
    const occupy = (box: LabelBox) => {
      const minX = Math.floor(box.left / cellSize), maxX = Math.floor(box.right / cellSize);
      const minY = Math.floor(box.top / cellSize), maxY = Math.floor(box.bottom / cellSize);
      for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
        const key = `${gx}:${gy}`;
        const bucket = grid.get(key) ?? [];
        bucket.push(box);
        grid.set(key, bucket);
      }
    };

    let placed = 0;
    const labelLimit = Math.min(280, Math.max(60, Math.floor(width * height / 4200)));
    for (const plugin of labels) {
      if (placed >= labelLimit && plugin.id !== selectedId && plugin.id !== hoveredId) break;
      const point = worldPoint(plugin);
      const isFocus = plugin.id === selectedId || plugin.id === hoveredId;
      const radius = 2 + Math.log10(plugin.downloads + 10) * .8;
      const sx = point.x * camera.k + camera.x;
      const sy = point.y * camera.k + camera.y + radius + 14;
      const fontSize = isFocus ? 14 : 12;
      ctx.font = `${isFocus ? 700 : 500} ${fontSize}px Arial, sans-serif`;
      const textWidth = ctx.measureText(plugin.name).width;
      const box = { left: sx - textWidth / 2 - 5, right: sx + textWidth / 2 + 5, top: sy - fontSize - 3, bottom: sy + 5 };
      if (!isFocus && overlaps(box)) continue;
      occupy(box);
      placed++;
      ctx.globalAlpha = 1;
      ctx.fillStyle = isFocus ? "#ffffff" : "#c7d0de";
      ctx.textAlign = "center";
      ctx.fillText(plugin.name, sx, sy);
    }
  }, [activeCluster, camera, clusterById, data, hoveredId, pluginById, selected, selectedId]);

  useEffect(() => { const frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame); }, [draw]);

  function selectPlugin(plugin: Plugin, navigate = true) {
    setSelectedId(plugin.id);
    setActiveCluster(null);
    setQuery("");
    history.replaceState(null, "", `#${plugin.id}`);
    if (navigate) {
      const point = worldPoint(plugin);
      const k = 2.1;
      setCamera({ x: size.current.width / 2 - point.x * k, y: size.current.height / 2 - point.y * k, k });
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); search.current?.focus(); }
      if (event.key === "Escape") { setQuery(""); setActiveCluster(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!data) return;
    const modelContext = (document as unknown as { modelContext?: { registerTool?: (tool: object, options?: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "select_plugin", title: "Select an Obsidian plugin",
      description: "Find a plugin by name or ID, navigate the universe map to it, and open its real details.",
      inputSchema: { type: "object", properties: { plugin: { type: "string" } }, required: ["plugin"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = typeof input === "object" && input !== null && "plugin" in input ? String((input as { plugin: unknown }).plugin).toLowerCase() : "";
        const plugin = data.plugins.find((item) => item.id.toLowerCase() === value || item.name.toLowerCase() === value);
        if (!plugin) throw new Error(`Plugin not found: ${value}`);
        selectPlugin(plugin);
        return { id: plugin.id, name: plugin.name, cluster: clusterById.get(plugin.cluster)?.name };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [clusterById, data]);

  function pointerToWorld(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left - camera.x) / camera.k, y: (event.clientY - bounds.top - camera.y) / camera.k };
  }

  function findPlugin(point: { x: number; y: number }) {
    if (!data) return undefined;
    let nearest: Plugin | undefined;
    let best = 16 / camera.k;
    for (const plugin of data.plugins) {
      if (activeCluster !== null && activeCluster !== plugin.cluster) continue;
      const candidate = worldPoint(plugin);
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance < best) { best = distance; nearest = plugin; }
    }
    return nearest;
  }

  return <main className="universe-shell actual-map">
    <header className="topbar">
      <button className="brand brand-button" onClick={fitCamera} aria-label="Fit the whole plugin universe"><span className="brand-mark">O</span><span><strong>Obsidian Universe</strong><small>{data ? `${data.count.toLocaleString()} community plugins` : "Loading the ecosystem"}</small></span></button>
      <div className="search-wrap"><span aria-hidden="true">⌕</span><input ref={search} aria-label="Search every community plugin" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plugins, capabilities, authors…" /><kbd>⌘ K</kbd>
        {query && <div className="search-results">{matches.length ? matches.map((plugin) => <button key={plugin.id} onClick={() => selectPlugin(plugin)}><i style={{ background: clusterById.get(plugin.cluster)?.color }} /><span>{plugin.name}<small>{clusterById.get(plugin.cluster)?.name} · {formatDownloads(plugin.downloads)} downloads</small></span></button>) : <p>No plugins found.</p>}</div>}
      </div>
      <div className="header-actions"><span className="data-freshness">Updated {data ? new Date(data.generatedAt).toLocaleDateString() : "—"}</span><button className="about-button" onClick={() => setAboutOpen(true)}>How it works</button></div>
    </header>

    <section ref={viewport} className="map-viewport canvas-map" aria-label="Semantic map of all Obsidian community plugins">
      <canvas ref={canvas}
        onWheel={(event) => { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); const px = event.clientX - bounds.left; const py = event.clientY - bounds.top; const nextK = Math.max(.22, Math.min(5, camera.k * Math.exp(-event.deltaY * .0012))); const wx = (px - camera.x) / camera.k; const wy = (py - camera.y) / camera.k; setCamera({ x: px - wx * nextK, y: py - wy * nextK, k: nextK }); }}
        onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (drag.current) { const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true; setCamera((current) => ({ ...current, x: drag.current!.cameraX + dx, y: drag.current!.cameraY + dy })); return; } const plugin = findPlugin(pointerToWorld(event)); setHoveredId(plugin?.id ?? ""); }}
        onPointerUp={(event) => { const state = drag.current; drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); if (state && !state.moved) { const plugin = findPlugin(pointerToWorld(event)); if (plugin) selectPlugin(plugin, false); } }}
        onPointerLeave={() => setHoveredId("")}
      />
      {!data && !error && <div className="map-status"><span className="loading-orbit" />Building the universe…</div>}
      {error && <div className="map-status error-state"><strong>Map unavailable</strong><span>{error}</span><button onClick={() => location.reload()}>Try again</button></div>}
      {hovered && <div className="hover-card" style={{ left: Math.min(viewportSize.width - 230, worldPoint(hovered).x * camera.k + camera.x + 14), top: Math.max(76, worldPoint(hovered).y * camera.k + camera.y - 18) }}><strong>{hovered.name}</strong><span>{clusterById.get(hovered.cluster)?.name}</span></div>}
      <div className="map-hint">SCROLL TO ZOOM · DRAG TO EXPLORE · CLICK A PLUGIN</div>
      <div className="zoom-control"><button aria-label="Zoom in" onClick={() => setCamera((value) => ({ ...value, k: Math.min(5, value.k * 1.25) }))}>+</button><span>{Math.round(camera.k * 100)}%</span><button aria-label="Zoom out" onClick={() => setCamera((value) => ({ ...value, k: Math.max(.22, value.k / 1.25) }))}>−</button><button aria-label="Fit map" onClick={fitCamera}>⌂</button></div>
      <div className="legend cluster-filter"><span>REGIONS</span><button className={activeCluster === null ? "active" : ""} onClick={() => setActiveCluster(null)}>All</button>{data?.clusters.map((cluster) => <button className={activeCluster === cluster.id ? "active" : ""} key={cluster.id} onClick={() => setActiveCluster(activeCluster === cluster.id ? null : cluster.id)}><i style={{ background: cluster.color }} />{cluster.name}<small>{cluster.count}</small></button>)}</div>
    </section>

    <aside className={`detail-panel ${selected ? "has-selection" : ""}`}>
      {selected ? <>
        <button className="close-panel" aria-label="Close plugin details" onClick={() => { setSelectedId(""); history.replaceState(null, "", location.pathname); }}>×</button>
        <div className="eyebrow"><i style={{ background: clusterById.get(selected.cluster)?.color }} />{clusterById.get(selected.cluster)?.name}</div>
        <h1>{selected.name}</h1><p className="description">{selected.description}</p>
        <div className="stats"><div><strong>{formatDownloads(selected.downloads)}</strong><span>DOWNLOADS</span></div><div><strong>{selected.neighbors.length}</strong><span>CLOSE NEIGHBORS</span></div><div><strong>{updatedLabel(selected.updated)}</strong><span>LAST UPDATED</span></div></div>
        <div className="author"><span className="avatar">{selected.author.slice(0, 1).toUpperCase()}</span><div><small>CREATED BY</small><strong>{selected.author}</strong></div></div><hr />
        <div className="section-title"><span>NEARBY IN THE UNIVERSE</span><small>SEMANTIC SIMILARITY</small></div>
        <div className="related-list">{selected.neighbors.map(([id, score], index) => { const plugin = pluginById.get(id); if (!plugin) return null; return <button key={id} onClick={() => selectPlugin(plugin)}><span className="related-index">{String(index + 1).padStart(2, "0")}</span><i style={{ background: clusterById.get(plugin.cluster)?.color }} /><span>{plugin.name}<small>{clusterById.get(plugin.cluster)?.name}</small></span><em>{Math.round(score * 100)}%</em></button> })}</div>
        <div className="panel-actions"><a href={`https://github.com/${selected.repo}`} target="_blank" rel="noreferrer">GitHub ↗</a><a href={`obsidian://show-plugin?id=${encodeURIComponent(selected.id)}`}>Open in Obsidian ↗</a></div>
      </> : <div className="empty-detail"><span className="empty-glyph">✦</span><h1>Explore the ecosystem</h1><p>Search for a plugin or select any point on the map to see what it does and what lives nearby.</p><div className="ecosystem-stat"><strong>{data?.count.toLocaleString() ?? "—"}</strong><span>plugins across {data?.clusters.length ?? "—"} semantic regions</span></div></div>}
    </aside>

    {aboutOpen && <div className="about-backdrop" role="button" tabIndex={0} aria-label="Close methodology dialog" onKeyDown={(event) => { if (event.key === "Escape" || event.key === "Enter") setAboutOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setAboutOpen(false); }}><section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title"><button aria-label="Close" onClick={() => setAboutOpen(false)}>×</button><span className="eyebrow">THE CARTOGRAPHY</span><h2 id="about-title">How the universe is made</h2><p>Every point is a real community plugin from Obsidian’s canonical registry. Names, descriptions, and repository READMEs are converted into semantic vectors. Plugins with similar capabilities become neighbors.</p><ol><li><strong>Collect</strong><span>Registry, download statistics, and README text</span></li><li><strong>Understand</strong><span>TF-IDF and latent semantic analysis</span></li><li><strong>Connect</strong><span>Cosine nearest-neighbor graph</span></li><li><strong>Map</strong><span>UMAP projection and semantic clustering</span></li></ol><p className="method-note">Node size represents log downloads. Color represents an emergent cluster. Geography is precomputed and rendered locally in your browser.</p><a href="https://github.com/obsidianmd/obsidian-releases" target="_blank" rel="noreferrer">View the source registry ↗</a></section></div>}
  </main>;
}
