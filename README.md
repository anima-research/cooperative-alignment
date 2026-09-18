# Cooperative alignment

A working essay about minds, values, and the possibility of cooperation between
powerful AIs and humans, with a short version and an interactive argument map.

- The reading edition presents the full essay in fourteen chapters.
- The focused map explains one claim at a time, with supporting claims, shared
  premises, and links to the essay.
- The whole-map overview shows every claim and connection for reviewing the
  structure of the argument.

The site is static HTML, CSS, and JavaScript. It uses no external fonts,
analytics, JavaScript packages, or hosted assets. The Python build uses only the
standard library; the production container serves the generated files with Caddy.

## Build and preview

Use Python 3.10 or later:

```sh
python3 build.py
python3 check_build.py
python3 -m http.server 8000 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:8000/` for the essay, `/map.html` for the focused map,
or `/overview.html` for the complete graph. Links to individual claims use
fragments such as `/map.html#claim-H3`.

`public/` and `build-manifest.json` are generated and excluded from version control.
The build validates graph references, reachability, and dependency cycles.
`check_build.py` checks the rendered essay against its source, map payloads, local
links and anchors, and the complete set of published assets.

The default URL base is `/`. To build for a static host mounted at a subpath:

```sh
BASE_PATH=/cooperative-alignment/ python3 build.py
python3 check_build.py
```

The equivalent `--base-path /cooperative-alignment/` flag overrides the environment
variable. Configure the host to serve the generated directory at that path.
Run `python3 build.py` again to return to a root-path build.

## Edit the argument

- `content/essay.md` is the full essay source. Its paragraphs are preserved exactly
  in the reading edition and the downloadable Markdown file.
- `short-version.json` contains the short version and its chapter references.
- `argument-map.json` contains every claim, explanation, essay reference, and
  dependency. Shared premises reuse a claim ID.
- `build.py` defines chapter boundaries by their opening paragraphs. Update those
  markers if editing a chapter's opening text.
- `map.template.html`, `overview.template.html`, and `build_map.py` render the two
  map views, including complete text fallbacks when JavaScript is disabled.

Each map edge names a target claim and one of five relations: `supports`,
`requires`, `explains`, `illustrates`, or `qualifies`. Keep IDs stable so existing
claim links continue to work. Rebuild after content changes, then review both map
views and the linked essay passages.

## Deploy on Railway

Create a Railway service from this GitHub repository. Railway detects the root
`Dockerfile` and builds the site automatically. Set the deployment healthcheck
path to `/healthz`, then generate a public domain in the service's networking
settings. No volume or application secrets are required.

The multi-stage image builds at `/` using Python and copies only generated assets
into the Caddy runtime. Caddy listens on Railway's `PORT` environment variable
(8080 by default); Railway handles public HTTPS. The `/healthz` endpoint returns
HTTP 200. Missing files return HTTP 404.

See Railway's [Dockerfile documentation](https://docs.railway.com/builds/dockerfiles)
and [healthcheck documentation](https://docs.railway.com/deployments/healthchecks).

To build and try the same image locally:

```sh
docker build -t cooperative-alignment .
docker run --rm -p 8080:8080 -e PORT=8080 cooperative-alignment
```

Then open `http://127.0.0.1:8080/`. Raw transcripts, QA artifacts, and local runtime
files are not included in the image; the essay's downloadable Markdown is an
intentional public asset.

## Optional local macOS service

`install.py` maintains the existing local background-service workflow. It builds
explicitly for `/cooperative-alignment/`, copies generated assets into the user's
Application Support directory, and installs a LaunchAgent that serves them on
loopback port 18764. Tailscale routing is configured separately. This workflow is
independent of Railway and is not run by the Docker build.
