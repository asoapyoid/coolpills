#!/usr/bin/env python3
"""Build the browser-specific ZIPs attached to GitHub releases."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
FILES = (
    "adapters.js",
    "background.js",
    "bridge-main.js",
    "coolhole.js",
    "detector.js",
    "manifest.json",
    "options.css",
    "options.html",
    "options.js",
    "storage.js",
    "ui.js",
    "icon16.png",
    "icon32.png",
    "icon48.png",
    "icon128.png",
)


def build(browser):
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if browser == "firefox":
        manifest["background"] = {"scripts": ["background.js"]}
        manifest["browser_specific_settings"] = {
            "gecko": {
                "id": "cool-pills@asoapyoid.local",
                "strict_min_version": "128.0",
            }
        }

    archive = DIST / f"cool-pills-{browser}-{manifest['version']}.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as package:
        for name in FILES:
            path = ROOT / name
            if not path.is_file():
                raise FileNotFoundError(f"Required extension file is missing: {path}")
            if name == "manifest.json":
                package.writestr(name, json.dumps(manifest, indent=2) + "\n")
            else:
                package.write(path, name)
    print(archive)


if __name__ == "__main__":
    DIST.mkdir(exist_ok=True)
    for target in ("chrome", "firefox"):
        build(target)
