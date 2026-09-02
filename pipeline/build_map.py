#!/usr/bin/env python3
"""Turn collected plugin text into a static semantic map for the web client."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import umap
from sklearn.cluster import MiniBatchKMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import Normalizer

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "map-v1.json"
READMES = RAW / "readmes"

PALETTE = [
    "#8fb6ff", "#f1b96e", "#ec91ad", "#7fd6b2", "#b79bea", "#61cbd5",
    "#e0cf63", "#ff927d", "#78a9d6", "#a8d26f", "#d58ad0", "#8ec7a4",
    "#d09f75", "#8295e3", "#e3a8c8", "#6ab5a8", "#c5b06c", "#9e9fd7",
]

CATEGORY_RULES = {
    "Writing & Editing": "writing editor text word paragraph spell grammar markdown typography focus typewriter novel manuscript",
    "Tasks & Planning": "task todo project planning kanban agenda goal habit reminder workflow checklist",
    "Knowledge & Links": "knowledge link backlink graph note pkm zettelkasten concept relation breadcrumb ontology",
    "Data & Metadata": "metadata property field database dataview query table csv frontmatter yaml formula",
    "Automation & Capture": "automation template templater capture command macro script button quickadd workflow",
    "Visual Thinking": "canvas drawing diagram mindmap excalidraw visual whiteboard sketch mermaid",
    "Research & PDFs": "research citation zotero pdf annotation academic bibliography reference paper highlight",
    "Publishing & Web": "publish website blog digital garden quartz hugo web export html share",
    "AI & Assistants": "ai artificial intelligence gpt llm chat assistant copilot prompt summarize embedding",
    "Developer Tools": "developer api code git github terminal debug javascript css plugin development npm package node build run",
    "Media & Files": "image audio video media attachment file gallery photograph recording player",
    "Calendar & Time": "calendar date time daily periodic week month timeline schedule journal",
    "Navigation & Search": "navigation search explorer folder tab workspace switcher bookmark outline",
    "Appearance & Interface": "theme appearance css interface layout sidebar icon color style mobile",
    "Integrations & Sync": "sync integration import export service remote notion readwise anki github",
    "Language & Translation": "language translate dictionary vocabulary multilingual chinese japanese english",
    "Learning & Recall": "spaced repetition flashcard learning recall memorize review quiz study",
    "Privacy & Security": "privacy encrypt security password backup protect sensitive lock",
}

# Human-readable names for the stable v1 cluster model. Geometry and cluster
# membership remain data-driven; these labels explain what emerged.
CLUSTER_LABELS_V1 = {
    0: "Documents & Diagrams",
    1: "AI & Language Models",
    2: "Core Power Tools",
    3: "Images & Media",
    4: "Writing & Text",
    5: "Navigation & Knowledge",
    6: "Sync & External Services",
    7: "Calendar & Journaling",
    8: "System & Plugin Utilities",
    9: "Data Views & Specialized Tools",
    10: "Code, Layout & Visualization",
    11: "Appearance & Workspace",
    12: "Tracking & Metrics",
    13: "Learning & Spaced Repetition",
    14: "Automation & Editing",
    15: "Publishing & Sharing",
    16: "Tasks & Projects",
    17: "Agents & Developer Tools",
}


def readme_for(plugin_id: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", plugin_id)
    path = READMES / f"{safe}.txt"
    return path.read_text(encoding="utf-8", errors="ignore")[:8000] if path.exists() else ""


def best_label(terms: list[str], used: dict[str, int]) -> str:
    joined = " ".join(terms)
    scored = []
    for label, words in CATEGORY_RULES.items():
        score = sum(joined.split().count(word) for word in words.split())
        scored.append((score, label))
    score, label = max(scored)
    if score == 0:
        label = " & ".join(term.title() for term in terms[:2]) or "Other Tools"
    count = used.get(label, 0)
    used[label] = count + 1
    if count:
        qualifier = next((term.title() for term in terms if term.lower() not in label.lower()), str(count + 1))
        return f"{label}: {qualifier}"
    return label


def normalize_axis(values: np.ndarray) -> np.ndarray:
    low, high = np.percentile(values, [1, 99])
    return np.clip((values - low) / max(high - low, 1e-8), 0, 1) * 100


def main() -> None:
    plugins = json.loads((RAW / "community-plugins.json").read_text(encoding="utf-8"))
    stats = json.loads((RAW / "community-plugin-stats.json").read_text(encoding="utf-8"))
    documents = []
    for plugin in plugins:
        description = plugin.get("description", "")
        # Capability descriptions dominate. README text adds vocabulary but is
        # deliberately capped to prevent badges, installation steps, and API
        # documentation from overwhelming what the plugin actually does.
        readme = readme_for(plugin["id"])[:1800]
        documents.append(" ".join([plugin["name"]] * 6 + [description] * 12 + [readme]))

    print(f"vectorizing {len(documents):,} plugin documents", flush=True)
    vectorizer = TfidfVectorizer(
        lowercase=True, stop_words="english", ngram_range=(1, 2), min_df=2,
        max_df=0.72, max_features=18000, sublinear_tf=True, strip_accents="unicode",
    )
    tfidf = vectorizer.fit_transform(documents)
    dimensions = min(96, tfidf.shape[1] - 1)
    semantic = TruncatedSVD(n_components=dimensions, random_state=42).fit_transform(tfidf)
    semantic = Normalizer(copy=False).fit_transform(semantic)

    print("calculating semantic neighborhoods", flush=True)
    neighbor_model = NearestNeighbors(n_neighbors=7, metric="cosine", algorithm="brute", n_jobs=-1)
    neighbor_model.fit(semantic)
    distances, neighbor_indices = neighbor_model.kneighbors(semantic)

    print("clustering", flush=True)
    cluster_count = 18
    cluster_model = MiniBatchKMeans(n_clusters=cluster_count, random_state=42, batch_size=512, n_init=10)
    cluster_ids = cluster_model.fit_predict(semantic)

    terms = vectorizer.get_feature_names_out()
    cluster_names: dict[int, str] = {}
    used_names: dict[str, int] = {}
    for cluster_id in range(cluster_count):
        mean_weights = np.asarray(tfidf[cluster_ids == cluster_id].mean(axis=0)).ravel()
        top_terms = [str(terms[i]) for i in mean_weights.argsort()[-18:][::-1] if terms[i] not in {"obsidian", "plugin", "plugins"}]
        cluster_names[cluster_id] = CLUSTER_LABELS_V1.get(cluster_id, best_label(top_terms, used_names))

    print("laying out geography with UMAP", flush=True)
    layout = umap.UMAP(
        n_neighbors=30, min_dist=0.08, n_components=2, metric="cosine",
        random_state=42, n_jobs=1, spread=1.15,
    ).fit_transform(semantic)
    x = normalize_axis(layout[:, 0])
    y = normalize_axis(layout[:, 1])

    output_plugins = []
    for index, plugin in enumerate(plugins):
        plugin_stats = stats.get(plugin["id"], {})
        neighbors = []
        for distance, other_index in zip(distances[index][1:], neighbor_indices[index][1:]):
            neighbors.append([plugins[int(other_index)]["id"], round(float(1 - distance), 4)])
        output_plugins.append({
            "id": plugin["id"], "name": plugin["name"],
            "author": plugin.get("author", "Unknown"),
            "description": plugin.get("description", "No description available."),
            "repo": plugin.get("repo", ""),
            "downloads": int(plugin_stats.get("downloads", 0) or 0),
            "updated": int(plugin_stats.get("updated", 0) or 0),
            "x": round(float(x[index]), 3), "y": round(float(y[index]), 3),
            "cluster": int(cluster_ids[index]), "neighbors": neighbors,
        })

    clusters = []
    for cluster_id in range(cluster_count):
        mask = cluster_ids == cluster_id
        clusters.append({
            "id": cluster_id, "name": cluster_names[cluster_id],
            "color": PALETTE[cluster_id % len(PALETTE)],
            "x": round(float(np.mean(x[mask])), 3), "y": round(float(np.mean(y[mask])), 3),
            "count": int(np.sum(mask)),
        })

    payload = {
        "version": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "obsidianmd/obsidian-releases",
        "method": "TF-IDF + SVD + cosine kNN + MiniBatchKMeans + UMAP",
        "count": len(output_plugins), "clusters": clusters, "plugins": output_plugins,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1_000_000:.2f} MB)", flush=True)


if __name__ == "__main__":
    main()
