# Obsidian Universe

An interactive semantic map of the entire Obsidian community plugin ecosystem.

The application renders a precomputed plugin universe in a custom canvas viewer. Position represents semantic similarity, color represents an emergent cluster, and node size represents logarithmic download volume. Search, cluster filtering, plugin details, and nearest-neighbor discovery run entirely in the browser.

## Architecture

```text
Obsidian plugin registry + download statistics + GitHub READMEs
                            ↓
                   TF-IDF document vectors
                            ↓
              Truncated SVD semantic embedding
                            ↓
            cosine kNN graph + MiniBatchKMeans
                            ↓
                       UMAP geography
                            ↓
                    public/map-v1.json
                            ↓
                   Vinext + React canvas UI
```

## Run the web app

```bash
npm install
npm run dev
```

## Rebuild the universe

Create a Python 3.11 environment and install the pipeline dependencies:

```bash
pip install -r pipeline/requirements.txt
python pipeline/collect.py --refresh
python pipeline/build_map.py
```

The collector caches README text under `data/raw/readmes/`. The generated web artifact is `public/map-v1.json`. A scheduled GitHub Action refreshes the dataset weekly.

## Data sources

- [`community-plugins.json`](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)
- [`community-plugin-stats.json`](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugin-stats.json)
- Plugin repository READMEs from the repository paths in the canonical registry

Obsidian Universe is an independent community project and is not affiliated with Obsidian.
