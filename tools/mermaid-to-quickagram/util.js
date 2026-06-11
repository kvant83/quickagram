/* Shared helpers used by every Mermaid parser. */
'use strict';

/* Strip `%% ...` line comments (Mermaid's comment syntax) and trim
 * trailing whitespace. Preserves blank lines so line numbers don't
 * shift (useful for error messages). */
function stripComments(src) {
  return src.split(/\r?\n/).map(line => {
    const idx = line.indexOf('%%');
    return (idx === -1 ? line : line.slice(0, idx)).replace(/\s+$/, '');
  });
}

/* Pop a quoted string starting at `i` in `s`. Returns
 *   { text, next }  with next == the index after the closing quote
 *   null            if there is no quoted string at `i`
 * Supports both " and ' quotes; allows backslash-escape. */
function readQuoted(s, i) {
  const q = s[i];
  if (q !== '"' && q !== "'") return null;
  let j = i + 1;
  let out = '';
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\' && j + 1 < s.length) { out += s[j + 1]; j += 2; continue; }
    if (ch === q) return { text: out, next: j + 1 };
    out += ch;
    j++;
  }
  return { text: out, next: j };   // unterminated — accept what we have
}

/* Decode common HTML entities Mermaid users sprinkle into labels. */
function decodeHtml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n');
}

/* Strip Mermaid-specific inline markup that Quickagram has no
 * equivalent for, so it doesn't end up as literal text in node labels.
 *
 *   "fa:fa-car Car"          → "Car"        (FontAwesome icon prefix)
 *   "fab:fa-github GitHub"   → "GitHub"     (FA Brands)
 *   "fas:fa-cog Settings"    → "Settings"   (FA Solid)
 *   "fa:fa-truck"            → ""           (icon-only label)
 *
 * The whole `fa:fa-NAME` token (and adjacent whitespace) is removed.
 * Quickagram has its own per-kind icon registry (THEMES[kind].icon)
 * but no FontAwesome integration — passing the FA token through as
 * text just renders nonsense like "fa:fa-car Car" inside a rectangle. */
function stripMermaidMarkup(label) {
  if (label == null) return label;
  return String(label)
    .replace(/\b(?:fa|fab|fas|far|fal)[:]fa-[\w-]+\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Mermaid identifiers used as node IDs allow letters, digits, underscore,
 * hyphen, dot. Whitespace, brackets, pipes etc. are NOT id chars. */
const ID_RE = /[A-Za-z0-9_.][A-Za-z0-9_.\-]*/y;

function readId(s, i) {
  ID_RE.lastIndex = i;
  const m = ID_RE.exec(s);
  if (!m || m.index !== i) return null;
  return { id: m[0], next: i + m[0].length };
}

function skipSpaces(s, i) {
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  return i;
}

module.exports = { stripComments, readQuoted, decodeHtml, stripMermaidMarkup, readId, skipSpaces };
