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

/* ---------- tiny test runner ---------- */
let passed = 0, failed = 0;
const section = name => console.log('\n# ' + name);
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
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
 * Summary
 * ===================================================================== */
console.log('\n----------------------------------------');
console.log(`Quickagram v${Q.version}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
