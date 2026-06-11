/* Parse a Mermaid `classDiagram` into a normalised AST.
 *
 * Supported (Mermaid docs: classDiagram.html):
 *
 *   classDiagram
 *   class Animal                     bare declaration
 *   class Animal {                   block declaration
 *     +String name
 *     +int age
 *     +void eat()
 *   }
 *   Animal : +String name            single-member declaration
 *   Animal <|-- Dog                  inheritance      (B extends A, render arrow on Dog→Animal end as open triangle)
 *   Composite *-- Part               composition      (filled diamond at source)
 *   Whole o-- Part                   aggregation      (open diamond  at source)
 *   A --> B                          association
 *   A --  B                          link
 *   A ..> B                          dependency (dashed)
 *   A ..|> B                         realization (dashed inheritance)
 *
 *   A "1" --> "*" B : owns           cardinality + label
 *
 * NOT supported (yet): namespaces, generics with <>, annotations,
 * notes, click events, cssClass.
 *
 * Member visibility prefixes: + public, - private, # protected, ~ package.
 * They appear verbatim in the rendered class box.
 */
'use strict';

const { stripComments } = require('./util');

/* The full table of Mermaid class relations, longest-first so e.g.
 * `..|>` is matched before `..>`. Each yields a Quickagram edge with
 *   style, fromArrow (source end), toArrow (target end). */
const RELATIONS = [
  // realization — dashed inheritance
  { tok: '<|..',  style: 'dashed', fromArrow: 'triangle', toArrow: 'none' },
  { tok: '..|>',  style: 'dashed', fromArrow: 'none',     toArrow: 'triangle' },
  // inheritance — solid, hollow triangle at the parent side
  { tok: '<|--',  style: 'solid',  fromArrow: 'triangle', toArrow: 'none' },
  { tok: '--|>',  style: 'solid',  fromArrow: 'none',     toArrow: 'triangle' },
  // composition — filled diamond at the WHOLE side (the side with *)
  { tok: '*--',   style: 'solid',  fromArrow: 'diamond',  toArrow: 'none' },
  { tok: '--*',   style: 'solid',  fromArrow: 'none',     toArrow: 'diamond' },
  // aggregation — open diamond at the WHOLE side (the side with o)
  { tok: 'o--',   style: 'solid',  fromArrow: 'odiamond', toArrow: 'none' },
  { tok: '--o',   style: 'solid',  fromArrow: 'none',     toArrow: 'odiamond' },
  // association
  { tok: '<-->',  style: 'solid',  fromArrow: 'arrow',    toArrow: 'arrow' },
  { tok: '<--',   style: 'solid',  fromArrow: 'arrow',    toArrow: 'none' },
  { tok: '-->',   style: 'solid',  fromArrow: 'none',     toArrow: 'arrow' },
  // dependency — dashed
  { tok: '<..',   style: 'dashed', fromArrow: 'arrow',    toArrow: 'none' },
  { tok: '..>',   style: 'dashed', fromArrow: 'none',     toArrow: 'arrow' },
  { tok: '..',    style: 'dashed', fromArrow: 'none',     toArrow: 'none' },
  // link (plain)
  { tok: '--',    style: 'solid',  fromArrow: 'none',     toArrow: 'none' },
];

function tryRelation(line, i) {
  for (const r of RELATIONS) {
    if (line.startsWith(r.tok, i)) return { ...r, len: r.tok.length };
  }
  return null;
}

function locateRelation(line) {
  for (let i = 0; i < line.length; i++) {
    const r = tryRelation(line, i);
    if (r) return { pos: i, ...r };
  }
  return null;
}

function readClassId(line, i) {
  let j = i;
  while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
  return j > i ? { id: line.slice(i, j), next: j } : null;
}

/* "1" or "*" or "0..1" or "1..*" — optional cardinality wrapped in quotes. */
function readCardinality(line, i) {
  if (line[i] !== '"') return null;
  const end = line.indexOf('"', i + 1);
  if (end === -1) return null;
  return { text: line.slice(i + 1, end), next: end + 1 };
}

function skipSp(line, i) {
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

function parseClass(src) {
  const lines = stripComments(src);

  // find header
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*classDiagram(-v2)?\b/i.test(lines[i])) { startIdx = i + 1; break; }
  }
  if (startIdx === -1) throw new Error('no `classDiagram` header found');

  const classes = new Map();   // id -> { id, label, attrs: [], methods: [] }
  const edges   = [];
  let pendingBlock = null;     // currently open `class X { ... }` block

  function ensureClass(id) {
    if (!classes.has(id)) {
      classes.set(id, { id, label: id, attrs: [], methods: [] });
    }
    return classes.get(id);
  }

  function addMember(cls, raw) {
    const member = raw.trim();
    if (!member) return;
    // Methods contain `()`; attributes don't.
    if (/\(.*\)/.test(member)) cls.methods.push(member);
    else                       cls.attrs.push(member);
  }

  for (let li = startIdx; li < lines.length; li++) {
    const trim = lines[li].trim();
    if (!trim) continue;

    // inside an open class block
    if (pendingBlock) {
      if (trim === '}') { pendingBlock = null; continue; }
      addMember(pendingBlock, trim);
      continue;
    }

    // class X { member; member; }   single-line block — try this BEFORE
    // the multi-line opener so `class X { a; b }` doesn't get mistaken
    // for `class X {` with body waiting on the next line.
    let m = trim.match(/^class\s+(\w+)\s*\{(.+)\}\s*$/);
    if (m) {
      const cls = ensureClass(m[1]);
      for (const member of m[2].split(/[;\n]/)) addMember(cls, member);
      continue;
    }
    // class X {     opener (with or without space before the brace —
    //               Mermaid allows both `class Duck {` and `class Duck{`)
    m = trim.match(/^class\s+(\w+)\s*\{\s*$/);
    if (m) {
      pendingBlock = ensureClass(m[1]);
      continue;
    }
    // class X       bare declaration, no body
    m = trim.match(/^class\s+(\w+)\s*$/);
    if (m) {
      ensureClass(m[1]);
      continue;
    }

    // ClassA : member       single-member declaration
    m = trim.match(/^(\S+)\s*:\s*(.+)$/);
    // (but make sure it's not actually a relation — relations contain
    // tokens like `--`, `..`, `<|`, etc. before the colon)
    if (m && !locateRelation(trim.slice(0, trim.indexOf(':')))) {
      // also exclude `ClassA <|-- ClassB : verb` which has a relation BEFORE the colon
      const cls = ensureClass(m[1]);
      addMember(cls, m[2]);
      continue;
    }

    // relation:  A [card] REL [card] B [: label]
    const rel = locateRelation(trim);
    if (rel) {
      // left part — everything before the rel, may contain "card"
      let left  = trim.slice(0, rel.pos).trim();
      let right = trim.slice(rel.pos + rel.len).trim();
      // pull off optional cardinalities
      const leftMatch  = left.match(/^(\S+)\s+"([^"]+)"\s*$/);
      let leftId       = left, leftCard = null;
      if (leftMatch) { leftId = leftMatch[1]; leftCard = leftMatch[2]; }

      // right may have:  "1" B : label
      const rightMatch = right.match(/^"([^"]+)"\s+(\S+)(?:\s*:\s*(.+))?$/);
      let rightId = right, rightCard = null, label = null;
      if (rightMatch) {
        rightCard = rightMatch[1];
        rightId   = rightMatch[2];
        label     = rightMatch[3] ? rightMatch[3].trim() : null;
      } else {
        const plain = right.match(/^(\S+)(?:\s*:\s*(.+))?$/);
        if (plain) { rightId = plain[1]; label = plain[2] ? plain[2].trim() : null; }
      }
      ensureClass(leftId);
      ensureClass(rightId);
      // Build the final edge label combining cardinalities + verb.
      let finalLabel = label || '';
      if (leftCard || rightCard) {
        const lc = leftCard  ? ('"' + leftCard  + '" ') : '';
        const rc = rightCard ? (' "' + rightCard + '"') : '';
        finalLabel = (lc + finalLabel + rc).trim();
      }
      edges.push({
        from:      leftId,
        to:        rightId,
        style:     rel.style,
        fromArrow: rel.fromArrow,
        toArrow:   rel.toArrow,
        label:     finalLabel || undefined,
      });
      continue;
    }
  }

  return {
    kind: 'class',
    classes: Array.from(classes.values()),
    edges,
  };
}

module.exports = { parseClass, RELATIONS, tryRelation };
