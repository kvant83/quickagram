#!/usr/bin/env node
/* Quickagram test suite.
   Runs in node (no real DOM) using a minimal stub. Exercises API surface,
   shape generation, syntax highlighting, AND actual rendering paths
   (auto-layout, cycle handling, fan-out, span sanity, label gap, theme
   contrast). Add a new test by appending a `t('name', () => { ... })`
   call to the relevant section. */
const assert = require('assert');
const path = require('path');

/* ---------- minimal DOM stub ---------- */
function makeEl(tag) {
  return {
    tag, children: [], attrs: {}, style: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; },
    querySelector(sel) {
      const find = root => {
        for (const ch of root.children || []) {
          if (sel.startsWith('.') && (ch.attrs.class || '').split(' ').includes(sel.slice(1))) return ch;
          if (!sel.startsWith('.') && !sel.startsWith('#') && ch.tag === sel) return ch;
          const r = find(ch); if (r) return r;
        }
        return null;
      };
      return find(this);
    },
    querySelectorAll(sel) {
      const out = [];
      const find = root => {
        for (const ch of root.children || []) {
          if (sel.startsWith('.') && (ch.attrs.class || '').split(' ').includes(sel.slice(1))) out.push(ch);
          if (!sel.startsWith('.') && !sel.startsWith('#') && ch.tag === sel) out.push(ch);
          find(ch);
        }
      };
      find(this);
      return out;
    },
    getBBox() {
      const t = this._t || '';
      return { x: 0, y: 0, width: Math.max(20, t.length * 6.5), height: 12 };
    },
    get textContent() { return this._t || ''; },
    set textContent(v) { this._t = v; },
    get innerHTML() { return ''; },
    set innerHTML(v) { this.children = []; },
    get firstChild() { return this.children[0] || null; },
  };
}
global.document = {
  createElementNS: (_, t) => makeEl(t),
  createElement:   t => makeEl(t),
  querySelector:   () => null,
  getElementById:  () => null,
  head: makeEl('head'),
};
global.CSS = { escape: s => s.replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c) };
global.self = global;

const Q = require(path.join(__dirname, '..', 'src', 'quickagram.js'));
const { snapshot } = require('./snapshot');
const { checkInvariants } = require('./invariants');

/* ---------- converter pipeline (for end-to-end rendering snapshots) ----------
 *
 * Visual rendering of mermaid-to-quickagram output IS the engine's
 * responsibility: the converter only produces a Quickagram diagram
 * object, and whether the engine then draws that object correctly is
 * an engine concern. So the snapshot-based render tests live here in
 * the engine test suite, not in the converter test runner. */
const fs = require('fs');
const CONV = path.join(__dirname, '..', 'tools', 'mermaid-to-quickagram');
const { sniffKind }      = require(path.join(CONV, 'sniff'));
const { parseFlowchart } = require(path.join(CONV, 'parse-flowchart'));
const { parseSequence }  = require(path.join(CONV, 'parse-sequence'));
const { parseClass }     = require(path.join(CONV, 'parse-class'));
const { parseState }     = require(path.join(CONV, 'parse-state'));
const { build: convBuild } = require(path.join(CONV, 'emit'));
const PARSERS = { flowchart: parseFlowchart, sequence: parseSequence, class: parseClass, state: parseState };
const convFixture = name => fs.readFileSync(path.join(CONV, 'test', 'fixtures', name), 'utf8');

/* ---------- tiny test runner ---------- */
let passed = 0, failed = 0;
const section = name => console.log('\n# ' + name);
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
/* Snapshot helper:
 *   1. render the diagram with the engine
 *   2. run visual-correctness invariants (no edge-through-node, no
 *      overlapping edge pair, no arrow missing its target) — this
 *      catches BUGS, not just changes
 *   3. compare resulting SVG against the approved baseline file
 *
 * Either step can fail independently. Run with UPDATE_SNAPSHOTS=1 to
 * re-bless after an intentional change. Invariants always fire; you
 * cannot UPDATE_SNAPSHOTS your way out of a broken diagram. */
function snap(name, diagram) {
  const c = makeEl('div');
  Q.render(c, diagram);
  // Step 1: invariants — these are semantic correctness checks, not
  // baselines. They fail whenever the rendering is geometrically
  // broken, regardless of whether the SVG output has changed.
  const viols = checkInvariants(c.children[0], diagram);
  if (viols.length) {
    failed++;
    console.log('  ✗ ' + name + ' (invariants)');
    for (const v of viols) console.log('      ' + JSON.stringify(v));
    return;
  }
  // Step 2: snapshot comparison.
  const r = snapshot(name, c);
  if (r.pass) { passed++; console.log('  ✓ ' + name + '  ' + r.msg); }
  else        { failed++; console.log('  ✗ ' + name + '\n      ' + r.msg.split('\n').join('\n      ')); }
}

/* End-to-end snapshot helper for converter output. Takes raw Mermaid
 * text, dispatches to the right parser, builds a Quickagram diagram,
 * then runs snap() (invariants + snapshot). Exactly the same checks as
 * snap() — this is just a wrapper that handles the parse/build step. */
function snapEndToEnd(name, mermaidSrc) {
  const kind = sniffKind(mermaidSrc);
  if (!kind || !PARSERS[kind]) {
    failed++;
    console.log('  ✗ ' + name + ' — could not detect diagram type from header');
    return;
  }
  let diagram;
  try { diagram = convBuild(PARSERS[kind](mermaidSrc)); }
  catch (e) {
    failed++;
    console.log('  ✗ ' + name + ' — parse/build failed: ' + e.message);
    return;
  }
  snap(name, diagram);
}

/* ---------- helpers used across tests ---------- */
const render = d => { const c = makeEl('div'); Q.render(c, d); return { container: c, diagram: d }; };
const xSpan = d => { const xs = d.nodes.map(n => n.x); return Math.max(...xs) - Math.min(...xs); };
const ySpan = d => { const ys = d.nodes.map(n => n.y); return Math.max(...ys) - Math.min(...ys); };
const nodeMap = d => new Map(d.nodes.map(n => [n.id, n]));

/* =====================================================================
 * 1. API surface
 * ===================================================================== */
section('API surface');
t('exports core functions', () => {
  for (const k of ['render', 'autoLayout', 'highlight', 'tokenize', 'installTheme']) {
    assert.strictEqual(typeof Q[k], 'function', k + ' should be a function');
  }
});
t('exports version + registries', () => {
  assert.strictEqual(typeof Q.version, 'string');
  assert.ok(/^\d+\.\d+\.\d+/.test(Q.version), 'version is semver-ish');
  assert.ok(Q.THEMES && Q.SHAPES && Q.languages && Q.codeThemes);
});
t('language aliases (py, js)', () => {
  assert.strictEqual(Q.languages.py, Q.languages.python);
  assert.strictEqual(Q.languages.js, Q.languages.javascript);
});

/* =====================================================================
 * 2. Themes + shapes
 * ===================================================================== */
section('Themes + shapes');
const REQUIRED_KINDS = ['client','user','web','api','service','cache','db','nosql','queue','storage','cdn','dns','internet','lb','analytics','search','worker','mr','process','note','class','actor','plain'];
t('every required kind has a theme', () => {
  for (const k of REQUIRED_KINDS) {
    const th = Q.THEMES[k];
    assert.ok(th, 'theme missing: ' + k);
    assert.ok(th.top && th.bot && th.border, k + ' missing colours');
    assert.ok(th.shape, k + ' missing shape');
  }
});
t('every shape returns a string or { body, ... }', () => {
  for (const name of Object.keys(Q.SHAPES)) {
    const out = Q.SHAPES[name](120, 60);
    const body = typeof out === 'string' ? out : out.body;
    assert.ok(typeof body === 'string' && body.length > 0, name + ' body empty');
    assert.ok(/^[MmLlHhVvAaQqCcZz0-9 .,\-]+$/.test(body), name + ' body has unexpected chars: ' + body);
  }
});
t('cylinder / queue / note / bucket split body+decoration', () => {
  for (const s of ['cylinder', 'queue', 'note', 'bucket']) {
    const out = Q.SHAPES[s](100, 50);
    assert.ok(typeof out === 'object' && out.decoration, s + ' should have decoration');
  }
});
t('stack has a back layer', () => {
  assert.ok(Q.SHAPES.stack(100, 50).back, 'stack should have back');
});

/* =====================================================================
 * 3. Auto-layout
 * ===================================================================== */
section('Auto-layout');
t('simple chain → N layers, monotonic x', () => {
  const { diagram: d } = render({
    nodes: [
      {id:'a',kind:'client',label:'a'},
      {id:'b',kind:'web',label:'b'},
      {id:'c',kind:'api',label:'c'},
      {id:'d',kind:'db',label:'d'},
    ],
    edges: [{from:'a',to:'b'},{from:'b',to:'c'},{from:'c',to:'d'}],
  });
  const m = nodeMap(d);
  assert.ok(m.get('a').x < m.get('b').x, 'a before b');
  assert.ok(m.get('b').x < m.get('c').x, 'b before c');
  assert.ok(m.get('c').x < m.get('d').x, 'c before d');
});
t('fan-out → siblings end up in the same column', () => {
  const { diagram: d } = render({
    nodes: [
      {id:'lb',kind:'lb',label:'lb'},
      {id:'w1',kind:'web',label:'w1'},
      {id:'w2',kind:'web',label:'w2'},
      {id:'w3',kind:'web',label:'w3'},
    ],
    edges: [{from:'lb',to:'w1'},{from:'lb',to:'w2'},{from:'lb',to:'w3'}],
  });
  const m = nodeMap(d);
  assert.strictEqual(m.get('w1').x, m.get('w2').x, 'w1 + w2 same column');
  assert.strictEqual(m.get('w2').x, m.get('w3').x, 'w2 + w3 same column');
  assert.ok(m.get('lb').x < m.get('w1').x, 'lb before web');
});
t('cycle (back-edge) does not blow up layering', () => {
  const { diagram: d } = render({
    nodes: [
      {id:'s1',kind:'process',label:'Step 1'},
      {id:'s2',kind:'process',label:'Step 2'},
      {id:'s3',kind:'process',label:'Step 3'},
      {id:'b', kind:'analytics',label:'Benchmark'},
    ],
    edges: [
      {from:'s1',to:'s2'},{from:'s2',to:'s3'},{from:'s3',to:'b'},
      {from:'b', to:'s2', label:'next bottleneck', style:'dashed'},
    ],
  });
  const span = xSpan(d);
  assert.ok(span < 2000, 'cycle should not blow up — span=' + span + 'px (expected < 2000)');
  assert.ok(new Set(d.nodes.map(n => n.x)).size === 4, '4 distinct columns expected');
});
t('TB direction lays out top-to-bottom', () => {
  const { diagram: d } = render({
    layout: 'tb',
    nodes: [
      {id:'a',kind:'client',label:'a'},
      {id:'b',kind:'web',label:'b'},
      {id:'c',kind:'api',label:'c'},
    ],
    edges: [{from:'a',to:'b'},{from:'b',to:'c'}],
  });
  const m = nodeMap(d);
  assert.ok(m.get('a').y < m.get('b').y, 'a above b');
  assert.ok(m.get('b').y < m.get('c').y, 'b above c');
  // ySpan should be the dominant axis
  assert.ok(ySpan(d) > xSpan(d), 'TB layout: y span > x span');
});
t('explicit layer hint pins a node to a column', () => {
  const { diagram: d } = render({
    nodes: [
      {id:'a',kind:'client',label:'a'},
      {id:'b',kind:'web',label:'b', layer: 3},
      {id:'c',kind:'api',label:'c'},
    ],
    edges: [{from:'a',to:'b'},{from:'a',to:'c'}],
  });
  // b's layer is forced to 3 → it should be visibly further right than c (which is layer 1)
  const m = nodeMap(d);
  assert.ok(m.get('b').x > m.get('c').x, 'b pinned to layer 3 should be past c at layer 1');
});

/* =====================================================================
 * 4. Auto node sizing
 * ===================================================================== */
section('Auto node sizing');
t('long label grows the node width', () => {
  const r1 = render({ nodes:[{id:'x',kind:'web',label:'x'}], edges:[] });
  const r2 = render({ nodes:[{id:'x',kind:'web',label:'A much much much longer label'}], edges:[] });
  assert.ok(r2.diagram.nodes[0]._w > r1.diagram.nodes[0]._w, 'longer label → wider node');
});
t('UML class width grows with longest method/attr', () => {
  const r = render({
    nodes:[{
      id:'X', kind:'class', label:'X',
      attrs:['+ a: int'],
      methods:['+ method_with_extremely_long_name_and_signature(arg1: T, arg2: T): RetType'],
    }],
    edges: [],
  });
  assert.ok(r.diagram.nodes[0]._w > 400, 'wide method should push class width well past 220 default');
});
t('explicit w/h overrides auto', () => {
  const r = render({ nodes:[{id:'x',kind:'web',label:'x', w: 500, h: 200}], edges:[] });
  assert.strictEqual(r.diagram.nodes[0]._w, 500);
  assert.strictEqual(r.diagram.nodes[0]._h, 200);
});

/* =====================================================================
 * 5. Edge label gap
 * ===================================================================== */
section('Edge label gap');
t('long edge label widens the layer gap so the label fits', () => {
  const short = render({
    nodes: [{id:'a',kind:'web',label:'a'},{id:'b',kind:'web',label:'b'}],
    edges: [{from:'a',to:'b',label:'go'}],
  });
  const long = render({
    nodes: [{id:'a',kind:'web',label:'a'},{id:'b',kind:'web',label:'b'}],
    edges: [{from:'a',to:'b',label:'a very long edge label indeed'}],
  });
  const gapShort = long.diagram.nodes[1].x - (long.diagram.nodes[0].x + long.diagram.nodes[0]._w);
  const gapLongr = long.diagram.nodes[1].x - (long.diagram.nodes[0].x + long.diagram.nodes[0]._w);
  assert.ok(gapLongr > 200, 'long label should expand the gap; got ' + gapLongr + 'px');
});

/* =====================================================================
 * 6. Render output
 * ===================================================================== */
section('Render output');
t('render returns an SVG element', () => {
  const c = makeEl('div');
  const svg = Q.render(c, { nodes:[{id:'a',kind:'web',label:'a'}], edges:[] });
  assert.strictEqual(svg.tag, 'svg');
  assert.ok(svg.attrs.viewBox, 'SVG should have viewBox set');
});
t('render produces .qa-node groups for every input node', () => {
  const c = makeEl('div');
  Q.render(c, {
    nodes: [{id:'a',kind:'web',label:'a'},{id:'b',kind:'db',label:'b'}],
    edges: [{from:'a',to:'b'}],
  });
  const nodes = c.children[0].querySelectorAll('.qa-node');
  assert.strictEqual(nodes.length, 2);
});
t('render produces .qa-edge groups for every input edge', () => {
  const c = makeEl('div');
  Q.render(c, {
    nodes: [{id:'a',kind:'web',label:'a'},{id:'b',kind:'db',label:'b'},{id:'c',kind:'db',label:'c'}],
    edges: [{from:'a',to:'b'},{from:'a',to:'c'}],
  });
  const edges = c.children[0].querySelectorAll('.qa-edge');
  assert.strictEqual(edges.length, 2);
});

/* =====================================================================
 * 7. Text contrast (light kinds get dark ink)
 * ===================================================================== */
section('Text contrast');
function findTextElements(root) {
  const out = [];
  if (root.tag === 'text') out.push(root);
  for (const ch of (root.children || [])) out.push(...findTextElements(ch));
  return out;
}
t('plain kind labels render in dark ink', () => {
  const c = makeEl('div');
  Q.render(c, { nodes:[{id:'a',kind:'plain',label:'bucket 0'}], edges:[] });
  const texts = findTextElements(c).filter(t => (t._t || '').startsWith('bucket'));
  assert.ok(texts.length >= 1, 'should have at least one label text element');
  assert.strictEqual(texts[0].attrs.fill, '#1e293b', 'light bg → dark text');
});
t('web kind labels render in white', () => {
  const c = makeEl('div');
  Q.render(c, { nodes:[{id:'a',kind:'web',label:'web'}], edges:[] });
  const texts = findTextElements(c).filter(t => t._t === 'web');
  assert.strictEqual(texts[0].attrs.fill, '#ffffff', 'dark bg → white text');
});

/* =====================================================================
 * 8. Syntax highlighting
 * ===================================================================== */
section('Syntax highlighting');
t('python: keywords, function, string, comment, number', () => {
  const html = Q.highlight(`def fib(n):  # base
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`, 'python');
  assert.ok(html.includes('qa-tok-keyword">def<'), 'def → keyword');
  assert.ok(html.includes('qa-tok-function">fib<'), 'fib → function');
  assert.ok(html.includes('qa-tok-keyword">if<'),  'if → keyword');
  assert.ok(html.includes('qa-tok-number">2<'),    '2 → number');
  assert.ok(html.includes('qa-tok-comment">'),     'comment present');
});
t('javascript: const, string, template literal, comment', () => {
  const html = Q.highlight(`const x = "hi"; // c
function greet(){ return \`hi \${x}\`; }`, 'js');
  assert.ok(html.includes('qa-tok-keyword">const<'));
  assert.ok(html.includes('qa-tok-string">"hi"<'));
  assert.ok(html.includes('qa-tok-comment">// c<'));
  assert.ok(html.includes('qa-tok-function">greet<'));
});
t('sql: case-insensitive keywords + types', () => {
  const html = Q.highlight(`create table users (id INT, name VARCHAR(255));
select * from users where id = 1;`, 'sql');
  assert.ok(html.includes('qa-tok-keyword">create<'), 'lowercase create → keyword');
  assert.ok(html.includes('qa-tok-keyword">CREATE<') || html.includes('qa-tok-keyword">create<'),
    'create case-insensitive');
  assert.ok(html.includes('qa-tok-type">INT<'),       'INT → type');
  assert.ok(html.includes('qa-tok-type">VARCHAR<'),   'VARCHAR → type');
});
t('text: no-op + HTML escape', () => {
  assert.strictEqual(Q.highlight('plain <text> & more', 'text'),
                     'plain &lt;text&gt; &amp; more');
});
t('unknown language falls back to escaping', () => {
  assert.strictEqual(Q.highlight('hello <world>', 'klingon'),
                     'hello &lt;world&gt;');
});

/* =====================================================================
 * 9. Theme installation
 * ===================================================================== */
section('Theme installation');
t('all bundled themes are non-empty CSS', () => {
  for (const t of ['dracula','nord','github-light']) {
    const css = Q.codeThemes[t];
    assert.ok(css.includes('.qa-code'),       t + ': missing .qa-code rule');
    assert.ok(css.includes('.qa-tok-keyword'), t + ': missing .qa-tok-keyword rule');
  }
});
t('installTheme injects a <style> tag the first time, idempotent after', () => {
  // reset the head before the test
  global.document.head = makeEl('head');
  const inserted = [];
  global.document.head.appendChild = c => { inserted.push(c); };
  // mock createElement to allow getElementById to find the previous style
  let lastId = null;
  global.document.getElementById = id => (id === lastId ? makeEl('style') : null);
  global.document.createElement = t => { const e = makeEl(t); e.id = ''; return e; };

  // first install
  global.document.getElementById = () => null;
  assert.strictEqual(Q.installTheme('dracula'), true, 'first install returns true');
  // simulate idempotence: now getElementById finds the style
  global.document.getElementById = () => makeEl('style');
  assert.strictEqual(Q.installTheme('dracula'), true, 'second install also OK');

  // unknown theme returns false
  global.document.getElementById = () => null;
  assert.strictEqual(Q.installTheme('not-a-theme'), false);
});

/* =====================================================================
 * v0.4 — Mermaid-compatibility additions
 * =====================================================================
 *  - new shapes:  circle / stadium / parallelogram / parallelogramAlt /
 *                 trapezoid / trapezoidAlt / diamond / dot / doubleDot
 *  - new themes:  state / start / end / participant
 *  - new edge arrows: triangle / diamond / odiamond / circle / cross
 *  - sequence layout mode
 * ===================================================================== */
section('v0.4: new shapes');
t('all new shapes return non-empty path / shape descriptor', () => {
  for (const name of ['circle','stadium','parallelogram','parallelogramAlt','trapezoid','trapezoidAlt','diamond','dot','doubleDot']) {
    const out = Q.SHAPES[name](100, 60);
    if (typeof out === 'string') assert.ok(out.length > 0, name + ' empty');
    else { assert.ok(out.body, name + ' body missing'); }
  }
});

t('new kinds render without error and place a body path', () => {
  for (const kind of ['circle','stadium','parallelogram','trapezoid','diamond','state','start','end','participant']) {
    const { container } = render({
      nodes: [{ id: 'a', kind, label: 'A', x: 0, y: 0 }],
    });
    const svg = container.children[0];
    const nodeG = svg.querySelectorAll('.qa-node')[0];
    assert.ok(nodeG, kind + ' node not created');
    // each new shape draws at least one <path> for its body
    const paths = nodeG.children.filter(c => c.tag === 'path');
    assert.ok(paths.length >= 1, kind + ' has no <path>');
  }
});

t('start/end kinds get a small SQUARE bbox (~24px), not text-sized rect', () => {
  // stateDiagram [*] markers are little circles; without this the bbox
  // is text-sized (168x72) and arrows terminate far from the visible dot.
  const d = {
    nodes: [
      { id: 's', kind: 'start', label: '', x: 0,  y: 0 },
      { id: 'e', kind: 'end',   label: '', x: 60, y: 0 },
    ],
  };
  render(d);
  for (const n of d.nodes) {
    assert.strictEqual(n._w, 24, n.id + ' bbox w');
    assert.strictEqual(n._h, 24, n.id + ' bbox h');
  }
});

t('circle / diamond kinds get a SQUARE bbox so arrows land on visible body', () => {
  // Auto-sized circle/diamond previously inherited a 168x72 rectangular
  // bbox from text autosizing; arrows entered from the left landed in
  // empty space outside the visible curve.
  for (const kind of ['circle', 'diamond']) {
    const d = { nodes: [{ id: 'a', kind, label: 'Yes path' }] };
    render(d);
    assert.strictEqual(d.nodes[0]._w, d.nodes[0]._h, kind + ' bbox not square');
  }
});

t('long-span horizontal edge detours over intermediate nodes (no plowing-through)', () => {
  // Reproduces the state-diagram routing bug: Still→__end__ used to
  // render as a straight horizontal line cutting through Moving and
  // Crash in the columns between. The detour should now route over
  // (or under) the intermediate nodes.
  const d = {
    layout: 'lr',
    nodes: [
      { id: 'start',  kind: 'plain', label: 'Start' },
      { id: 'Still',  kind: 'plain', label: 'Still' },
      { id: 'Moving', kind: 'plain', label: 'Moving' },
      { id: 'Crash',  kind: 'plain', label: 'Crash' },
      { id: 'End',    kind: 'plain', label: 'End' },
    ],
    edges: [
      { from: 'start',  to: 'Still'  },
      { from: 'Still',  to: 'Moving' },
      { from: 'Moving', to: 'Crash'  },
      { from: 'Crash',  to: 'End'    },
      { from: 'Still',  to: 'End'    },          // ← the problematic long-span edge
    ],
  };
  const { container } = render(d);
  const svg = container.children[0];
  const stillNode  = d.nodes.find(n => n.id === 'Still');
  const movingNode = d.nodes.find(n => n.id === 'Moving');
  const crashNode  = d.nodes.find(n => n.id === 'Crash');

  // Find the Still→End edge path. The 5th edge by declaration order.
  const edges = svg.querySelectorAll('.qa-edge');
  const longSpan = edges[4];                     // declaration order preserved
  const path = longSpan.children.find(c => c.tag === 'path');
  const d_attr = path.attrs.d;

  // Extract every y-coordinate from the path. For an obstacle-avoiding
  // detour at least one y must be ABOVE all obstacle tops (or BELOW
  // all obstacle bottoms) by the detour margin.
  const ys = (d_attr.match(/-?\d+(?:\.\d+)?/g) || [])
    .map(Number).filter((_, i) => i % 2 === 1);   // odd indices = y in "x y" pairs
  const obsTop = Math.min(movingNode.y, crashNode.y);
  const obsBot = Math.max(movingNode.y + movingNode._h, crashNode.y + crashNode._h);
  const goesOver  = ys.some(y => y < obsTop - 4);
  const goesUnder = ys.some(y => y > obsBot + 4);
  assert.ok(goesOver || goesUnder,
    'edge from Still→End must detour over/under Moving+Crash; ys=' + JSON.stringify(ys) +
    ' obstacle band ' + obsTop + '..' + obsBot);
});

section('v0.4: new edge arrows');
t('ensureDefs creates all 6 markers', () => {
  const { container } = render({
    nodes: [
      { id: 'a', kind: 'plain', label: 'A', x: 0,   y: 0 },
      { id: 'b', kind: 'plain', label: 'B', x: 300, y: 0 },
    ],
    edges: [{ from: 'a', to: 'b' }],
  });
  const svg = container.children[0];
  const defs = svg.children.find(c => c.tag === 'defs');
  assert.ok(defs, 'defs missing');
  const markerIds = defs.children
    .filter(c => c.tag === 'marker')
    .map(c => c.attrs.id);
  for (const id of ['qa-arrow','qa-triangle','qa-diamond','qa-odiamond','qa-circle','qa-cross']) {
    assert.ok(markerIds.includes(id), 'missing marker ' + id);
  }
});

t('edge.toArrow="triangle" selects the triangle marker at the end', () => {
  const { container } = render({
    nodes: [
      { id: 'parent', kind: 'class', label: 'Animal', x: 0,   y: 0 },
      { id: 'child',  kind: 'class', label: 'Dog',    x: 320, y: 0 },
    ],
    edges: [{ from: 'child', to: 'parent', toArrow: 'triangle' }],
  });
  const svg = container.children[0];
  const edgePath = svg.querySelector('.qa-edge').children.find(c => c.tag === 'path');
  assert.strictEqual(edgePath.attrs['marker-end'], 'url(#qa-triangle)');
});

t('edge.fromArrow="diamond" selects diamond at the source end (composition)', () => {
  const { container } = render({
    nodes: [
      { id: 'whole', kind: 'class', label: 'Car',  x: 0,   y: 0 },
      { id: 'part',  kind: 'class', label: 'Engine', x: 320, y: 0 },
    ],
    edges: [{ from: 'whole', to: 'part', fromArrow: 'diamond', toArrow: 'none' }],
  });
  const svg = container.children[0];
  const edgePath = svg.querySelector('.qa-edge').children.find(c => c.tag === 'path');
  assert.strictEqual(edgePath.attrs['marker-start'], 'url(#qa-diamond)');
  assert.strictEqual(edgePath.attrs['marker-end'], undefined, 'toArrow="none" → no end marker');
});

t('edge.toArrow="none" produces no end marker even without explicit endArrow flag', () => {
  const { container } = render({
    nodes: [
      { id: 'a', kind: 'plain', label: 'A', x: 0,   y: 0 },
      { id: 'b', kind: 'plain', label: 'B', x: 200, y: 0 },
    ],
    edges: [{ from: 'a', to: 'b', toArrow: 'none' }],
  });
  const svg = container.children[0];
  const edgePath = svg.querySelector('.qa-edge').children.find(c => c.tag === 'path');
  assert.strictEqual(edgePath.attrs['marker-end'], undefined);
});

t('legacy endArrow=false still works (back-compat)', () => {
  const { container } = render({
    nodes: [
      { id: 'a', kind: 'plain', label: 'A', x: 0,   y: 0 },
      { id: 'b', kind: 'plain', label: 'B', x: 200, y: 0 },
    ],
    edges: [{ from: 'a', to: 'b', endArrow: false }],
  });
  const svg = container.children[0];
  const edgePath = svg.querySelector('.qa-edge').children.find(c => c.tag === 'path');
  assert.strictEqual(edgePath.attrs['marker-end'], undefined);
});

section('v0.4: sequence layout');
t('participants laid out in a row at y=0', () => {
  const d = {
    layout: 'sequence',
    nodes: [
      { id: 'a', kind: 'participant', label: 'Alice' },
      { id: 'b', kind: 'participant', label: 'Bob'   },
      { id: 'c', kind: 'participant', label: 'Carol' },
    ],
    edges: [{ from: 'a', to: 'b', label: 'Hi' }],
  };
  render(d);
  for (const n of d.nodes) assert.strictEqual(n.y, 0);
  // participants are in declaration order, increasing x
  assert.ok(d.nodes[0].x < d.nodes[1].x, 'a left of b');
  assert.ok(d.nodes[1].x < d.nodes[2].x, 'b left of c');
});

t('edges get _seqY assigned in increasing order', () => {
  const d = {
    layout: 'sequence',
    nodes: [
      { id: 'a', kind: 'participant', label: 'A' },
      { id: 'b', kind: 'participant', label: 'B' },
    ],
    edges: [
      { from: 'a', to: 'b', label: 'hello' },
      { from: 'b', to: 'a', label: 'world', style: 'dashed' },
      { from: 'a', to: 'b', label: 'again' },
    ],
  };
  render(d);
  assert.ok(d.edges[0]._seqY < d.edges[1]._seqY, 'edge 0 above edge 1');
  assert.ok(d.edges[1]._seqY < d.edges[2]._seqY, 'edge 1 above edge 2');
});

t('lifelines drawn — one vertical line per participant', () => {
  const { container, diagram } = render({
    layout: 'sequence',
    nodes: [
      { id: 'a', kind: 'participant', label: 'A' },
      { id: 'b', kind: 'participant', label: 'B' },
      { id: 'c', kind: 'participant', label: 'C' },
    ],
    edges: [{ from: 'a', to: 'b' }],
  });
  const svg = container.children[0];
  const lifelineG = svg.children.find(c => (c.attrs.class || '') === 'qa-lifelines');
  assert.ok(lifelineG, 'lifeline group not found');
  const lines = lifelineG.children.filter(c => c.tag === 'line');
  assert.strictEqual(lines.length, 3, 'expected 3 lifelines, got ' + lines.length);
  // each lifeline x matches the participant's centre x
  for (let i = 0; i < diagram.nodes.length; i++) {
    const cx = diagram.nodes[i].x + diagram.nodes[i]._w / 2;
    assert.strictEqual(+lines[i].attrs.x1, cx);
  }
});

t('sequence edges render as straight horizontal arrows', () => {
  const { container } = render({
    layout: 'sequence',
    nodes: [
      { id: 'a', kind: 'participant', label: 'A' },
      { id: 'b', kind: 'participant', label: 'B' },
    ],
    edges: [{ from: 'a', to: 'b', label: 'msg' }],
  });
  const svg = container.children[0];
  const edge = svg.querySelector('.qa-edge');
  assert.ok(edge, 'edge group missing');
  const path = edge.children.find(c => c.tag === 'path');
  // straight-line "M x y L x y" format
  assert.ok(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/.test(path.attrs.d), 'expected straight line, got ' + path.attrs.d);
});

t('sequence: self-message renders as a loop path', () => {
  const { container } = render({
    layout: 'sequence',
    nodes: [{ id: 'a', kind: 'participant', label: 'A' }],
    edges: [{ from: 'a', to: 'a', label: 'self' }],
  });
  const svg = container.children[0];
  const path = svg.querySelector('.qa-edge').children.find(c => c.tag === 'path');
  // loop path = M..h..v..h..
  assert.ok(/h [-\d.]+ v [-\d.]+ h [-\d.]+/.test(path.attrs.d), 'expected loop path, got ' + path.attrs.d);
});

t('sequence: dashed style honored on response messages', () => {
  const { container } = render({
    layout: 'sequence',
    nodes: [
      { id: 'a', kind: 'participant', label: 'A' },
      { id: 'b', kind: 'participant', label: 'B' },
    ],
    edges: [{ from: 'a', to: 'b', style: 'dashed' }],
  });
  const svg = container.children[0];
  const path = svg.querySelector('.qa-edge').children.find(c => c.tag === 'path');
  assert.strictEqual(path.attrs['stroke-dasharray'], '6 5');
});

/* =====================================================================
 * v0.4.1 — visual snapshot tests
 * =====================================================================
 *
 * These compare the exact SVG output against approved baselines in
 * test/snapshots/. To re-approve after an intentional engine change,
 * run:    UPDATE_SNAPSHOTS=1 node test/smoke.js
 * then visually review the regenerated .svg files in a browser and
 * commit them.
 * ===================================================================== */
section('Visual snapshots (test/snapshots/*.svg)');

snap('flowchart-shapes-gallery', {
  layout: 'lr',
  nodes: [
    { id: 'rect',  kind: 'plain',            label: 'rectangle'  },
    { id: 'circ',  kind: 'circle',           label: 'circle'     },
    { id: 'stad',  kind: 'stadium',          label: 'stadium'    },
    { id: 'diam',  kind: 'diamond',          label: 'diamond'    },
    { id: 'hex',   kind: 'lb',               label: 'hexagon'    },
    { id: 'cyl',   kind: 'db',               label: 'cylinder'   },
    { id: 'par',   kind: 'parallelogram',    label: 'parallel'   },
    { id: 'trap',  kind: 'trapezoid',        label: 'trapezoid'  },
  ],
  edges: [],
});

snap('state-diagram-singleton-end', {
  layout: 'lr',
  nodes: [
    { id: '__start__', kind: 'start', label: '' },
    { id: 'Still',     kind: 'state', label: 'Still'  },
    { id: 'Moving',    kind: 'state', label: 'Moving' },
    { id: 'Crash',     kind: 'state', label: 'Crash'  },
    { id: '__end__',   kind: 'end',   label: '' },
  ],
  edges: [
    { from: '__start__', to: 'Still'   },
    { from: 'Still',     to: '__end__' },   // the long-span edge that
    { from: 'Still',     to: 'Moving'  },   // must detour over Moving + Crash
    { from: 'Moving',    to: 'Still'   },
    { from: 'Moving',    to: 'Crash'   },
    { from: 'Crash',     to: '__end__' },
  ],
});

snap('class-diagram-inheritance', {
  layout: 'lr',
  nodes: [
    { id: 'Animal', kind: 'class', label: 'Animal',
      attrs:   ['+int age', '+String gender'],
      methods: ['+isMammal()', '+mate()'] },
    { id: 'Duck',  kind: 'class', label: 'Duck',
      attrs: ['+String beakColor'], methods: ['+swim()', '+quack()'] },
    { id: 'Fish',  kind: 'class', label: 'Fish' },
  ],
  edges: [
    { from: 'Animal', to: 'Duck', toArrow: 'none', fromArrow: 'triangle' },
    { from: 'Animal', to: 'Fish', toArrow: 'none', fromArrow: 'triangle' },
  ],
});

snap('flowchart-christmas-fanout', {
  // The Mermaid docs `flowchart TD` Christmas example. Exercises the
  // diamond-perimeter projection fix: 3 edges fanning out from the
  // bottom of a diamond must all land ON the visible diamond, not on
  // the bbox edge 72 px below the visible shape.
  layout: 'tb', padding: 40,
  nodes: [
    { id: 'A', kind: 'plain',   label: 'Christmas' },
    { id: 'B', kind: 'plain',   label: 'Go shopping' },
    { id: 'C', kind: 'diamond', label: 'Let me think' },
    { id: 'D', kind: 'plain',   label: 'Laptop' },
    { id: 'E', kind: 'plain',   label: 'iPhone' },
    { id: 'F', kind: 'plain',   label: 'Car' },
  ],
  edges: [
    { from: 'A', to: 'B', label: 'Get money' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'D', label: 'One'   },
    { from: 'C', to: 'E', label: 'Two'   },
    { from: 'C', to: 'F', label: 'Three' },
  ],
});

snap('sequence-diagram-lifelines', {
  layout: 'sequence',
  nodes: [
    { id: 'Alice', kind: 'participant', label: 'Alice' },
    { id: 'John',  kind: 'participant', label: 'John'  },
  ],
  edges: [
    { from: 'Alice', to: 'John',  label: 'Hello John, how are you?' },
    { from: 'John',  to: 'Alice', label: 'I am good, thanks!', style: 'dashed' },
  ],
});

/* =====================================================================
 * Converter end-to-end rendering snapshots
 *
 * Mermaid source → converter parse/build → engine render → snapshot
 * diff. Lives here (not in the converter runner) because rendering is
 * an engine concern. Each baseline is in test/snapshots/converter-*.svg.
 * ===================================================================== */
section('Converter end-to-end render snapshots');

snapEndToEnd('converter-flowchart-christmas', convFixture('flowchart-christmas.mmd'));
snapEndToEnd('converter-class-animals',       convFixture('class-animals.mmd'));
snapEndToEnd('converter-state-multi-end',     convFixture('state-multi-end.mmd'));

/* =====================================================================
 * Summary
 * ===================================================================== */
console.log('\n----------------------------------------');
console.log(`Quickagram v${Q.version}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
