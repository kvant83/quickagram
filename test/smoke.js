#!/usr/bin/env node
/* Smoke test: load the UMD bundle, verify it exposes the expected API.
   Does NOT exercise rendering (requires a DOM); see examples/ for that. */
const assert = require('assert');
const path = require('path');

const Q = require(path.join(__dirname, '..', 'src', 'quickagram.js'));

assert.strictEqual(typeof Q.render, 'function', 'Q.render should be a function');
assert.strictEqual(typeof Q.version, 'string', 'Q.version should be a string');
assert.ok(Q.THEMES && typeof Q.THEMES.web === 'object', 'THEMES.web should exist');
assert.ok(Q.SHAPES && typeof Q.SHAPES.rect === 'function', 'SHAPES.rect should be a function');

// Spot-check a few themes
for (const k of ['client', 'web', 'api', 'cache', 'db', 'nosql', 'queue', 'storage', 'cdn', 'lb', 'class']) {
  assert.ok(Q.THEMES[k], 'theme missing: ' + k);
  const t = Q.THEMES[k];
  assert.ok(t.top && t.bot && t.border, 'theme ' + k + ' missing colour fields');
  assert.ok(t.shape, 'theme ' + k + ' missing shape');
}

// Spot-check shape generators return non-empty strings
for (const s of ['rect', 'cylinder', 'hex', 'cloud', 'bucket', 'queue', 'stack', 'process', 'note', 'actor']) {
  assert.ok(typeof Q.SHAPES[s] === 'function', 'shape missing: ' + s);
  const d = Q.SHAPES[s](100, 50);
  assert.ok(typeof d === 'string' && d.length > 0, 'shape ' + s + ' returned empty path');
  assert.ok(/^[MmLlHhVvAaQqCcZz0-9 .,\-]+$/.test(d), 'shape ' + s + ' returned malformed path: ' + d);
}

console.log('OK — Quickagram v' + Q.version);
console.log('  - render: function');
console.log('  - THEMES: ' + Object.keys(Q.THEMES).length + ' kinds');
console.log('  - SHAPES: ' + Object.keys(Q.SHAPES).length + ' shapes');
