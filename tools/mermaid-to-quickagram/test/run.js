#!/usr/bin/env node
/* Test runner for mermaid-to-quickagram — CONVERTER FUNCTIONALITY ONLY.
 *
 * Scope: parser/AST shape, emit-format correctness, util helpers, and
 * a few round-trip sanity checks that the produced diagram object is
 * accepted by the Quickagram engine without throwing. Visual rendering
 * snapshots are in test/smoke.js (the engine test suite), because
 * how a diagram RENDERS is the engine's responsibility.
 *
 * Run with:
 *   node tools/mermaid-to-quickagram/test/run.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const assert = require('assert');

/* ---------- minimal DOM stub — mirrors test/smoke.js ---------- */
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
          if (!sel.startsWith('.') && ch.tag === sel) return ch;
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
          if (!sel.startsWith('.') && ch.tag === sel) out.push(ch);
          find(ch);
        }
      };
      find(this);
      return out;
    },
    getBBox() { return { x: 0, y: 0, width: Math.max(20, (this._t || '').length * 6.5), height: 12 }; },
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

const Q = require(path.join(__dirname, '..', '..', '..', 'src', 'quickagram'));
const { sniffKind }        = require('../sniff');
const { parseFlowchart, readNodeBody, readEdge } = require('../parse-flowchart');
const { parseSequence }    = require('../parse-sequence');
const { parseClass }       = require('../parse-class');
const { parseState }       = require('../parse-state');
const { build, prettyJS }  = require('../emit');

const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

let passed = 0, failed = 0;
function section(name) { console.log('\n# ' + name); }
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function render(d) { const c = makeEl('div'); Q.render(c, d); return c.children[0]; }

/* =====================================================================
 * sniff
 * ===================================================================== */
section('sniff: diagram-type detection');
t('detects flowchart',         () => assert.strictEqual(sniffKind('flowchart LR\nA-->B'), 'flowchart'));
t('detects graph',             () => assert.strictEqual(sniffKind('graph TD\nA-->B'), 'flowchart'));
t('detects sequenceDiagram',   () => assert.strictEqual(sniffKind('sequenceDiagram\nA->>B: hi'), 'sequence'));
t('detects classDiagram',      () => assert.strictEqual(sniffKind('classDiagram\nA <|-- B'), 'class'));
t('detects classDiagram-v2',   () => assert.strictEqual(sniffKind('classDiagram-v2\nA <|-- B'), 'class'));
t('detects stateDiagram',      () => assert.strictEqual(sniffKind('stateDiagram\n[*] --> A'), 'state'));
t('detects stateDiagram-v2',   () => assert.strictEqual(sniffKind('stateDiagram-v2\n[*] --> A'), 'state'));
t('skips leading comments',    () => assert.strictEqual(sniffKind('%% comment\nflowchart LR\nA-->B'), 'flowchart'));
t('returns null on unknown',   () => assert.strictEqual(sniffKind('something\nelse'), null));

/* =====================================================================
 * flowchart
 * ===================================================================== */
section('flowchart: shape recognition');
t('all 11 shape syntaxes map to the right kinds', () => {
  const cases = [
    ['A[foo]',     'plain'],
    ['A(foo)',     'plain'],
    ['A((foo))',   'circle'],
    ['A([foo])',   'stadium'],
    ['A[(foo)]',   'db'],
    ['A{foo}',     'diamond'],
    ['A{{foo}}',   'lb'],
    ['A[/foo/]',   'parallelogram'],
    ['A[\\foo\\]', 'parallelogramAlt'],
    ['A[/foo\\]',  'trapezoid'],
    ['A[\\foo/]',  'trapezoidAlt'],
  ];
  for (const [src, kind] of cases) {
    const body = readNodeBody(src, 1);
    assert.ok(body, src + ' → no body parsed');
    assert.strictEqual(body.kind, kind, src + ' → expected ' + kind + ', got ' + body.kind);
    assert.strictEqual(body.label, 'foo', src + ' label wrong');
  }
});

section('flowchart: edge tokens');
t('--> = solid arrow', () => {
  const e = readEdge('-->', 0);
  assert.strictEqual(e.style, 'solid'); assert.strictEqual(e.toArrow, 'arrow');
});
t('-.-> = dotted arrow', () => {
  const e = readEdge('-.->', 0);
  assert.strictEqual(e.style, 'dotted'); assert.strictEqual(e.toArrow, 'arrow');
});
t('==> = thick arrow', () => {
  const e = readEdge('==>', 0);
  assert.strictEqual(e.style, 'solid'); assert.strictEqual(e.thick, true);
});
t('--- = solid line, no arrow', () => {
  const e = readEdge('---', 0);
  assert.strictEqual(e.toArrow, 'none');
});
t('--o = circle endpoint', () => {
  const e = readEdge('--o', 0);
  assert.strictEqual(e.toArrow, 'circle');
});
t('--x = cross endpoint', () => {
  const e = readEdge('--x', 0);
  assert.strictEqual(e.toArrow, 'cross');
});
t('<--> = bidirectional', () => {
  const e = readEdge('<-->', 0);
  assert.strictEqual(e.fromArrow, 'arrow'); assert.strictEqual(e.toArrow, 'arrow');
});

section('flowchart: end-to-end fixture');
{
  const ast = parseFlowchart(fixture('flowchart-basic.mmd'));
  t('layout = lr',           () => assert.strictEqual(ast.layout, 'lr'));
  t('4 nodes',               () => assert.strictEqual(ast.nodes.length, 4));
  t('4 edges',               () => assert.strictEqual(ast.edges.length, 4));
  t('B is diamond',          () => assert.strictEqual(ast.nodes.find(n => n.id==='B').kind, 'diamond'));
  t('C is circle',           () => assert.strictEqual(ast.nodes.find(n => n.id==='C').kind, 'circle'));
  t('D is stadium',          () => assert.strictEqual(ast.nodes.find(n => n.id==='D').kind, 'stadium'));
  t('pipe labels preserved', () => {
    const e = ast.edges.find(x => x.from === 'B' && x.to === 'C');
    assert.strictEqual(e.label, 'yes');
  });
}

{
  const ast = parseFlowchart(fixture('flowchart-edges.mmd'));
  t('layout = tb (from TD)', () => assert.strictEqual(ast.layout, 'tb'));
  t('6 nodes',               () => assert.strictEqual(ast.nodes.length, 6));
  t('5 edges',               () => assert.strictEqual(ast.edges.length, 5));
  t('mid-text label parsed', () => {
    const e = ast.edges.find(x => x.to === 'B');
    assert.strictEqual(e.label, 'request');
  });
  t('dotted style on A→C',   () => {
    const e = ast.edges.find(x => x.to === 'C');
    assert.strictEqual(e.style, 'dotted');
  });
  t('cross endpoint on A→E', () => {
    const e = ast.edges.find(x => x.to === 'E');
    assert.strictEqual(e.toArrow, 'cross');
  });
  t('circle endpoint on A→F',() => {
    const e = ast.edges.find(x => x.to === 'F');
    assert.strictEqual(e.toArrow, 'circle');
  });
  t('subgraph captured',     () => {
    assert.strictEqual(ast.groups.length, 1);
    assert.deepStrictEqual(ast.groups[0].nodes.sort(), ['B','C','D']);
  });
}

section('flowchart: FontAwesome icon prefix stripped (Quickagram has no FA equivalent)');
{
  const ast = parseFlowchart(fixture('flowchart-fa-icons.mmd'));
  t('fa:fa-car prefix stripped from label F', () => {
    const f = ast.nodes.find(n => n.id === 'F');
    assert.strictEqual(f.label, 'Car');
  });
  t('fab:fa-github prefix stripped from label G', () => {
    const g = ast.nodes.find(n => n.id === 'G');
    assert.strictEqual(g.label, 'GitHub');
  });
  t('fas:fa-cog prefix stripped from label H', () => {
    const h = ast.nodes.find(n => n.id === 'H');
    assert.strictEqual(h.label, 'Settings');
  });
  t('Christmas example: C is diamond, edge labels preserved', () => {
    const c = ast.nodes.find(n => n.id === 'C');
    assert.strictEqual(c.kind, 'diamond');
    const e = ast.edges.find(x => x.from === 'A' && x.to === 'B');
    assert.strictEqual(e.label, 'Get money');
  });
}

/* =====================================================================
 * sequence
 * ===================================================================== */
section('sequence: end-to-end fixture');
{
  const ast = parseSequence(fixture('sequence-basic.mmd'));
  t('3 participants',        () => assert.strictEqual(ast.participants.length, 3));
  t('actor preserved',       () => {
    const c = ast.participants.find(p => p.id === 'Carol');
    assert.strictEqual(c.kind, 'actor');
  });
  t('participant alias',     () => {
    const j = ast.participants.find(p => p.id === 'John');
    assert.strictEqual(j.label, 'J');
  });
  // 4 sync + 1 lost + 1 note = 6 messages
  t('6 messages',            () => assert.strictEqual(ast.messages.length, 6));
  t('->> is solid + arrow',  () => {
    const m = ast.messages[0];
    assert.strictEqual(m.style, 'solid');
    assert.strictEqual(m.toArrow, 'arrow');
  });
  t('-->> is dashed + arrow',() => {
    const m = ast.messages[2];
    assert.strictEqual(m.style, 'dashed');
    assert.strictEqual(m.toArrow, 'arrow');
  });
  t('-x is cross marker',    () => {
    const m = ast.messages.find(x => x.to === 'Carol');
    assert.strictEqual(m.toArrow, 'cross');
  });
  t('Note rendered as self-loop on first participant', () => {
    const m = ast.messages.find(x => x.kind === 'note');
    assert.strictEqual(m.from, 'Alice');
    assert.strictEqual(m.to, 'Alice');
    assert.ok(m.label.includes('shared note'));
  });
}

section('sequence: activation/deactivation prefixes are stripped');
{
  // Mermaid: `->>+X` activates X's lifeline; `->>-X` deactivates.
  // The +/- is NOT part of the participant id. The parser strips
  // the prefix and records the activation semantic on the message.
  const ast = parseSequence(fixture('sequence-activations.mmd'));
  t('exactly 2 participants (no phantom +John / -Alice)', () => {
    assert.strictEqual(ast.participants.length, 2);
    const ids = ast.participants.map(p => p.id).sort();
    assert.deepStrictEqual(ids, ['Alice', 'John']);
  });
  t('4 messages', () => assert.strictEqual(ast.messages.length, 4));
  t('+John message records activation: "activate"', () => {
    const m = ast.messages[0];
    assert.strictEqual(m.to, 'John');
    assert.strictEqual(m.activation, 'activate');
  });
  t('-Alice message records activation: "deactivate"', () => {
    const m = ast.messages[2];
    assert.strictEqual(m.to, 'Alice');
    assert.strictEqual(m.activation, 'deactivate');
  });
  t('response messages are dashed', () => {
    assert.strictEqual(ast.messages[2].style, 'dashed');
    assert.strictEqual(ast.messages[3].style, 'dashed');
  });
}

/* =====================================================================
 * class
 * ===================================================================== */
section('class: end-to-end fixture');
{
  const ast = parseClass(fixture('class-basic.mmd'));
  // Animal, Dog, Cat, Tail, Whiskers, Food, Owner, Pet, Vehicle, Drivable
  t('10 classes', () => assert.strictEqual(ast.classes.length, 10));
  t('Animal has 2 attrs + 1 method', () => {
    const a = ast.classes.find(c => c.id === 'Animal');
    assert.strictEqual(a.attrs.length, 2);
    assert.strictEqual(a.methods.length, 1);
    assert.strictEqual(a.methods[0], '+eat() void');
  });
  t('class block opener works WITHOUT space before brace (`class Cat{`)', () => {
    // regression: previously consumed `Cat{` as the id, dropping the block
    const c = ast.classes.find(x => x.id === 'Cat');
    assert.ok(c, 'Cat class missing');
    assert.deepStrictEqual(c.attrs,   ['+bool indoor']);
    assert.deepStrictEqual(c.methods, ['+purr()']);
  });
  t('inheritance arrow: triangle at parent end', () => {
    const e = ast.edges.find(x => x.from === 'Animal' && x.to === 'Dog');
    // mermaid `Animal <|-- Dog` → triangle at the source (Animal)
    assert.strictEqual(e.fromArrow, 'triangle');
    assert.strictEqual(e.toArrow, 'none');
  });
  t('composition arrow: filled diamond at composite', () => {
    const e = ast.edges.find(x => x.from === 'Dog' && x.to === 'Tail');
    assert.strictEqual(e.fromArrow, 'diamond');
  });
  t('aggregation arrow: open diamond at aggregate', () => {
    const e = ast.edges.find(x => x.from === 'Cat' && x.to === 'Whiskers');
    assert.strictEqual(e.fromArrow, 'odiamond');
  });
  t('dependency arrow: dashed', () => {
    const e = ast.edges.find(x => x.from === 'Animal' && x.to === 'Food');
    assert.strictEqual(e.style, 'dashed');
    assert.strictEqual(e.label, 'eats');
  });
  t('cardinality preserved in label', () => {
    const e = ast.edges.find(x => x.from === 'Owner');
    assert.ok(e.label.includes('"1"'));
    assert.ok(e.label.includes('"*"'));
    assert.ok(e.label.includes('owns'));
  });
  t('realization is dashed inheritance', () => {
    const e = ast.edges.find(x => x.from === 'Vehicle');
    assert.strictEqual(e.style, 'dashed');
    assert.strictEqual(e.toArrow, 'triangle');
  });
}

section('class: animals fixture (mermaid docs canonical example)');
{
  const ast = parseClass(fixture('class-animals.mmd'));
  t('4 classes (Animal, Duck, Fish, Zebra)', () => {
    assert.strictEqual(ast.classes.length, 4);
    const ids = ast.classes.map(c => c.id).sort();
    assert.deepStrictEqual(ids, ['Animal', 'Duck', 'Fish', 'Zebra']);
  });
  t('3 inheritance edges from Animal', () => {
    assert.strictEqual(ast.edges.length, 3);
    for (const e of ast.edges) {
      assert.strictEqual(e.from, 'Animal');
      assert.strictEqual(e.fromArrow, 'triangle',
        'Animal <|-- X must put a triangle at Animal');
      assert.strictEqual(e.toArrow, 'none');
    }
  });
  t('Animal merges colon-form + block-form members', () => {
    // declared as 4 separate `Animal : ...` lines (no class block)
    const a = ast.classes.find(c => c.id === 'Animal');
    assert.deepStrictEqual(a.attrs,   ['+int age', '+String gender']);
    assert.deepStrictEqual(a.methods, ['+isMammal()', '+mate()']);
  });
  t('Duck block parsed (no space before brace)', () => {
    const d = ast.classes.find(c => c.id === 'Duck');
    assert.deepStrictEqual(d.attrs,   ['+String beakColor']);
    assert.deepStrictEqual(d.methods, ['+swim()', '+quack()']);
  });
  t('Fish block keeps - visibility prefix on both attrs and methods', () => {
    const f = ast.classes.find(c => c.id === 'Fish');
    assert.deepStrictEqual(f.attrs,   ['-int sizeInFeet']);
    assert.deepStrictEqual(f.methods, ['-canEat()']);
  });
  t('Zebra block parsed', () => {
    const z = ast.classes.find(c => c.id === 'Zebra');
    assert.deepStrictEqual(z.attrs,   ['+bool is_wild']);
    assert.deepStrictEqual(z.methods, ['+run()']);
  });
  t('full diagram round-trips through Q.render', () => {
    const d = build(ast);
    const svg = render(d);
    assert.strictEqual(svg.querySelectorAll('.qa-node').length, 4);
    assert.strictEqual(svg.querySelectorAll('.qa-edge').length, 3);
  });
}

/* =====================================================================
 * state
 * ===================================================================== */
section('state: end-to-end fixture');
{
  const ast = parseState(fixture('state-basic.mmd'));
  // 3 real states (Still, Moving, Crash) + 1 start + 1 end + 2 composite (A,B) + composite parent = 7? Let's count: Still, Moving, Crash, Compound, A, B + start + end = 8
  t('has start marker',   () => assert.ok(ast.states.find(s => s._marker === 'start')));
  t('has end marker',     () => assert.ok(ast.states.find(s => s._marker === 'end')));
  t('Still state exists', () => assert.ok(ast.states.find(s => s.id === 'Still')));
  t('Moving state',       () => assert.ok(ast.states.find(s => s.id === 'Moving')));
  t('Crash state',        () => assert.ok(ast.states.find(s => s.id === 'Crash')));
  t('top-level start uses singleton id __start__', () => {
    assert.ok(ast.states.find(s => s.id === '__start__' && s._marker === 'start'));
  });
  t('top-level end uses singleton id __end__', () => {
    assert.ok(ast.states.find(s => s.id === '__end__' && s._marker === 'end'));
  });
  t('composite state → group with its OWN scoped start/end', () => {
    assert.strictEqual(ast.groups.length, 1);
    // composite "Compound" contains A and B (no [*] markers inside this
    // particular composite, so just the two states)
    const g = ast.groups[0];
    assert.deepStrictEqual(g.nodes.filter(n => !n.startsWith('__')).sort(), ['A','B']);
  });
  t('start --> Still edge points at singleton start', () => {
    assert.ok(ast.edges.find(e => e.from === '__start__' && e.to === 'Still'));
  });
  t('labelled transition', () => {
    const e = ast.edges.find(x => x.from === 'Still' && x.to === 'Moving');
    assert.strictEqual(e.label, 'start');
  });
}

section('state: multiple [*] transitions share singleton start/end');
{
  // Mermaid docs (stateDiagram.html) canonical example. Crucially, both
  // `Still --> [*]` and `Crash --> [*]` must terminate at THE SAME end
  // node — [*] is a singleton per scope, not per-transition.
  const ast = parseState(fixture('state-multi-end.mmd'));
  t('exactly one start marker', () => {
    assert.strictEqual(ast.states.filter(s => s._marker === 'start').length, 1);
  });
  t('exactly one end marker (Still and Crash share it)', () => {
    assert.strictEqual(ast.states.filter(s => s._marker === 'end').length, 1);
  });
  t('5 nodes total (1 start + 3 states + 1 end)', () => {
    assert.strictEqual(ast.states.length, 5);
  });
  t('6 transitions', () => assert.strictEqual(ast.edges.length, 6));
  t('Still -> end and Crash -> end point at THE SAME node', () => {
    const stillEnd = ast.edges.find(e => e.from === 'Still' && e.to.startsWith('__end__'));
    const crashEnd = ast.edges.find(e => e.from === 'Crash' && e.to.startsWith('__end__'));
    assert.ok(stillEnd && crashEnd, 'missing end edges');
    assert.strictEqual(stillEnd.to, crashEnd.to,
      'Still→end and Crash→end must share the same end-node id');
  });
}

/* =====================================================================
 * emit + round-trip render
 * ===================================================================== */
section('emit: pretty-print + round-trip render');
t('flowchart fixture round-trips through Q.render', () => {
  const ast = parseFlowchart(fixture('flowchart-basic.mmd'));
  const d = build(ast);
  const svg = render(d);
  assert.ok(svg, 'render returned nothing');
  assert.strictEqual(svg.querySelectorAll('.qa-node').length, 4);
  assert.strictEqual(svg.querySelectorAll('.qa-edge').length, 4);
});

t('sequence fixture round-trips, lifelines drawn', () => {
  const ast = parseSequence(fixture('sequence-basic.mmd'));
  const d = build(ast);
  const svg = render(d);
  const lifelineG = svg.children.find(c => (c.attrs.class || '') === 'qa-lifelines');
  assert.ok(lifelineG, 'no lifeline group');
  assert.strictEqual(lifelineG.children.length, 3, 'expected 3 lifelines, got ' + lifelineG.children.length);
});

t('class fixture round-trips, triangle marker present', () => {
  const ast = parseClass(fixture('class-basic.mmd'));
  const d = build(ast);
  const svg = render(d);
  const edges = svg.querySelectorAll('.qa-edge');
  const hasTriangle = edges.some(g => {
    const p = g.children.find(c => c.tag === 'path');
    return p && (p.attrs['marker-end'] === 'url(#qa-triangle)' || p.attrs['marker-start'] === 'url(#qa-triangle)');
  });
  assert.ok(hasTriangle, 'no edge uses qa-triangle marker');
});

t('state fixture round-trips, start + end kinds rendered', () => {
  const ast = parseState(fixture('state-basic.mmd'));
  const d = build(ast);
  const svg = render(d);
  // Still + Moving + Crash + Compound + A + B + start + end = 8 nodes
  // (start and end are singletons — only one each, regardless of
  // how many transitions touch them)
  assert.strictEqual(svg.querySelectorAll('.qa-node').length, 8);
});

t('prettyJS is parseable as a JS expression', () => {
  const ast = parseFlowchart(fixture('flowchart-basic.mmd'));
  const text = prettyJS(build(ast));
  // wrap in parens and eval — strict JS object literal syntax
  const obj = new Function('return (' + text + ');')();
  assert.strictEqual(obj.nodes.length, 4);
  assert.strictEqual(obj.edges.length, 4);
});

t('--json output is parseable as JSON', () => {
  const ast = parseFlowchart(fixture('flowchart-basic.mmd'));
  const d = build(ast);
  const json = JSON.stringify(d, null, 2);
  const obj = JSON.parse(json);
  assert.strictEqual(obj.nodes.length, 4);
});

/* =====================================================================
 * util: comment stripping
 * ===================================================================== */
section('util: shared helpers');
{
  const { stripComments, decodeHtml, readQuoted } = require('../util');
  t('stripComments removes %% line comments',
    () => assert.deepStrictEqual(stripComments('a %% b\nc'), ['a', 'c']));
  t('decodeHtml handles entities',
    () => assert.strictEqual(decodeHtml('&lt;b&gt; &amp; &quot;c&quot;'), '<b> & "c"'));
  t('readQuoted reads quoted segments',
    () => {
      const r = readQuoted('"hello world"', 0);
      assert.strictEqual(r.text, 'hello world');
      assert.strictEqual(r.next, 13);
    });
}

console.log('\n----------------------------------------');
console.log(`mermaid-to-quickagram: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
