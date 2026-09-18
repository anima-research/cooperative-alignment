(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('argument-map-data').textContent);
  const $ = id => document.getElementById(id);
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  const edges = data.nodes.flatMap(n => n.groups.flatMap(group => group.edges.map(e => ({ from: n.id, to: e.to, relation: e.relation, label: e.label, group: group.label }))));
  const parents = new Map(data.nodes.map(n => [n.id, []]));
  const children = new Map(data.nodes.map(n => [n.id, []]));
  for (const edge of edges) { parents.get(edge.to).push(edge.from); children.get(edge.from).push(edge.to); }
  const width = 270, height = 152, columnGap = 146, rowGap = 28, padding = 50;
  const rank = new Map([[data.root, 0]]);
  function assignRank(id, depth) {
    if ((rank.get(id) ?? -1) > depth) return;
    rank.set(id, depth);
    for (const next of children.get(id)) assignRank(next, depth + 1);
  }
  assignRank(data.root, 0);
  const layerCount = Math.max(...rank.values()) + 1;
  const layers = Array.from({ length: layerCount }, () => []);
  const vertices = new Map();
  let order = 0;
  function traverse(id, branch = -1) {
    if (vertices.has(id)) return;
    const v = { id, rank: rank.get(id), order: order++, branch, before: [], after: [], dummy: false };
    vertices.set(id, v); layers[v.rank].push(v);
    children.get(id).forEach((next, i) => traverse(next, id === data.root ? i : branch));
  }
  traverse(data.root);
  edges.forEach((edge, index) => {
    const route = [vertices.get(edge.from)];
    for (let depth = rank.get(edge.from) + 1; depth < rank.get(edge.to); depth++) {
      const dummy = { id: `route-${index}-${depth}`, rank: depth, order: vertices.get(edge.to).order, branch: vertices.get(edge.from).branch, before: [], after: [], dummy: true };
      vertices.set(dummy.id, dummy); layers[depth].push(dummy); route.push(dummy);
    }
    route.push(vertices.get(edge.to)); edge.route = route;
    for (let i = 1; i < route.length; i++) { route[i - 1].after.push(route[i]); route[i].before.push(route[i - 1]); }
  });
  layers.forEach(layer => layer.sort((a, b) => a.order - b.order));
  function updateOrders() { layers.forEach(layer => layer.forEach((v, i) => { v.position = i; })); }
  updateOrders();
  for (let pass = 0; pass < 8; pass++) {
    const forward = pass % 2 === 0;
    const sequence = forward ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const layer of sequence) {
      const neighbors = v => forward ? v.before : v.after;
      const barycenter = v => { const near = neighbors(v); return near.length ? near.reduce((sum, n) => sum + n.position, 0) / near.length : v.position; };
      layer.sort((a, b) => a.branch - b.branch || barycenter(a) - barycenter(b) || a.position - b.position); updateOrders();
    }
  }
  const slotHeight = v => v.dummy ? 34 : height;
  const layerHeights = layers.map(layer => layer.reduce((sum, v) => sum + slotHeight(v) + rowGap, -rowGap));
  const graphHeight = Math.max(...layerHeights) + padding * 2;
  const graphWidth = layerCount * width + (layerCount - 1) * columnGap + padding * 2;
  layers.forEach((layer, layerIndex) => {
    let y = (graphHeight - layerHeights[layerIndex]) / 2;
    for (const v of layer) { v.x = padding + layerIndex * (width + columnGap); v.y = y + slotHeight(v) / 2; y += slotHeight(v) + rowGap; }
  });
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgElement(tag, attributes) { const e = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attributes)) e.setAttribute(key, value); return e; }
  function element(tag, className, text) { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; }
  const canvas = $('overview-canvas'), viewport = $('overview-viewport'), space = $('overview-space'), svg = $('overview-edges');
  canvas.style.width = `${graphWidth}px`; canvas.style.height = `${graphHeight}px`;
  svg.setAttribute('width', graphWidth); svg.setAttribute('height', graphHeight); svg.setAttribute('viewBox', `0 0 ${graphWidth} ${graphHeight}`);
  const defs = svgElement('defs', {}), marker = svgElement('marker', { id: 'overview-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' });
  marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'overview-arrow' })); defs.append(marker); svg.append(defs);
  const relationLabels = { supports: 'supports', requires: 'needed premise', explains: 'mechanism', illustrates: 'illustration', qualifies: 'condition' };
  const edgeElements = [];
  const outgoing = new Map(data.nodes.map(n => [n.id, edges.filter(e => e.from === n.id).sort((a, b) => a.route[1].y - b.route[1].y)]));
  const incoming = new Map(data.nodes.map(n => [n.id, edges.filter(e => e.to === n.id).sort((a, b) => a.route.at(-2).y - b.route.at(-2).y)]));
  const portY = (v, list, edge) => v.y + (list.indexOf(edge) - (list.length - 1) / 2) * Math.min(30, (height - 34) / Math.max(1, list.length));
  edges.forEach(edge => {
    const parent = vertices.get(edge.from), child = vertices.get(edge.to);
    const childY = portY(child, incoming.get(edge.to), edge), parentY = portY(parent, outgoing.get(edge.from), edge);
    const points = edge.route.flatMap((v, i) => i === 0 ? [{ x: v.x + width, y: parentY }] : i === edge.route.length - 1 ? [{ x: v.x, y: childY }] : [{ x: v.x, y: v.y }, { x: v.x + width, y: v.y }]).reverse();
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) { const p = points[i - 1], q = points[i], mid = (p.x + q.x) / 2; path += ` C ${mid} ${p.y}, ${mid} ${q.y}, ${q.x} ${q.y}`; }
    const link = svgElement('path', { d: path, class: `overview-edge${['qualifies', 'illustrates'].includes(edge.relation) ? ' is-qualified' : ''}`, 'marker-end': 'url(#overview-arrow)', 'data-from': edge.from, 'data-to': edge.to });
    const label = svgElement('text', { x: child.x - 12, y: childY - 7, 'text-anchor': 'end', class: 'overview-edge-label' });
    label.textContent = edge.label || relationLabels[edge.relation];
    const title = svgElement('title', {}); title.textContent = `${nodeMap.get(edge.to).code} → ${nodeMap.get(edge.from).code}: ${edge.label || relationLabels[edge.relation]} — ${edge.group}`; link.append(title);
    svg.append(link, label); edgeElements.push({ edge, link, label });
  });
  const cards = new Map();
  for (const node of data.nodes) {
    const v = vertices.get(node.id), uses = new Set(parents.get(node.id)).size;
    const card = element('a', `overview-card${node.id === data.root ? ' is-root' : ''}${uses > 1 ? ' is-shared' : ''}`);
    card.id = `overview-claim-${node.id}`; card.href = `./map.html#claim-${encodeURIComponent(node.id)}`; card.dataset.claim = node.id;
    card.style.cssText = `left:${v.x}px;top:${v.y - height / 2}px;width:${width}px;height:${height}px`;
    const top = element('span', 'overview-card-top'); top.append(element('span', 'overview-card-id', node.code === node.id ? node.code : `${node.code} · ${node.id}`), element('span', 'overview-card-kind', node.kind));
    const bottom = element('span', 'overview-card-bottom'); bottom.append(element('span', '', uses > 1 ? `Shared · used by ${uses} claims` : children.get(node.id).length ? `${children.get(node.id).length} connected grounds` : 'Supporting claim'), element('span', '', '↗'));
    card.append(top, element('span', 'overview-card-title', node.title), bottom); $('overview-nodes').append(card); cards.set(node.id, card);
    card.addEventListener('mouseenter', () => highlight(node.id)); card.addEventListener('mouseleave', () => highlight(null));
    card.addEventListener('focus', () => highlight(node.id)); card.addEventListener('blur', () => highlight(null));
    const option = element('option', '', `${node.code} — ${node.title}`); option.value = node.id; $('find-claim').append(option);
  }
  function highlight(id) {
    canvas.classList.toggle('has-highlight', Boolean(id));
    const related = new Set(id ? [id, ...parents.get(id), ...children.get(id)] : []);
    for (const [key, card] of cards) card.classList.toggle('is-related', related.has(key));
    for (const { edge, link, label } of edgeElements) { const adjacent = edge.from === id || edge.to === id; link.classList.toggle('is-related', adjacent); label.classList.toggle('is-related', adjacent); }
  }
  let zoom = 1, offsetX = 0, offsetY = 0, isFit = true;
  function setZoom(next, center) {
    const previous = zoom;
    const x = center?.x ?? (viewport.scrollLeft + viewport.clientWidth / 2 - offsetX) / previous;
    const y = center?.y ?? (viewport.scrollTop + viewport.clientHeight / 2 - offsetY) / previous;
    zoom = Math.max(.08, Math.min(1.5, next));
    offsetX = Math.max(0, (viewport.clientWidth - graphWidth * zoom) / 2);
    offsetY = Math.max(0, (viewport.clientHeight - graphHeight * zoom) / 2);
    canvas.style.left = `${offsetX}px`; canvas.style.top = `${offsetY}px`;
    canvas.style.transform = `scale(${zoom})`; space.style.width = `${graphWidth * zoom}px`; space.style.height = `${graphHeight * zoom}px`;
    viewport.scrollLeft = x * zoom + offsetX - viewport.clientWidth / 2; viewport.scrollTop = y * zoom + offsetY - viewport.clientHeight / 2;
    $('zoom-value').value = `${Math.round(zoom * 100)}%`; $('zoom-out').disabled = zoom <= .08; $('zoom-in').disabled = zoom >= 1.5;
  }
  function fit() { isFit = true; setZoom(Math.min((viewport.clientWidth - 12) / graphWidth, (viewport.clientHeight - 12) / graphHeight, 1), { x: graphWidth / 2, y: graphHeight / 2 }); }
  function readable() { isFit = false; const v = vertices.get($('find-claim').value || data.root); setZoom(1, { x: v.x + width / 2, y: v.y }); }
  $('zoom-in').addEventListener('click', () => { isFit = false; setZoom(zoom * 1.3); });
  $('zoom-out').addEventListener('click', () => { isFit = false; setZoom(zoom / 1.3); });
  $('zoom-fit').addEventListener('click', fit); $('zoom-readable').addEventListener('click', readable);
  $('find-claim').addEventListener('change', () => {
    const id = $('find-claim').value;
    for (const [key, card] of cards) card.classList.toggle('is-selected', key === id);
    if (!id) return;
    const v = vertices.get(id); isFit = false; setZoom(1, { x: v.x + width / 2, y: v.y });
    $('overview-status').textContent = `Centered ${nodeMap.get(id).code}: ${nodeMap.get(id).title}. Open the highlighted card to read it.`;
  });
  let drag;
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a')) return;
    drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', event => { if (drag) { viewport.scrollLeft = drag.left + drag.x - event.clientX; viewport.scrollTop = drag.top + drag.y - event.clientY; } });
  const endDrag = () => { drag = null; viewport.classList.remove('is-dragging'); };
  viewport.addEventListener('pointerup', endDrag); viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('wheel', event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); isFit = false; setZoom(zoom * Math.exp(-event.deltaY * .005)); } }, { passive: false });
  $('claim-count').textContent = `${data.nodes.length} claims`; $('connection-count').textContent = `${edges.length} connections`;
  const root = document.documentElement, toggle = $('theme-toggle');
  let savedTheme; try { savedTheme = localStorage.getItem('cooperative-alignment-theme'); } catch {}
  function setTheme(theme) { root.dataset.theme = theme; toggle.textContent = theme === 'dark' ? 'Light' : 'Dark'; toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`); }
  setTheme(['light', 'dark'].includes(savedTheme) ? savedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  toggle.hidden = false; toggle.addEventListener('click', () => { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'); try { localStorage.setItem('cooperative-alignment-theme', root.dataset.theme); } catch {} });
  $('overview-interactive').hidden = false;
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); viewport.focus(); viewport.scrollIntoView({ block: 'center' }); });
  fit();
  new ResizeObserver(() => { if (isFit) fit(); }).observe(viewport);
})();
