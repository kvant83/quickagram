/* Snapshot test harness.
 *
 * Workflow:
 *   1. snapshot('name', diagram) renders the diagram with the engine,
 *      serialises the resulting SVG tree to a standalone .svg file, and
 *      compares it against test/snapshots/<name>.svg.
 *   2. If the snapshot file does not exist OR the env var
 *      UPDATE_SNAPSHOTS=1 is set, the new SVG is written to disk and
 *      the test passes with a "wrote" notice. The author then opens
 *      that file in a browser, eyeballs it, and commits it to lock
 *      that exact rendering as the approved baseline.
 *   3. On subsequent runs, any byte that differs from the baseline
 *      causes the test to fail with a unified diff. To approve a new
 *      visual, re-run with UPDATE_SNAPSHOTS=1 and re-commit.
 *
 * The SVG files are real, standalone, browser-openable. Click any of
 * them in test/snapshots/ to see what the test is locking down.
 *
 * Caveat: the node DOM stub's getBBox() returns a rough text-width
 * estimate, so the white pill around an edge label may not perfectly
 * hug the text when rendered in a real browser. Everything else (node
 * shapes, edge geometry, markers, gradients, lifelines) is identical
 * to live-browser output.
 *
 * Pretty-prints the SVG so that diffs are line-oriented and readable
 * during review. */
'use strict';

const fs   = require('fs');
const path = require('path');

const SNAP_DIR = path.join(__dirname, 'snapshots');

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Walk a DOM-stub element tree and produce pretty-printed XML. The
 * stub stores attrs in `el.attrs` (an object) and the children in
 * `el.children`. Text content lives in `el._t` (set via the
 * textContent setter). */
function serialize(el, depth) {
  if (depth == null) depth = 0;
  const ind = '  '.repeat(depth);
  const attrs = Object.keys(el.attrs)
    .filter(k => el.attrs[k] != null)
    .sort()                                   // deterministic attr order
    .map(k => ' ' + k + '="' + escapeXml(String(el.attrs[k])) + '"')
    .join('');
  const text = el._t;
  const kids = el.children || [];
  if (!kids.length && (text == null || text === '')) {
    return ind + '<' + el.tag + attrs + '/>';
  }
  if (kids.length === 0 && text != null) {
    return ind + '<' + el.tag + attrs + '>' + escapeXml(text) + '</' + el.tag + '>';
  }
  const inner = kids.map(c => serialize(c, depth + 1)).join('\n');
  return ind + '<' + el.tag + attrs + '>\n' + inner + '\n' + ind + '</' + el.tag + '>';
}

/* Find the first <svg> root in a container and serialise it as a
 * standalone document. */
function svgToString(container) {
  const svg = container.children.find(c => c.tag === 'svg');
  if (!svg) throw new Error('snapshot: no <svg> element in container');
  // ensure the svg has xmlns (already set by the engine) — belt + braces
  if (!svg.attrs.xmlns) svg.attrs.xmlns = 'http://www.w3.org/2000/svg';
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(svg);
}

/* Compute a tiny unified-diff between two strings, suitable for
 * embedding in test failure messages. Returns the first `maxHunks`
 * differing line groups with a few lines of context. */
function unifiedDiff(a, b, maxLines) {
  if (maxLines == null) maxLines = 60;
  const aL = a.split('\n');
  const bL = b.split('\n');
  const out = [];
  const max = Math.max(aL.length, bL.length);
  let shown = 0;
  for (let i = 0; i < max && shown < maxLines; i++) {
    const x = aL[i], y = bL[i];
    if (x === y) continue;
    if (x !== undefined) { out.push('- ' + x); shown++; }
    if (y !== undefined) { out.push('+ ' + y); shown++; }
  }
  if (shown >= maxLines) out.push('... (diff truncated at ' + maxLines + ' lines)');
  return out.join('\n');
}

/* The one entry point a test calls.
 *
 *   ok(snapshot('state-multi-end', diagramObject))
 *
 * Returns { pass: boolean, msg: string, name } so the existing tiny
 * test runner can integrate it with normal assertions. */
function snapshot(name, container) {
  const file = path.join(SNAP_DIR, name + '.svg');
  const actual = svgToString(container);
  const update = process.env.UPDATE_SNAPSHOTS === '1' || !fs.existsSync(file);

  if (update) {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(file, actual + '\n');
    const reason = fs.existsSync(file + '.tmp') ? 'updated' : 'wrote';
    return {
      pass: true,
      msg:  '[snapshot ' + reason + '] ' + path.relative(process.cwd(), file) +
            '  — open in a browser to review, commit to approve',
      name,
    };
  }

  const expected = fs.readFileSync(file, 'utf8').replace(/\n$/, '');
  const actualTrim = actual.replace(/\n$/, '');
  if (expected === actualTrim) {
    return { pass: true, msg: '[snapshot match] ' + name, name };
  }
  return {
    pass: false,
    msg:  '[snapshot MISMATCH] ' + path.relative(process.cwd(), file) + '\n' +
          'To accept the new output:  UPDATE_SNAPSHOTS=1 node test/smoke.js\n' +
          '--- expected\n+++ actual\n' + unifiedDiff(expected, actualTrim),
    name,
  };
}

module.exports = { snapshot, svgToString, serialize };
