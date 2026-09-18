"""Validate and render the argument map alongside the reading edition."""

from html import escape
import json
import shutil


def build_map(root, public, chapters, base_path="/"):
    data = json.loads((root / "argument-map.json").read_text())
    nodes = {node["id"]: node for node in data["nodes"]}
    assert len(nodes) == len(data["nodes"]), "Duplicate map node IDs"
    assert data["root"] in nodes
    relations = {"supports", "requires", "explains", "illustrates", "qualifies"}
    for node in nodes.values():
        assert node["title"] and node["paragraphs"]
        for ref in node["references"]:
            assert ref in chapters, f"Unknown essay chapter: {ref}"
        for group in node["groups"]:
            for edge in group["edges"]:
                assert edge["to"] in nodes, f"Unknown map node: {edge['to']}"
                assert edge["relation"] in relations

    visited, active = set(), set()

    def visit(node_id):
        assert node_id not in active, f"Dependency cycle at {node_id}"
        if node_id in visited:
            return
        active.add(node_id)
        for group in nodes[node_id]["groups"]:
            for edge in group["edges"]:
                visit(edge["to"])
        active.remove(node_id)
        visited.add(node_id)

    visit(data["root"])
    assert visited == set(nodes), f"Unreachable claims: {set(nodes) - visited}"
    data["chapters"] = {
        slug: {"number": number, "title": title}
        for slug, (number, title) in chapters.items()
    }
    static_claims = []
    for node in nodes.values():
        refs = " · ".join(
            f'<a href="./#{slug}">Chapter {chapters[slug][0]}: {escape(chapters[slug][1])}</a>'
            for slug in node["references"]
        )
        paragraphs = "".join(f"<p>{escape(p)}</p>" for p in node["paragraphs"])
        connections = "".join(
            f'<li>{escape(edge.get("label", edge["relation"]))}: <a href="./map.html#claim-{edge["to"]}">'
            f'{escape(nodes[edge["to"]]["title"])}</a></li>'
            for group in node["groups"] for edge in group["edges"]
        )
        static_claims.append(
            f'<section id="claim-{node["id"]}"><h2>{escape(node["code"])} · '
            f'{escape(node["title"])}</h2>{paragraphs}<p>{refs}</p><ul>{connections}</ul></section>'
        )
    payload = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    html = (root / "map.template.html").read_text()
    html = html.replace("{{BASE_PATH}}", escape(base_path, quote=True)).replace("{{MAP_DATA}}", payload).replace("{{STATIC_CLAIMS}}", "".join(static_claims))
    (public / "map.html").write_text(html)
    for asset in ["argument-map.css", "argument-map.js"]:
        shutil.copyfile(root / asset, public / asset)
    overview = (root / "overview.template.html").read_text()
    overview = overview.replace("{{BASE_PATH}}", escape(base_path, quote=True)).replace("{{MAP_DATA}}", payload).replace("{{STATIC_CLAIMS}}", "".join(static_claims))
    (public / "overview.html").write_text(overview)
    for asset in ["argument-overview.css", "argument-overview.js"]:
        shutil.copyfile(root / asset, public / asset)
    return len(nodes)
