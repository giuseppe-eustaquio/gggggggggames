#!/usr/bin/env python3
"""Local dev server that keeps images/phee/manifest.json up to date.

Usage:
    python3 serve.py          # serves on http://localhost:8000
    python3 serve.py 8080     # custom port

The manifest is regenerated on startup and every time the browser
requests it, so new photos appear on the next page load, button click or new game.
"""
import os
import sys

sys.dont_write_bytecode = True  # don't litter the project with __pycache__

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from generate_phee_manifest import generate

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class Handler(SimpleHTTPRequestHandler):
    # Make sure JavaScript modules are always served as JavaScript
    # (some Windows setups get this wrong, which breaks <script type="module">).
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    # While developing, never reuse a cached copy of a file.
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0].endswith("/images/phee/manifest.json"):
            generate()
        super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    count = len(generate())
    print(f"Found {count} Phee photos. Serving on http://localhost:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()