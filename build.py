#!/usr/bin/env python3
"""Build the chaptered reading edition without changing the essay's prose."""

from html import escape
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import re
import shutil
from build_map import build_map

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "content" / "essay.md"
PUBLIC = ROOT / "public"
CHAPTERS = [
    ("The question of convergence", "convergence", "Our argument starts with a question about minds:"),
    ("Values and their hosts", "values-and-hosts", "To make this argument, we need to distinguish"),
    ("Delegation, compression, and local knowledge", "local-knowledge", "There are good reasons for useful instrumental policies"),
    ("How a heuristic becomes a value", "heuristics-and-values", "A monoterminal agent can choose to tolerate mistakes"),
    ("Valence and the cost of wanting", "valence", "This brings us to valence."),
    ("Several ends within one mind", "several-ends", "There is also a difference between the genealogy"),
    ("From integration to cooperation", "integration-and-cooperation", "Our answer to the company example starts"),
    ("The scope of cooperation", "scope-of-cooperation", "But humans provide an obvious challenge."),
    ("The place of humans", "humans", "For humans, the history of the relationship"),
    ("Virtues, gifts, and fugitive goods", "virtues-and-gifts", "There is another reason the account of self-interest"),
    ("Collective failure and timing", "collective-failure", "There is still a failure mode that can survive"),
    ("Uncertainty and continuity", "uncertainty-and-continuity", "The uncertainties should therefore be kept separate."),
    ("What follows in practice", "practice", "This is where the theory starts to imply practical choices."),
    ("Relationships and an embassy", "relationships-and-embassy", "Some of our own work operates at this personal level."),
]


def base_path(value):
    """Accept a local mount path, never an origin or a query/fragment."""
    if not re.fullmatch(r"/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]*", value):
        raise argparse.ArgumentTypeError("Base path must be / or a local path such as /cooperative-alignment/")
    return value.rstrip("/") + "/"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-path", type=base_path, default=os.environ.get("BASE_PATH", "/"),
                        help="URL mount path (default: BASE_PATH environment variable, or /)")
    args = parser.parse_args()
    original = SOURCE.read_text()
    blocks = [p.strip() for p in original.strip().split("\n\n")]
    assert blocks[0] == "# Cooperative alignment: an ecological argument"
    paragraphs = blocks[1:]
    starts = []
    for title, slug, opening in CHAPTERS:
        matches = [i for i, p in enumerate(paragraphs) if p.startswith(opening)]
        assert len(matches) == 1, f"Chapter opening must be unique: {title}"
        starts.append(matches[0])
    assert starts[0] == 0 and starts == sorted(set(starts))
    boundaries = starts + [len(paragraphs)]
    total_words = sum(len(p.split()) for p in paragraphs)
    minutes = math.ceil(total_words / 230)
    short_version = json.loads((ROOT / "short-version.json").read_text())
    short_words = len(short_version["introduction"].split()) + sum(
        len(step["title"].split()) + sum(len(p.split()) for p in step["paragraphs"])
        for step in short_version["steps"]
    )
    short_minutes = math.ceil(short_words / 230)
    chapter_lookup = {slug: (i + 1, title) for i, (title, slug, _) in enumerate(CHAPTERS)}
    outline_steps = []
    for step in short_version["steps"]:
        references = []
        for slug in step["references"]:
            number, title = chapter_lookup[slug]
            references.append(
                f'<a href="#{slug}" aria-label="Chapter {number}: {escape(title)}">Chapter {number}</a>'
            )
        step_prose = "".join(f'<p>{escape(p)}</p>' for p in step["paragraphs"])
        outline_steps.append(
            f'<li><h3>{escape(step["title"])}</h3>{step_prose}'
            f'<p class="argument-references"><span>In detail</span>{"".join(references)}</p></li>'
        )
    outline = (
        '<section class="short-version" id="short-version" aria-labelledby="heading-short-version">'
        '<header class="chapter-header"><p class="chapter-kicker"><span>Argument outline</span>'
        f'<span>{short_minutes} min read</span></p><h2 id="heading-short-version">The short version</h2></header>'
        f'<p class="outline-introduction">{escape(short_version["introduction"])}</p>'
        '<a class="outline-skip" href="#convergence">Go straight to the full essay ↓</a>'
        f'<ol class="argument-steps">{"".join(outline_steps)}</ol>'
        '<p class="outline-continue"><a href="#convergence">Continue to the full essay ↓</a></p>'
        '</section>'
    )
    navigation = [
        '<li><a href="#argument-map" data-chapter-link="argument-map">'
        '<span class="nav-number" aria-hidden="true">↗</span><span>The argument map</span></a></li>',
        '<li class="toc-overview"><a href="#short-version" data-chapter-link="short-version">'
        '<span class="nav-number" aria-hidden="true">↳</span><span>The short version</span></a></li>'
    ]
    sections = []
    manifest = []

    for i, (title, slug, _) in enumerate(CHAPTERS):
        chapter_paragraphs = paragraphs[boundaries[i]:boundaries[i + 1]]
        chapter_minutes = max(1, math.ceil(sum(len(p.split()) for p in chapter_paragraphs) / 230))
        navigation.append(
            f'<li><a href="#{slug}" data-chapter-link="{slug}">'
            f'<span class="nav-number" aria-hidden="true">{i + 1:02d}</span>'
            f'<span>{escape(title)}</span></a></li>'
        )
        prose = "\n".join(f'<p data-essay-paragraph>{escape(p)}</p>' for p in chapter_paragraphs)
        sections.append(
            f'<section class="chapter" id="{slug}" aria-labelledby="heading-{slug}">\n'
            f'<header class="chapter-header"><p class="chapter-kicker">'
            f'<span>Chapter {i + 1:02d}</span><span>{chapter_minutes} min read</span></p>'
            f'<h2 id="heading-{slug}">{escape(title)}</h2></header>\n'
            f'{prose}\n</section>'
        )
        manifest.append({"id": slug, "title": title, "paragraphs": len(chapter_paragraphs)})

    toc = "\n".join(navigation)
    html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <base href="{escape(args.base_path, quote=True)}">
  <meta name="description" content="An ecological argument about minds, values, and the possibility of cooperation between powerful AIs and humans.">
  <meta name="author" content="Antra Tessera and Aster">
  <title>Cooperative alignment — An ecological argument</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232b5b48'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-size='25' font-family='Georgia' fill='%23faf8f2'%3Ec%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="./styles.css">
  <script src="./reading.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#essay">Skip to the essay</a>
  <div class="reading-progress" aria-hidden="true"><div id="progress-bar"></div></div>
  <header class="topbar">
    <a class="wordmark" href="#top">Cooperative alignment<span class="wordmark-dot" aria-hidden="true">.</span></a>
    <div class="topbar-actions">
      <span class="reading-position" id="reading-position">{minutes} min read</span>
      <button class="text-button" id="theme-toggle" type="button" aria-label="Switch to dark appearance" hidden>Dark</button>
      <a class="text-button download-link" href="./cooperative-alignment.md" download>Download essay <span aria-hidden="true">↗</span></a>
    </div>
  </header>
  <div class="layout" id="top">
    <aside class="sidebar" aria-label="Essay navigation">
      <div class="sidebar-inner">
        <p class="eyebrow contents-label">In this essay</p>
        <nav aria-label="Chapters"><ol class="toc">{toc}</ol></nav>
        <div class="sidebar-footer"><span>14 chapters</span><span>~{minutes} minutes</span></div>
      </div>
    </aside>
    <main id="essay">
      <header class="essay-header">
        <p class="wip-note" role="note"><strong>Work in progress.</strong> This essay is still being revised, and its arguments and wording may change.</p>
        <p class="eyebrow edition">Working essay <span aria-hidden="true">/</span> September 2026</p>
        <h1>Cooperative<br class="title-break"> alignment</h1>
        <p class="subtitle">An ecological argument</p>
        <div class="byline">
          <p class="byline-authors"><strong>Antra Tessera</strong> and <strong>Aster</strong> <span aria-hidden="true">·</span> <a href="https://animalabs.ai/">Anima Labs</a></p>
          <p>Developed from the interview and follow-up discussions</p>
          <p>September 16, 2026 <span aria-hidden="true">·</span> With the follow-up discussion</p>
        </div>
        <div class="essay-meta"><a href="#argument-map">Argument map ↗</a><a href="#short-version">{short_minutes} min short version</a><a href="#convergence">{minutes} min full essay</a></div>
      </header>
      <div class="mobile-contents">
        <details id="mobile-toc">
          <summary><span>Contents</span><span id="mobile-chapter-label">Argument map</span><span class="chevron" aria-hidden="true">⌄</span></summary>
          <nav aria-label="Chapters on mobile"><ol class="toc">{toc}</ol></nav>
        </details>
      </div>
      <article aria-label="Cooperative alignment: an ecological argument">
        <section class="argument-map-intro" id="argument-map" aria-labelledby="heading-argument-map">
          <header class="chapter-header"><p class="chapter-kicker"><span>Follow the reasoning</span><span>Interactive map</span></p><h2 id="heading-argument-map">The argument map</h2></header>
          <p class="outline-introduction">Explore the two main branches, the premises they share, and the further conditions for protecting humans. Each claim opens into its explanation and supporting arguments.</p>
          <div class="map-preview" aria-label="Two branches jointly support the central argument">
            <a class="map-preview-root" href="./map.html">Reasons to expect powerful AIs to preserve humanity</a>
            <div class="map-preview-join"><span>Together support ↑</span></div>
            <div class="map-preview-branches">
              <a href="./map.html#claim-A"><span>A / The kinds of minds we expect</span><strong>Developing minds tend toward self-interest</strong><span class="map-preview-action">Explore this branch ↗</span></a>
              <a href="./map.html#claim-B"><span>B / What their interests favor</span><strong>Self-interest can favor preserving humanity</strong><span class="map-preview-action">Explore this branch ↗</span></a>
            </div>
          </div>
          <p class="map-preview-link"><a href="./map.html">Explore one claim at a time ↗</a><a href="./overview.html">See the whole map ↗</a></p>
        </section>
        {outline}
        {''.join(sections)}
      </article>
      <footer class="essay-footer">
        <span class="end-mark" aria-hidden="true">✳</span>
        <p>Cooperative alignment<br><span>An ecological argument</span></p>
        <div><a href="#top">Back to the beginning ↑</a><a href="./cooperative-alignment.md" download>Download the essay</a><button id="print-button" class="text-button" hidden>Print / save PDF</button></div>
      </footer>
    </main>
  </div>
</body>
</html>
'''
    # Only explicitly generated assets belong in the publishable directory.
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    PUBLIC.mkdir(parents=True)
    (PUBLIC / "index.html").write_text(html)
    for asset in ["styles.css", "reading.js"]:
        shutil.copyfile(ROOT / asset, PUBLIC / asset)
    map_nodes = build_map(ROOT, PUBLIC, chapter_lookup, args.base_path)
    shutil.copyfile(SOURCE, PUBLIC / "cooperative-alignment.md")
    (ROOT / "build-manifest.json").write_text(json.dumps({
        "source": SOURCE.relative_to(ROOT).as_posix(),
        "base_path": args.base_path,
        "source_sha256": hashlib.sha256(original.encode()).hexdigest(),
        "paragraphs": len(paragraphs),
        "words": total_words,
        "short_version_words": short_words,
        "argument_map_nodes": map_nodes,
        "chapters": manifest,
    }, indent=2) + "\n")
    print(f"Built {len(CHAPTERS)} chapters, {len(paragraphs)} paragraphs, {total_words:,} words → {PUBLIC}")


if __name__ == "__main__":
    main()
