# Obsidian Universe

An interactive semantic map of the entire Obsidian community plugin ecosystem. The application is a static React site: it needs no database, server, or runtime environment variables.

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
                   Vite + React canvas UI
```

## Local development

Node.js 22.13 or newer is required.

```bash
npm ci
npm run dev
```

Validate the production artifact with:

```bash
npm test
```

The static site is written to `dist/`.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository from the Vercel dashboard.
3. Select the **Vite** framework preset.
4. Use `npm run build` as the build command and `dist` as the output directory.
5. Deploy. No environment variables are required.

Vercel automatically creates preview deployments for branches and deploys the production branch after each push.

## Rebuild the universe

Create a Python 3.11 environment and install the pipeline dependencies:

```bash
pip install -r pipeline/requirements.txt
python pipeline/collect.py --refresh
python pipeline/build_map.py
```

The collector caches README text under `data/raw/readmes/`. The generated web artifact is `public/map-v1.json`. The included GitHub Action refreshes the dataset weekly; its commit triggers a new Vercel deployment when the repository is connected.

## Data sources

- [`community-plugins.json`](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)
- [`community-plugin-stats.json`](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugin-stats.json)
- Plugin repository READMEs from the repository paths in the canonical registry

Obsidian Universe is an independent community project and is not affiliated with Obsidian.
