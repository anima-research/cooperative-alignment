#!/usr/bin/env python3
"""Serve the same static reading edition at the root or its mounted URL."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PREFIX = "/cooperative-alignment"
SITE = Path(__file__).resolve().parent / "site"


class ReadingEditionHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Tailscale strips the mount prefix; local previews retain it.
        if path == PREFIX or path.startswith(PREFIX + "/"):
            path = path[len(PREFIX):] or "/"
        return super().translate_path(path)


if __name__ == "__main__":
    handler = partial(ReadingEditionHandler, directory=str(SITE))
    with ThreadingHTTPServer(("127.0.0.1", 18764), handler) as server:
        print("Reading edition available on 127.0.0.1:18764", flush=True)
        server.serve_forever()
