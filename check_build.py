#!/usr/bin/env python3
"""Check the built edition's prose, graph data, and local links using stdlib only."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import hashlib
import json

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.base = None
        self.ids = set()
        self.links = []
        self.paragraphs = []
        self.paragraph = None
        self.graph = None
        self.graph_text = None
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate ID: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag == "base":
            assert self.base is None, "Multiple base elements"
            self.base = attrs["href"]
        if tag in {"a", "link"} and "href" in attrs:
            self.links.append(attrs["href"])
        if tag in {"script", "img"} and "src" in attrs:
            self.links.append(attrs["src"])
        if tag == "p" and "data-essay-paragraph" in attrs:
            self.paragraph = []
        if tag == "script" and attrs.get("id") == "argument-map-data":
            self.graph_text = []

    def handle_data(self, data):
        if self.paragraph is not None:
            self.paragraph.append(data)
        if self.graph_text is not None:
            self.graph_text.append(data)

    def handle_endtag(self, tag):
        if tag == "p" and self.paragraph is not None:
            self.paragraphs.append("".join(self.paragraph))
            self.paragraph = None
        if tag == "script" and self.graph_text is not None:
            self.graph = json.loads("".join(self.graph_text))
            self.graph_text = None


def main():
    manifest = json.loads((ROOT / "build-manifest.json").read_text())
    base = manifest["base_path"]
    pages = {path.name: Page(path.read_text()) for path in PUBLIC.glob("*.html")}
    assert set(pages) == {"index.html", "map.html", "overview.html"}
    source = (ROOT / "content" / "essay.md").read_bytes()
    assert manifest["source"] == "content/essay.md"
    assert manifest["source_sha256"] == hashlib.sha256(source).hexdigest()
    assert (PUBLIC / "cooperative-alignment.md").read_bytes() == source
    paragraphs = [p.strip() for p in source.decode().strip().split("\n\n")][1:]
    assert pages["index.html"].paragraphs == paragraphs, "Essay prose changed during rendering"
    graph = json.loads((ROOT / "argument-map.json").read_text())
    for name in ("map.html", "overview.html"):
        assert pages[name].graph["nodes"] == graph["nodes"], f"Graph content differs in {name}"
        assert pages[name].graph["root"] == graph["root"]
    links_checked = 0
    for name, page in pages.items():
        assert page.base == base, f"Wrong base path in {name}: {page.base}"
        for link in page.links:
            resolved = urlsplit(urljoin("https://example.test" + base, link))
            if resolved.scheme != "https" or resolved.netloc != "example.test":
                continue
            assert resolved.path.startswith(base), f"Link escapes the base path: {name}: {link}"
            relative = resolved.path[len(base):] or "index.html"
            assert (PUBLIC / relative).is_file(), f"Missing linked file: {name}: {link}"
            if resolved.fragment and relative in pages:
                assert resolved.fragment in pages[relative].ids, f"Missing anchor: {name}: {link}"
            links_checked += 1
    expected_assets = {"index.html", "map.html", "overview.html", "styles.css", "reading.js",
                       "argument-map.css", "argument-map.js", "argument-overview.css",
                       "argument-overview.js", "cooperative-alignment.md"}
    assert {p.name for p in PUBLIC.iterdir()} == expected_assets, "Unexpected public output"
    print(f"Verified {len(paragraphs)} essay paragraphs, {len(graph['nodes'])} claims, "
          f"and {links_checked} local links at {base}")


if __name__ == "__main__":
    main()
