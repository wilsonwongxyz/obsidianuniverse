#!/usr/bin/env python3
"""Collect the canonical Obsidian registry, download stats, and README text."""

from __future__ import annotations

import argparse
import certifi
import concurrent.futures
import json
import re
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
READMES = RAW / "readmes"
REGISTRY_URL = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"
STATS_URL = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json"
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


def download(url: str, timeout: int = 20) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "obsidian-universe-map/1.0"})
    with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
        return response.read()


def refresh_sources() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / "community-plugins.json").write_bytes(download(REGISTRY_URL))
    (RAW / "community-plugin-stats.json").write_bytes(download(STATS_URL))


def clean_markdown(value: str) -> str:
    value = re.sub(r"```.*?```", " ", value, flags=re.S)
    value = re.sub(r"!\[[^]]*]\([^)]*\)", " ", value)
    value = re.sub(r"\[([^]]+)]\([^)]*\)", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"https?://\S+", " ", value)
    value = re.sub(r"[#>*_`|~-]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()[:12000]


def readme_path(plugin_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", plugin_id)
    return READMES / f"{safe}.txt"


def fetch_readme(plugin: dict[str, str]) -> tuple[str, bool]:
    target = readme_path(plugin["id"])
    if target.exists() and target.stat().st_size > 20:
        return plugin["id"], True
    for branch in ("master", "main"):
        url = f"https://raw.githubusercontent.com/{plugin['repo']}/{branch}/README.md"
        try:
            text = download(url, timeout=12).decode("utf-8", errors="ignore")
            cleaned = clean_markdown(text)
            if cleaned:
                target.write_text(cleaned, encoding="utf-8")
                return plugin["id"], True
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
            continue
    return plugin["id"], False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Refresh registry and stats first")
    parser.add_argument("--skip-readmes", action="store_true")
    parser.add_argument("--workers", type=int, default=24)
    args = parser.parse_args()

    if args.refresh or not (RAW / "community-plugins.json").exists():
        refresh_sources()
    plugins = json.loads((RAW / "community-plugins.json").read_text(encoding="utf-8"))
    print(f"registry: {len(plugins):,} plugins", flush=True)
    if args.skip_readmes:
        return

    READMES.mkdir(parents=True, exist_ok=True)
    started = time.time()
    succeeded = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(fetch_readme, plugin) for plugin in plugins]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            _, ok = future.result()
            succeeded += int(ok)
            if index % 500 == 0:
                print(f"readmes: {index:,}/{len(plugins):,} checked, {succeeded:,} collected", flush=True)
    print(f"readmes: {succeeded:,}/{len(plugins):,} collected in {time.time() - started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
