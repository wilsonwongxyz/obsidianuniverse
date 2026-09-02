"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Plugin = { id: string; name: string; cluster: string; x: number; y: number; size: number; downloads: string; author: string; description: string; related: string[] };

const colors: Record<string, string> = { Knowledge: "#a8bff6", Automation: "#f3bf77", "Visual Thinking": "#f097a9", Tasks: "#95d6b4", Writing: "#c9abef", Research: "#70c9d1", Publishing: "#e7d46f" };

const plugins: Plugin[] = [
  { id: "dataview", name: "Dataview", cluster: "Knowledge", x: 43, y: 45, size: 26, downloads: "8.4M", author: "Michael Brenan", description: "Treat your Obsidian vault as a database and query your notes as live data.", related: ["Metadata Menu", "DB Folder", "Projects", "Templater"] },
  { id: "metadata-menu", name: "Metadata Menu", cluster: "Knowledge", x: 34, y: 39, size: 15, downloads: "1.2M", author: "MDelobelle", description: "Manage and edit structured metadata across your vault.", related: ["Dataview", "DB Folder", "Projects"] },
  { id: "db-folder", name: "DB Folder", cluster: "Knowledge", x: 39, y: 32, size: 13, downloads: "620K", author: "Rafael G.", description: "Display and edit folder notes in a database-style table.", related: ["Dataview", "Metadata Menu"] },
  { id: "projects", name: "Projects", cluster: "Knowledge", x: 49, y: 36, size: 15, downloads: "940K", author: "Marcus Olsson", description: "Project management views powered by notes and properties.", related: ["Dataview", "Tasks"] },
  { id: "bases", name: "Bases", cluster: "Knowledge", x: 31, y: 49, size: 12, downloads: "420K", author: "Various", description: "Extend Obsidian Bases with useful views and formulas.", related: ["Dataview", "Metadata Menu"] },
  { id: "templater", name: "Templater", cluster: "Automation", x: 58, y: 44, size: 24, downloads: "6.7M", author: "SilentVoid", description: "Create dynamic templates with variables, functions, and scripts.", related: ["QuickAdd", "Commander", "Dataview", "Meta Bind"] },
  { id: "quickadd", name: "QuickAdd", cluster: "Automation", x: 66, y: 38, size: 20, downloads: "3.1M", author: "Christian B. B. Houmann", description: "Capture, template, and automate common actions from one command.", related: ["Templater", "Commander", "Buttons"] },
  { id: "commander", name: "Commander", cluster: "Automation", x: 70, y: 50, size: 14, downloads: "1.4M", author: "phibr0", description: "Add commands anywhere in the Obsidian interface.", related: ["QuickAdd", "Templater"] },
  { id: "meta-bind", name: "Meta Bind", cluster: "Automation", x: 55, y: 55, size: 16, downloads: "1.1M", author: "mProjectsCode", description: "Create interactive controls that bind directly to note metadata.", related: ["Dataview", "Templater", "Buttons"] },
  { id: "buttons", name: "Buttons", cluster: "Automation", x: 64, y: 58, size: 11, downloads: "820K", author: "shabegom", description: "Place configurable action buttons inside notes.", related: ["Meta Bind", "QuickAdd"] },
  { id: "excalidraw", name: "Excalidraw", cluster: "Visual Thinking", x: 22, y: 67, size: 26, downloads: "5.9M", author: "Zsolt Viczian", description: "Sketch, diagram, and think visually inside your vault.", related: ["Canvas Mindmap", "Advanced Canvas", "Image Toolkit"] },
  { id: "advanced-canvas", name: "Advanced Canvas", cluster: "Visual Thinking", x: 31, y: 73, size: 16, downloads: "1.3M", author: "Developer", description: "Add presentation and workflow features to Obsidian Canvas.", related: ["Excalidraw", "Canvas Mindmap"] },
  { id: "canvas-mindmap", name: "Canvas Mindmap", cluster: "Visual Thinking", x: 17, y: 77, size: 13, downloads: "690K", author: "Quorafind", description: "Create mind maps quickly on the native canvas.", related: ["Excalidraw", "Advanced Canvas"] },
  { id: "tasks", name: "Tasks", cluster: "Tasks", x: 78, y: 68, size: 24, downloads: "5.2M", author: "Obsidian Tasks Team", description: "Track tasks across your entire vault with powerful queries.", related: ["Kanban", "Day Planner", "Projects"] },
  { id: "kanban", name: "Kanban", cluster: "Tasks", x: 86, y: 61, size: 20, downloads: "4.4M", author: "mgmeyers", description: "Create markdown-backed Kanban boards.", related: ["Tasks", "Projects"] },
  { id: "day-planner", name: "Day Planner", cluster: "Tasks", x: 88, y: 75, size: 15, downloads: "1.7M", author: "Ivan Lednev", description: "Plan a day on a visual timeline from markdown tasks.", related: ["Tasks", "Calendar"] },
  { id: "longform", name: "Longform", cluster: "Writing", x: 55, y: 80, size: 16, downloads: "780K", author: "Kevin Barrett", description: "Draft and organize novels, essays, and other long-form projects.", related: ["Writing Goals", "Typewriter Scroll"] },
  { id: "writing-goals", name: "Writing Goals", cluster: "Writing", x: 47, y: 87, size: 12, downloads: "330K", author: "Developer", description: "Set and visualize word-count goals for your writing.", related: ["Longform"] },
  { id: "typewriter", name: "Typewriter Scroll", cluster: "Writing", x: 65, y: 88, size: 11, downloads: "510K", author: "Developer", description: "Keep the active line centered for distraction-free writing.", related: ["Longform"] },
  { id: "zotero", name: "Zotero Integration", cluster: "Research", x: 18, y: 26, size: 20, downloads: "2.1M", author: "mgmeyers", description: "Import citations, notes, and annotations from Zotero.", related: ["Citations", "PDF++", "Annotator"] },
  { id: "pdf-plus", name: "PDF++", cluster: "Research", x: 25, y: 18, size: 17, downloads: "1.0M", author: "RyotaUshio", description: "Deep PDF annotation and linked reference workflows.", related: ["Zotero Integration", "Annotator"] },
  { id: "citations", name: "Citations", cluster: "Research", x: 10, y: 19, size: 14, downloads: "1.5M", author: "Jon Gauthier", description: "Search and insert references from a citation library.", related: ["Zotero Integration"] },
  { id: "digital-garden", name: "Digital Garden", cluster: "Publishing", x: 77, y: 18, size: 18, downloads: "1.3M", author: "Ole Eskild Dahl", description: "Publish selected notes as a connected digital garden.", related: ["Quartz Sync", "Hugo Publish"] },
  { id: "quartz", name: "Quartz Sync", cluster: "Publishing", x: 87, y: 25, size: 14, downloads: "620K", author: "Developer", description: "Prepare and sync a vault for publishing with Quartz.", related: ["Digital Garden", "Hugo Publish"] },
  { id: "hugo", name: "Hugo Publish", cluster: "Publishing", x: 69, y: 10, size: 11, downloads: "280K", author: "Developer", description: "Publish vault content to a Hugo website.", related: ["Digital Garden", "Quartz Sync"] },
];

const clusterLabels = [["RESEARCH", 15, 9], ["KNOWLEDGE", 39, 23], ["PUBLISHING", 78, 7], ["AUTOMATION", 63, 30], ["VISUAL THINKING", 16, 60], ["TASKS", 84, 54], ["WRITING", 55, 72]] as const;

export default function UniverseMap() {
  const [selectedId, setSelectedId] = useState("dataview");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const selected = plugins.find((plugin) => plugin.id === selectedId) ?? plugins[0];
  const matches = useMemo(() => query.trim() ? plugins.filter((p) => `${p.name} ${p.cluster} ${p.description}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [], [query]);
  function choose(plugin: Plugin) { setSelectedId(plugin.id); setQuery(""); }

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const modelContext = (document as unknown as { modelContext?: { registerTool?: (tool: object, options?: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "select_plugin",
      title: "Select an Obsidian plugin",
      description: "Navigate the visible universe map to a plugin and open its details.",
      inputSchema: {
        type: "object",
        properties: { plugin: { type: "string", description: "Plugin name or ID." } },
        required: ["plugin"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = typeof input === "object" && input !== null && "plugin" in input ? String((input as { plugin: unknown }).plugin) : "";
        const plugin = plugins.find((item) => item.id.toLowerCase() === value.toLowerCase() || item.name.toLowerCase() === value.toLowerCase());
        if (!plugin) throw new Error(`Plugin not found: ${value}`);
        setSelectedId(plugin.id);
        setQuery("");
        return { id: plugin.id, name: plugin.name, cluster: plugin.cluster };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return <main className="universe-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">O</span><div><strong>Obsidian Universe</strong><small>7,187 community plugins</small></div></div>
      <div className="search-wrap"><span aria-hidden="true">⌕</span><input ref={search} aria-label="Search plugins" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plugins, capabilities, authors…" /><kbd>⌘ K</kbd>
        {matches.length > 0 && <div className="search-results">{matches.map((plugin) => <button key={plugin.id} onClick={() => choose(plugin)}><i style={{background: colors[plugin.cluster]}} /><span>{plugin.name}<small>{plugin.cluster}</small></span></button>)}</div>}
      </div>
      <div className="header-actions"><button className="icon-button" aria-label="Information">i</button><button className="about-button">About the map</button></div>
    </header>
    <section className="map-viewport" aria-label="Interactive plugin map"
      onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(.72, Math.min(1.55, value - event.deltaY * .001))); }}
      onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (!drag.current) return; setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y }); }}
      onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <div className="starfield" /><div className="map-world" style={{transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}}>
      {clusterLabels.map(([label, x, y]) => <div key={label} className="cluster-label" style={{left: `${x}%`, top: `${y}%`}}>{label}</div>)}
      {plugins.map((plugin) => <button key={plugin.id} className={`plugin-node ${selected.id === plugin.id ? "selected" : ""}`} style={{left: `${plugin.x}%`, top: `${plugin.y}%`, "--node-color": colors[plugin.cluster], "--node-size": `${plugin.size}px`} as React.CSSProperties} onClick={() => choose(plugin)} aria-label={`${plugin.name}, ${plugin.cluster}`}><span className="node-dot" /><span className="node-name">{plugin.name}</span></button>)}
    </div><div className="map-hint">SCROLL TO ZOOM · DRAG TO EXPLORE</div><div className="zoom-control"><button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.55, z + .1))}>+</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(.72, z - .1))}>−</button></div><div className="legend"><span>REGIONS</span>{Object.entries(colors).map(([label, color]) => <span className="legend-item" key={label}><i style={{background: color}} />{label}</span>)}</div></section>
    <aside className="detail-panel"><div className="eyebrow"><i style={{background: colors[selected.cluster]}} />{selected.cluster}</div><h1>{selected.name}</h1><p className="description">{selected.description}</p>
      <div className="stats"><div><strong>{selected.downloads}</strong><span>DOWNLOADS</span></div><div><strong>★ 8.2K</strong><span>GITHUB STARS</span></div><div><strong>12d</strong><span>UPDATED</span></div></div>
      <div className="author"><span className="avatar">{selected.author[0]}</span><div><small>CREATED BY</small><strong>{selected.author}</strong></div></div><hr /><div className="section-title"><span>NEARBY IN THE UNIVERSE</span><small>SEMANTIC DISTANCE</small></div>
      <div className="related-list">{selected.related.map((name, index) => { const plugin = plugins.find((p) => p.name === name); return <button key={name} onClick={() => plugin && choose(plugin)}><span className="related-index">0{index + 1}</span><i style={{background: plugin ? colors[plugin.cluster] : "#70809a"}} /><span>{name}<small>{plugin?.cluster ?? "Related tool"}</small></span><em>{94 - index * 7}%</em></button>})}</div>
      <div className="panel-actions"><a href={`https://github.com/search?q=obsidian+${encodeURIComponent(selected.name)}`} target="_blank" rel="noreferrer">View on GitHub ↗</a><button>Community page ↗</button></div>
    </aside>
  </main>;
}
