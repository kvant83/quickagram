#!/usr/bin/env node
/* Smoke test: load the UMD bundle, verify it exposes the expected API.
   Does NOT exercise rendering (requires a DOM); see examples/ for that. */
const assert = require('assert');
const path = require('path');

const Q = require(path.join(__dirname, '..', 'src', 'quickagram.js'));

assert.strictEqual(typeof Q.render,     'function');
assert.strictEqual(typeof Q.autoLayout, 'function');
assert.strictEqual(typeof Q.version,    'string');
assert.ok(Q.THEMES && typeof Q.THEMES.web === 'object', 'THEMES.web should exist');
assert.ok(Q.SHAPES && typeof Q.SHAPES.rect === 'function', 'SHAPES.rect should be a function');

// Spot-check a few themes
for (const k of ['client', 'web', 'api', 'cache', 'db', 'nosql', 'queue', 'storage', 'cdn', 'lb', 'class']) {
  assert.ok(Q.THEMES[k], 'theme missing: ' + k);
  const t = Q.THEMES[k];
  assert.ok(t.top && t.bot && t.border, 'theme ' + k + ' missing colour fields');
  assert.ok(t.shape, 'theme ' + k + ' missing shape');
}

// Spot-check shape generators — they may return either a string (body only)
// or an object { body, decoration?, back? }
function check(name) {
  const out = Q.SHAPES[name](100, 50);
  const body = typeof out === 'string' ? out : out.body;
  assert.ok(typeof body === 'string' && body.length > 0, 'shape ' + name + ' returned empty body');
  assert.ok(/^[MmLlHhVvAaQqCcZz0-9 .,\-]+$/.test(body), 'shape ' + name + ' malformed body: ' + body);
}
for (const s of ['rect', 'cylinder', 'hex', 'cloud', 'bucket', 'queue', 'stack', 'process', 'note', 'actor']) {
  check(s);
}

// Verify the cylinder / queue / note / bucket / stack now split body+decoration.
for (const s of ['cylinder', 'queue', 'note', 'bucket']) {
  const out = Q.SHAPES[s](100, 50);
  assert.ok(typeof out === 'object' && out.decoration, 'shape ' + s + ' should have a `decoration` sub-path now');
}
const stackOut = Q.SHAPES.stack(100, 50);
assert.ok(stackOut.back, 'shape stack should declare a `back` layer for the stacked papers effect');

console.log('OK — Quickagram v' + Q.version);
console.log('  - render: function');
console.log('  - autoLayout: function');
console.log('  - THEMES: ' + Object.keys(Q.THEMES).length + ' kinds');
console.log('  - SHAPES: ' + Object.keys(Q.SHAPES).length + ' shapes (queue/note/cylinder/bucket split body+decoration; stack has back layer)');
