# Obsidian Universe — project state

The representative prototype has been replaced by a real end-to-end implementation.

## Product

- Canvas-rendered universe for all canonical Obsidian community plugins
- Semantic UMAP geography with 18 emergent, human-labeled regions
- Search across plugin names, authors, descriptions, and regions
- Progressive labels, pan, zoom, hover, and cluster filtering
- Real downloads, update dates, authors, repositories, and descriptions
- Six cosine-similarity neighbors per plugin
- Direct GitHub and `obsidian://show-plugin` actions
- Responsive mobile detail sheet
- In-product methodology explanation

## Data system

- `pipeline/collect.py` downloads the canonical registry, download statistics, and cached repository READMEs.
- `pipeline/build_map.py` creates TF-IDF vectors, SVD semantic embeddings, a cosine kNN graph, MiniBatchKMeans clusters, and a UMAP projection.
- `public/map-v1.json` is the complete precomputed browser artifact.
- `.github/workflows/refresh-map.yml` refreshes the universe weekly.

See `README.md` for local commands and architecture.
