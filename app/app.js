'use strict';
/* VICE LEDGER — GTA VI trophy guide. Offline: data loads from data/trophies.json,
   progress persists in this browser's localStorage only. */

const STORE_KEY = 'vice-ledger-earned-v1';
const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

let TROPHIES = [];
let earned = new Set(loadEarned());
let openId = null;

const $ = (id) => document.getElementById(id);

function loadEarned() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEarned() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...earned]));
  } catch {
    /* storage unavailable (private mode): progress lasts for the session only */
  }
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtHours(minutes) {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/* ---------------- dashboard ---------------- */

function nextBest() {
  const remaining = TROPHIES.filter((t) => !earned.has(t.id));
  if (remaining.length === 0) return null;
  const regular = remaining.filter((t) => t.tier !== 'platinum');
  const pool = regular.length > 0 ? regular : remaining;
  return pool.slice().sort((a, b) =>
    a.minutes - b.minutes || b.points - a.points || a.name.localeCompare(b.name))[0];
}

function renderDashboard() {
  const total = TROPHIES.length;
  const done = TROPHIES.filter((t) => earned.has(t.id));
  const pts = done.reduce((s, t) => s + t.points, 0);
  const ptsTotal = TROPHIES.reduce((s, t) => s + t.points, 0);
  const pct = total === 0 ? 0 : Math.round((done.length / total) * 100);
  $('pct').textContent = pct + '%';
  $('bar-fill').style.width = pct + '%';
  $('points').textContent = pts.toLocaleString('en-US');
  $('points-total').textContent = ptsTotal.toLocaleString('en-US');
  $('earned-count').textContent = done.length;
  $('trophy-count').textContent = total;
  const left = TROPHIES.filter((t) => !earned.has(t.id) && t.tier !== 'platinum')
    .reduce((s, t) => s + t.minutes, 0);
  $('hours-left').textContent = fmtHours(left);
  for (const tier of Object.keys(TIER_LABEL)) {
    const all = TROPHIES.filter((t) => t.tier === tier);
    const got = all.filter((t) => earned.has(t.id)).length;
    $('tier-' + tier).textContent = got + '/' + all.length;
  }
  const nb = nextBest();
  if (nb === null) {
    $('next-name').textContent = 'Ledger complete — you are the Legend of Leonida.';
    $('next-meta').textContent = '';
    $('next-go').hidden = true;
  } else {
    $('next-go').hidden = false;
    $('next-name').textContent = nb.name;
    $('next-meta').textContent =
      TIER_LABEL[nb.tier] + ' · ' + nb.category + ' · about ' + nb.guide.timeEstimate.toLowerCase() +
      (nb.missable ? ' · MISSABLE — plan ahead' : '');
    $('next-go').onclick = () => showTrophy(nb.id);
  }
}

/* ---------------- checklist ---------------- */

function badge(text, cls) {
  return el('span', 'badge ' + cls, text);
}

function guideSection(t) {
  const g = el('div', 'guide');
  g.append(el('h3', '', 'The guide'));
  g.append(el('p', '', t.guide.summary));
  g.append(el('h3', '', 'Steps'));
  const ol = el('ol');
  for (const step of t.guide.steps) ol.append(el('li', '', step));
  g.append(ol);
  g.append(el('h3', '', 'Tips'));
  const ul = el('ul');
  for (const tip of t.guide.tips) ul.append(el('li', '', tip));
  g.append(ul);
  const time = el('p', '', 'Time estimate: ');
  const strong = el('span', 'g-time', t.guide.timeEstimate);
  time.append(strong);
  g.append(time);
  return g;
}

function trophyCard(t) {
  const card = el('article', 'trophy t-' + t.tier + (earned.has(t.id) ? ' earned' : ''));
  card.id = 'trophy-' + t.id;

  const head = el('div', 't-head');
  const check = el('input', 't-check');
  check.type = 'checkbox';
  check.checked = earned.has(t.id);
  check.setAttribute('aria-label', 'Mark ' + t.name + ' as earned');
  check.addEventListener('change', () => {
    if (check.checked) earned.add(t.id); else earned.delete(t.id);
    saveEarned();
    renderAll();
  });
  head.append(check);

  const body = el('div', 't-body');
  body.append(el('div', 't-name', t.name));
  body.append(el('div', 't-desc', t.description));
  const meta = el('div', 't-meta');
  meta.append(badge(TIER_LABEL[t.tier], 'tier ' + t.tier));
  meta.append(badge(t.category, 'cat'));
  if (t.missable) meta.append(badge('Missable', 'missable'));
  meta.append(badge(t.points + ' pts', 'points'));
  const time = el('span', 't-time', '≈ ' + t.guide.timeEstimate);
  meta.append(time);
  body.append(meta);
  body.addEventListener('click', () => {
    openId = openId === t.id ? null : t.id;
    renderList();
  });
  head.append(body);
  head.append(el('div', 't-caret', openId === t.id ? '▾ guide' : '▸ guide'));
  card.append(head);

  if (openId === t.id) card.append(guideSection(t));
  return card;
}

function currentFilters() {
  return {
    q: $('q').value.trim().toLowerCase(),
    tier: $('f-tier').value,
    category: $('f-category').value,
    sort: $('f-sort').value,
    missable: $('f-missable').checked,
    hideEarned: $('f-hide').checked,
  };
}

function visibleTrophies() {
  const f = currentFilters();
  let list = TROPHIES.filter((t) => {
    if (f.tier && t.tier !== f.tier) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.missable && !t.missable) return false;
    if (f.hideEarned && earned.has(t.id)) return false;
    if (f.q) {
      const hay = (t.name + ' ' + t.description + ' ' + t.category + ' ' + t.guide.summary).toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (f.sort === 'name') list.sort(byName);
  else if (f.sort === 'quickest') list.sort((a, b) => a.minutes - b.minutes || byName(a, b));
  else if (f.sort === 'points') list.sort((a, b) => b.points - a.points || byName(a, b));
  else list.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || byName(a, b));
  return list;
}

function renderList() {
  const list = visibleTrophies();
  const wrap = $('list');
  wrap.replaceChildren();
  for (const t of list) wrap.append(trophyCard(t));
  $('empty').hidden = list.length !== 0;
  $('result-count').textContent =
    'Showing ' + list.length + ' of ' + TROPHIES.length + ' trophies — click any trophy to open its full guide.';
}

function showTrophy(id) {
  switchView('checklist');
  $('q').value = '';
  $('f-tier').value = '';
  $('f-category').value = '';
  $('f-missable').checked = false;
  $('f-hide').checked = false;
  openId = id;
  renderList();
  const node = $('trophy-' + id);
  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- roadmap ---------------- */

const PHASES = [
  {
    title: 'Phase 1 — Story first, protect the missables',
    blurb: 'Play the story before anything else. Two trophies here — Mercy at Mile Marker 9 and Ghost of the Keys — ' +
      'can be missed for an entire playthrough, so keep a manual save before every chapter finale and read their guides before you start their missions.',
    pick: (t) => t.category === 'Story',
  },
  {
    title: 'Phase 2 — Heists & Scores',
    blurb: 'With the story done, the port heist stays replayable forever. Run its three approaches for Master Planner, ' +
      'rotate the bank branches, and let the takings fund everything after this phase.',
    pick: (t) => t.category === 'Heists & Scores',
  },
  {
    title: 'Phase 3 — The collectible sweep',
    blurb: 'Postcards, shells, murals, briefcases and the treasure chain. Go county by county and use the Collections ' +
      'menu counts to confirm each area is truly clean before you move on.',
    pick: (t) => t.category === 'Collectibles',
  },
  {
    title: 'Phase 4 — Hustles & the open world',
    blurb: 'Side hustles, strangers, races, jumps, dives and properties. Most of this is on your way to something else — ' +
      'weave it into Phases 2 and 3 rather than saving it all for one long cleanup.',
    pick: (t) => t.category === 'Side Hustles' || (t.category === 'World & Exploration' && t.tier !== 'platinum'),
  },
  {
    title: 'Phase 5 — The online grind',
    blurb: 'Rank 100 is the longest single road in the game, so start it on day one and feed it an hour at a time: ' +
      'featured double-RP jobs, one heist finale and one cargo sale per session is the rhythm that gets there.',
    pick: (t) => t.category === 'Online',
  },
  {
    title: 'Phase 6 — The platinum',
    blurb: 'Nothing extra to do — the Legend of Leonida pops the moment the last trophy above it lands. ' +
      'If exactly one trophy is holding you up, it is almost always Leonida Elite or Property Baron.',
    pick: (t) => t.tier === 'platinum',
  },
];

function renderRoadmap() {
  const wrap = $('roadmap');
  wrap.replaceChildren();
  for (const phase of PHASES) {
    const items = TROPHIES.filter(phase.pick);
    const done = items.filter((t) => earned.has(t.id)).length;
    const section = el('section', 'phase');
    const head = el('div', 'phase-head');
    head.append(el('h3', '', phase.title));
    head.append(el('span', 'phase-count', done + ' / ' + items.length + ' earned'));
    section.append(head);
    const bar = el('div', 'phase-bar');
    const fill = el('div');
    fill.style.width = (items.length === 0 ? 0 : Math.round((done / items.length) * 100)) + '%';
    bar.append(fill);
    section.append(bar);
    section.append(el('p', '', phase.blurb));
    const ul = el('ul', 'phase-list');
    for (const t of items) {
      const li = el('li', earned.has(t.id) ? 'done' : '');
      li.append(el('span', '', earned.has(t.id) ? '☑' : '☐'));
      const name = el('span', 'p-name', t.name);
      name.style.cursor = 'pointer';
      name.addEventListener('click', () => showTrophy(t.id));
      li.append(name);
      li.append(el('span', '', ' — ' + TIER_LABEL[t.tier] + ' · ' + t.guide.timeEstimate));
      if (t.missable) li.append(el('span', 'flag', 'Missable'));
      ul.append(li);
    }
    section.append(ul);
    wrap.append(section);
  }
}

/* ---------------- views & wiring ---------------- */

function switchView(which) {
  const isList = which === 'checklist';
  $('view-checklist').hidden = !isList;
  $('view-roadmap').hidden = isList;
  $('tab-checklist').classList.toggle('active', isList);
  $('tab-roadmap').classList.toggle('active', !isList);
}

function renderAll() {
  renderDashboard();
  renderList();
  renderRoadmap();
}

function wire() {
  for (const id of ['q', 'f-tier', 'f-category', 'f-sort', 'f-missable', 'f-hide']) {
    $(id).addEventListener('input', renderList);
    $(id).addEventListener('change', renderList);
  }
  $('tab-checklist').addEventListener('click', () => switchView('checklist'));
  $('tab-roadmap').addEventListener('click', () => switchView('roadmap'));
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-reset').addEventListener('click', () => {
    if (window.confirm('Clear every checkmark and start the ledger over?')) {
      earned = new Set();
      saveEarned();
      renderAll();
    }
  });
}

async function boot() {
  try {
    const res = await fetch('data/trophies.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    TROPHIES = data.trophies;
  } catch (err) {
    $('list').append(el('p', 'empty',
      'The trophy data could not be loaded. If you opened this page straight from a file, ' +
      'serve the app folder with any static web server and reload — the guide itself works fully offline.'));
    return;
  }
  const cats = [...new Set(TROPHIES.map((t) => t.category))];
  for (const c of cats) {
    const opt = el('option', '', c);
    opt.value = c;
    $('f-category').append(opt);
  }
  wire();
  renderAll();
}

document.addEventListener('DOMContentLoaded', boot);
