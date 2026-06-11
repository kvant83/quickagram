/* Detect a Mermaid source's diagram type from its header line. */
'use strict';

function sniffKind(src) {
  for (const raw of src.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith('%%')) continue;
    if (/^flowchart\b/i.test(t))          return 'flowchart';
    if (/^graph\b/i.test(t))              return 'flowchart';
    if (/^sequenceDiagram\b/i.test(t))    return 'sequence';
    if (/^classDiagram(-v2)?\b/i.test(t)) return 'class';
    if (/^stateDiagram(-v2)?\b/i.test(t)) return 'state';
    if (/^erDiagram\b/i.test(t))          return 'er';
    return null;
  }
  return null;
}

module.exports = { sniffKind };
