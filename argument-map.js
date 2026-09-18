(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('argument-map-data').textContent);
  const nodes = new Map(data.nodes.map(node => [node.id, node]));
  const parents = new Map(data.nodes.map(node => [node.id, []]));
  const edgesOf = node => node.groups.flatMap(group => group.edges);
  for (const node of data.nodes) {
    for (const edge of edgesOf(node)) {
      if (!parents.get(edge.to).some(parent => parent.id === node.id)) {
        parents.get(edge.to).push({ id: node.id, relation: edge.relation });
      }
    }
  }
  const $ = id => document.getElementById(id);
  const labels = {
    supports: 'Supporting reason', requires: 'Needed premise', explains: 'Explains the mechanism',
    illustrates: 'Illustration', qualifies: 'Condition / limit'
  };
  const root = document.documentElement;
  const toggle = $('theme-toggle');
  let savedTheme;
  try { savedTheme = localStorage.getItem('cooperative-alignment-theme'); } catch {}
  function setTheme(theme) {
    root.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    toggle.textContent = next === 'dark' ? 'Dark' : 'Light';
    toggle.setAttribute('aria-label', `Switch to ${next} appearance`);
  }
  setTheme(['light', 'dark'].includes(savedTheme) ? savedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('cooperative-alignment-theme', root.dataset.theme); } catch {}
  });
  const mobileLayout = matchMedia('(max-width: 760px)');
  $('map-detail').open = !mobileLayout.matches;
  mobileLayout.addEventListener('change', () => { $('map-detail').open = !mobileLayout.matches; });

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function button(text, className, action) {
    const el = element('button', className, text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  function shortestPath(target) {
    const queue = [[data.root]];
    const seen = new Set([data.root]);
    while (queue.length) {
      const candidate = queue.shift();
      const id = candidate[candidate.length - 1];
      if (id === target) return candidate;
      for (const edge of edgesOf(nodes.get(id))) {
        if (!seen.has(edge.to)) { seen.add(edge.to); queue.push([...candidate, edge.to]); }
      }
    }
    return [data.root];
  }
  function hashNode() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)).replace(/^claim-/, ''); } catch {}
    return nodes.has(id) ? id : data.root;
  }
  let path = shortestPath(hashNode());
  function validPath(candidate, target) {
    return Array.isArray(candidate) && candidate[0] === data.root && candidate[candidate.length - 1] === target &&
      candidate.every((id, i) => nodes.has(id) && (!i || edgesOf(nodes.get(candidate[i - 1])).some(edge => edge.to === id)));
  }
  if (validPath(history.state?.mapPath, hashNode())) path = history.state.mapPath;

  function openNode(id, requestedPath) {
    if (!nodes.has(id)) return;
    if (requestedPath) path = requestedPath;
    else if (path.includes(id)) path = path.slice(0, path.indexOf(id) + 1);
    else if (edgesOf(nodes.get(path[path.length - 1])).some(edge => edge.to === id)) path = [...path, id];
    else path = shortestPath(id);
    const url = new URL(location.href);
    url.hash = `claim-${id}`;
    history.pushState({ mapPath: path }, '', url);
    render(true);
  }

  function render(announce = false) {
    const node = nodes.get(path[path.length - 1]);
    document.title = `${node.id === data.root ? 'Argument map' : node.code + ': ' + node.title} — Cooperative alignment`;
    $('map-back').disabled = path.length <= 1;
    const crumbs = $('map-breadcrumbs');
    crumbs.replaceChildren();
    path.forEach((id, i) => {
      const claim = nodes.get(id);
      if (i) crumbs.append(element('span', 'map-breadcrumb-separator', '›'));
      const name = id === data.root ? 'Overview' : claim.code;
      if (i === path.length - 1) {
        const current = element('span', 'map-breadcrumb-current', name);
        current.setAttribute('aria-current', 'page');
        crumbs.append(current);
      } else {
        const crumb = button(name, '', () => openNode(id, path.slice(0, i + 1)));
        crumb.setAttribute('aria-label', `Return to ${claim.title}`);
        crumbs.append(crumb);
      }
    });
    const permalink = new URL(location.href);
    permalink.hash = `claim-${node.id}`;
    $('map-permalink').href = permalink.href;
    $('map-detail-kind').textContent = `${node.code} / ${node.kind}`;
    $('map-detail-title').textContent = node.title;
    $('map-detail-prose').replaceChildren(...node.paragraphs.map(p => element('p', '', p)));
    $('map-reference-links').replaceChildren(...node.references.map(slug => {
      const chapter = data.chapters[slug];
      const a = element('a');
      a.href = `./#${slug}`;
      a.append(element('span', 'map-ref-number', String(chapter.number).padStart(2, '0')), element('span', '', chapter.title));
      return a;
    }));
    const incoming = parents.get(node.id);
    $('map-parents').hidden = !incoming.length;
    $('map-parent-links').replaceChildren(...incoming.map(parent => {
      const claim = nodes.get(parent.id);
      const b = button('', '', () => openNode(claim.id));
      b.append(element('span', '', claim.code), element('span', '', claim.title));
      return b;
    }));

    const current = $('map-current');
    const currentTop = element('div', 'map-node-top');
    currentTop.append(element('span', 'map-code', node.code), element('span', 'map-node-role', 'Selected claim'));
    current.replaceChildren(currentTop, element('p', 'map-current-title', node.title));
    const groups = $('map-groups');
    groups.replaceChildren();
    for (const group of node.groups) {
      const section = element('section', 'map-group');
      section.append(element('h3', '', group.label));
      if (group.note) section.append(element('p', 'map-group-note', group.note));
      const children = element('div', 'map-child-list');
      for (const edge of group.edges) {
        const child = nodes.get(edge.to);
        const childEdges = edgesOf(child);
        const card = button('', 'map-node', () => openNode(child.id));
        card.dataset.node = child.id;
        card.dataset.relation = edge.relation;
        card.setAttribute('aria-label', `Explore ${child.code}: ${child.title}. ${edge.label || labels[edge.relation]}.`);
        const top = element('span', 'map-node-top');
        top.append(element('span', 'map-code', child.code), element('span', 'map-node-role', edge.label || labels[edge.relation]));
        const bottom = element('span', 'map-node-bottom');
        const count = childEdges.length;
        bottom.append(element('span', '', count ? `${count} connected ${count === 1 ? 'claim' : 'claims'}` : 'Read the explanation'));
        if (parents.get(child.id).length > 1) bottom.append(element('span', 'map-shared', 'Shared claim'));
        bottom.append(element('span', 'map-node-arrow', '↗'));
        card.append(top, element('span', 'map-node-title', child.title), bottom);
        children.append(card);
      }
      section.append(children);
      groups.append(section);
    }
    $('map-leaf-note').hidden = Boolean(edgesOf(node).length);
    requestAnimationFrame(drawConnections);
    if (announce) {
      $('map-announcement').textContent = `${node.title}. ${edgesOf(node).length} connected claims.`;
      ($('map-detail').open ? $('map-detail-title') : $('map-current')).focus({ preventScroll: true });
      const top = $('map-workspace').getBoundingClientRect().top;
      if (top < 65 || top > innerHeight * .45) {
        $('map-workspace').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    }
  }

  function drawConnections() {
    const canvas = $('map-canvas');
    const svg = $('map-connections');
    const rect = canvas.getBoundingClientRect();
    const cards = [...canvas.querySelectorAll('.map-node')];
    svg.replaceChildren();
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    if (!cards.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const make = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      return el;
    };
    const defs = make('defs', {});
    const marker = make('marker', {id:'map-arrow', viewBox:'0 0 8 8', refX:'7', refY:'4', markerWidth:'6', markerHeight:'6', orient:'auto'});
    marker.append(make('path', {d:'M 0 0 L 8 4 L 0 8 Z', fill:'var(--map-connector)'}));
    defs.append(marker); svg.append(defs);
    const selected = $('map-current').getBoundingClientRect();
    const railX = innerWidth <= 760 ? 6 : 9;
    const rootY = selected.top - rect.top + selected.height / 2;
    let bottom = rootY;
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      const y = box.top - rect.top + box.height / 2;
      bottom = Math.max(bottom, y);
      const attrs = {d:`M ${box.left - rect.left - 1} ${y} H ${railX}`, fill:'none', stroke:'var(--map-connector)', 'stroke-width':'1.3'};
      if (['qualifies', 'illustrates'].includes(card.dataset.relation)) attrs['stroke-dasharray'] = '3 3';
      svg.append(make('path', attrs));
    }
    svg.append(make('path', {d:`M ${railX} ${bottom} V ${rootY} H ${selected.left - rect.left - 3}`, fill:'none', stroke:'var(--map-connector)', 'stroke-width':'1.3', 'marker-end':'url(#map-arrow)'}));
  }

  $('map-back').addEventListener('click', () => {
    if (path.length > 1) openNode(path[path.length - 2], path.slice(0, -1));
  });
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    ($('map-detail').open ? $('map-detail-title') : $('map-current')).focus();
  });
  $('map-claim-count').textContent = `(${data.nodes.length})`;
  $('map-index-links').replaceChildren(...data.nodes.map(node => {
    const b = button('', '', () => { openNode(node.id); document.querySelector('.map-index').open = false; });
    b.append(element('span', '', node.code), element('span', '', node.title));
    return b;
  }));
  window.addEventListener('popstate', () => {
    path = validPath(history.state?.mapPath, hashNode()) ? history.state.mapPath : shortestPath(hashNode());
    render(true);
  });
  window.addEventListener('hashchange', () => {
    if (path[path.length - 1] !== hashNode()) { path = shortestPath(hashNode()); render(true); }
  });
  new ResizeObserver(drawConnections).observe($('map-canvas'));
  if (document.fonts) document.fonts.ready.then(drawConnections);
  render();
})();
