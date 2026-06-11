#!/usr/bin/env node
/* Smoke test: load the UMD bundle, verify the public API.
   Does NOT exercise rendering (needs DOM); see examples/ for that. */
const assert = require('assert');
const path = require('path');

const Q = require(path.join(__dirname, '..', 'src', 'quickagram.js'));

assert.strictEqual(typeof Q.render,     'function');
assert.strictEqual(typeof Q.autoLayout, 'function');
assert.strictEqual(typeof Q.highlight,  'function');
assert.strictEqual(typeof Q.tokenize,   'function');
assert.strictEqual(typeof Q.installTheme, 'function');
assert.strictEqual(typeof Q.version,    'string');
assert.ok(Q.THEMES && typeof Q.THEMES.web === 'object', 'THEMES.web should exist');
assert.ok(Q.SHAPES && typeof Q.SHAPES.rect === 'function', 'SHAPES.rect should be a function');
assert.ok(Q.languages && Q.languages.python && Q.languages.javascript && Q.languages.sql,
  'languages.{python,javascript,sql} should exist');
assert.strictEqual(Q.languages.py, Q.languages.python, 'py alias');
assert.strictEqual(Q.languages.js, Q.languages.javascript, 'js alias');
assert.ok(Q.codeThemes && Q.codeThemes.dracula && Q.codeThemes.nord && Q.codeThemes['github-light'],
  'codeThemes.{dracula,nord,github-light} should exist');

// theme strings are non-empty CSS
for (const t of ['dracula', 'nord', 'github-light']) {
  assert.ok(Q.codeThemes[t].includes('.qa-code'),     t + ' theme should target .qa-code');
  assert.ok(Q.codeThemes[t].includes('.qa-tok-keyword'), t + ' theme should style keywords');
  assert.ok(Q.codeThemes[t].includes('.qa-tok-string'),  t + ' theme should style strings');
}

// node themes
for (const k of ['client', 'web', 'api', 'cache', 'db', 'nosql', 'queue', 'storage', 'cdn', 'lb', 'class']) {
  assert.ok(Q.THEMES[k], 'node theme missing: ' + k);
}
for (const s of ['rect', 'cylinder', 'hex', 'cloud', 'bucket', 'queue', 'stack', 'process', 'note', 'actor']) {
  assert.ok(typeof Q.SHAPES[s] === 'function', 'shape missing: ' + s);
  const out = Q.SHAPES[s](100, 50);
  const body = typeof out === 'string' ? out : out.body;
  assert.ok(typeof body === 'string' && body.length > 0, s + ' empty body');
}

/* ------- highlight: Python ------- */
const pyCode = `def fib(n):
    """Return the n-th fibonacci number."""
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`;
const pyHtml = Q.highlight(pyCode, 'python');
assert.ok(pyHtml.includes('qa-tok-keyword">def<'),       'python: def → keyword');
assert.ok(pyHtml.includes('qa-tok-function">fib<'),      'python: fib → function');
assert.ok(pyHtml.includes('qa-tok-keyword">if<'),        'python: if → keyword');
assert.ok(pyHtml.includes('qa-tok-keyword">return<'),    'python: return → keyword');
assert.ok(pyHtml.includes('qa-tok-number">2<'),          'python: 2 → number');
assert.ok(pyHtml.includes('qa-tok-string">"""Return the n-th fibonacci number."""<'),
  'python: triple-quoted docstring → string');

/* ------- highlight: JavaScript ------- */
const jsCode = `const x = "hello"; // greeting
function greet() { return \`hi \${x}\`; }`;
const jsHtml = Q.highlight(jsCode, 'js');
assert.ok(jsHtml.includes('qa-tok-keyword">const<'),     'js: const → keyword');
assert.ok(jsHtml.includes('qa-tok-string">"hello"<'), 'js: "hello" → string');
assert.ok(jsHtml.includes('qa-tok-comment">// greeting<'),     'js: line comment');
assert.ok(jsHtml.includes('qa-tok-function">greet<'),    'js: greet → function');

/* ------- highlight: SQL (case-insensitive) ------- */
const sqlCode = `CREATE TABLE users (id INT NOT NULL, name VARCHAR(255));
select * from users where id = 1;`;
const sqlHtml = Q.highlight(sqlCode, 'sql');
assert.ok(sqlHtml.includes('qa-tok-keyword">CREATE<'),   'sql: CREATE → keyword (upper)');
assert.ok(sqlHtml.includes('qa-tok-keyword">select<'),   'sql: select → keyword (lower; case-insensitive)');
assert.ok(sqlHtml.includes('qa-tok-type">INT<'),         'sql: INT → type');
assert.ok(sqlHtml.includes('qa-tok-type">VARCHAR<'),     'sql: VARCHAR → type');

/* ------- highlight: text (no-op) ------- */
const textHtml = Q.highlight('plain <text> & more', 'text');
assert.strictEqual(textHtml, 'plain &lt;text&gt; &amp; more', 'text: only escapes HTML');

/* ------- highlight: unknown language → text fallback ------- */
const unknownHtml = Q.highlight('hello <world>', 'klingon');
assert.strictEqual(unknownHtml, 'hello &lt;world&gt;', 'unknown lang falls back to escaping');

console.log('OK — Quickagram v' + Q.version);
console.log('  - render / autoLayout: ok');
console.log('  - THEMES: ' + Object.keys(Q.THEMES).length + ' node kinds');
console.log('  - SHAPES: ' + Object.keys(Q.SHAPES).length + ' shapes');
console.log('  - languages: ' + Object.keys(Q.languages).filter(k => k !== 'py' && k !== 'js').join(', ') + ' (+ py, js aliases)');
console.log('  - codeThemes: ' + Object.keys(Q.codeThemes).join(', '));
console.log('  - highlight tested: python, javascript, sql, text, unknown');
