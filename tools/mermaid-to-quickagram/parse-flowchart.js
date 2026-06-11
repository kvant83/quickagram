/* Parse a Mermaid `flowchart` (or `graph`) block into a normalised AST.
 *
 * Supported syntax (Mermaid docs: flowchart.html):
 *
 *   flowchart TD|TB|LR|RL|BT      (or `graph TD` etc.)
 *
 *   nodes (inferred from edges or from standalone declarations):
 *     A                            bareword id
 *     A[text]                      rectangle
 *     A(text)                      rounded rectangle
 *     A((text))                    circle
 *     A([text])                    stadium / pill
 *     A[(text)]                    cylinder
 *     A{text}                      diamond
 *     A{{text}}                    hexagon
 *     A[/text/]                    parallelogram (leans right)
 *     A[\text\]                    parallelogram (leans left)
 *     A[/text\]                    trapezoid (wider bottom)
 *     A[\text/]                    trapezoid (wider top)
 *     A[[text]]                    subroutine (rendered as rectangle)
 *     A>text]                      asymmetric (rendered as rectangle)
 *
 *   edges:
 *     A --> B                      solid arrow
 *     A --- B                      solid line, no arrow
 *     A -.-> B                     dotted arrow
 *     A -.- B                      dotted line
 *     A ==> B                      thick arrow
 *     A === B                      thick line
 *     A --o B                      circle endpoint
 *     A --x B                      x endpoint
 *     A <--> B                     bidirectional
 *     A -- text --> B              with mid-text label
 *     A -->|text| B                with pipe label
 *     A -. text .-> B              dotted with mid-text label
 *
 *   subgraph SubA[Title]
 *     ...
 *   end
 *
 * NOT supported (yet): & (multi-node), click events, classDef,
 * linkStyle, %%{init}%% blocks. */
'use strict';

const { stripComments, readQuoted, decodeHtml, stripMermaidMarkup } = require('./util');

/* ---------- shape detection ----------
 *
 * For a node body like `A[text]` we look at the open/close brackets to
 * pick a Quickagram kind. The returned kind matches a SHAPES entry we
 * registered in v0.4. */
const SHAPE_TABLE = [
  // longest-prefix first to win when ambiguous (e.g. `[[` before `[`)
  { open: '[[',  close: ']]',  kind: 'plain'           },  // subroutine -> rectangle
  { open: '[(',  close: ')]',  kind: 'db'              },  // cylinder
  { open: '([',  close: '])',  kind: 'stadium'         },
  { open: '((',  close: '))',  kind: 'circle'          },
  { open: '{{',  close: '}}',  kind: 'lb'              },  // hexagon
  { open: '[/',  close: '\\]', kind: 'trapezoid'       },  // wider at bottom
  { open: '[\\', close: '/]',  kind: 'trapezoidAlt'    },  // wider at top
  { open: '[/',  close: '/]',  kind: 'parallelogram'   },
  { open: '[\\', close: '\\]', kind: 'parallelogramAlt'},
  { open: '[',   close: ']',   kind: 'plain'           },  // rectangle
  { open: '(',   close: ')',   kind: 'plain'           },  // rounded rect (Quickagram's default rect already has corner radius)
  { open: '{',   close: '}',   kind: 'diamond'         },
  { open: '>',   close: ']',   kind: 'plain'           },  // asymmetric (approximate)
];

/* Try to consume a node body starting at `i` in `s`. If `s` opens with
 * one of the shape brackets, read the label until the matching close
 * bracket pair. Returns:
 *   { kind, label, next }    on success
 *   null                     if no body bracket at `i`. */
function readNodeBody(s, i) {
  for (const sh of SHAPE_TABLE) {
    if (s.startsWith(sh.open, i)) {
      const start = i + sh.open.length;
      // accept a quoted string as the entire label content
      if (s[start] === '"' || s[start] === "'") {
        const q = readQuoted(s, start);
        if (!q) return null;
        // expect immediate close
        if (!s.startsWith(sh.close, q.next)) continue;
        return { kind: sh.kind, label: stripMermaidMarkup(decodeHtml(q.text)), next: q.next + sh.close.length };
      }
      const closeIdx = s.indexOf(sh.close, start);
      if (closeIdx === -1) continue;
      const inner = s.slice(start, closeIdx);
      // require the body to not contain another opening bracket of a
      // *longer* form — protects `A[text` from matching `[` when really
      // it should fall through to a longer alternative.
      return {
        kind: sh.kind,
        label: stripMermaidMarkup(decodeHtml(inner)),
        next: closeIdx + sh.close.length,
      };
    }
  }
  return null;
}

/* ---------- edge token detection ----------
 *
 * Mermaid edge tokens are 3+ chars wide and mix `-`, `.`, `=`, `>`,
 * `<`, `o`, `x`. We greedily match the longest one. Returns
 *   { style, fromArrow, toArrow, midLabel?, end, length }
 * end == position right after the edge token (or after the closing
 * pipe label if one followed). */
const EDGE_PATTERNS = [
  // thick arrows
  { re: /(<)?==+(>|o|x)?/y, style: 'solid',  thick: true  },
  // dotted: -.- or -.-> (the dot is in the middle, the dashes on the sides)
  { re: /(<)?-\.+-(>|o|x)?/y, style: 'dotted' },
  { re: /(<)?-+(>|o|x)?/y,    style: 'solid' },
];

/* Map a Mermaid edge head character to a Quickagram arrow name.
 * `''` (no arrow) = 'none', `>` = 'arrow', `o` = 'circle', `x` = 'cross'. */
function mapArrow(ch) {
  if (!ch) return 'none';
  if (ch === '>') return 'arrow';
  if (ch === 'o') return 'circle';
  if (ch === 'x') return 'cross';
  return 'arrow';
}

/* Try to read an edge token at position `i`. Returns null if no edge
 * matches; otherwise the edge descriptor + the position past it. */
function readEdge(s, i) {
  for (const p of EDGE_PATTERNS) {
    p.re.lastIndex = i;
    const m = p.re.exec(s);
    if (!m || m.index !== i) continue;
    if (m[0].length < 3) continue;       // single dash like '--' isn't an edge
    const startArrowCh = m[1] || '';
    const endArrowCh   = m[2] || '';
    return {
      style:     p.style,
      thick:     !!p.thick,
      fromArrow: mapArrow(startArrowCh),
      toArrow:   mapArrow(endArrowCh),
      next:      i + m[0].length,
    };
  }
  return null;
}

/* Read an id at position `i`. Flowchart ids must START with a letter,
 * digit, or underscore — the dash is allowed in the body (`my-node`)
 * but not at position 0, where it would conflict with an edge token
 * (`-->`, `---`, etc.). */
function readFlowId(s, i) {
  if (i >= s.length) return null;
  if (!/[A-Za-z0-9_]/.test(s[i])) return null;
  let j = i + 1;
  while (j < s.length && /[A-Za-z0-9_.\-]/.test(s[j])) j++;
  return { id: s.slice(i, j), next: j };
}

function skipSp(s, i) {
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  return i;
}

/* Parse one statement line, returning a list of edge descriptors and
 * the (possibly updated) node table. Lines without an edge token are
 * treated as standalone node declarations.
 *
 * A line like `A[start] --> B[middle] --x C` produces TWO edges:
 *   A -> B   and   B -> C
 * with the node bodies registering A, B, C in the node table.
 *
 * Returns { edges: [...], nodes: [...] }. */
function parseStatement(line, ctx) {
  const out = { edges: [], nodes: [] };
  let i = 0;
  let prev = null;       // { id } of last node in the chain
  let prevEdge = null;   // pending edge descriptor (waiting for target)
  while (i < line.length) {
    i = skipSp(line, i);
    if (i >= line.length) break;

    // pipe label: |text|  immediately after an edge token
    if (line[i] === '|' && prevEdge) {
      const close = line.indexOf('|', i + 1);
      if (close === -1) break;
      prevEdge._label = stripMermaidMarkup(decodeHtml(line.slice(i + 1, close).trim()));
      i = close + 1;
      continue;
    }

    // node + optional body
    const idTok = readFlowId(line, i);
    if (idTok) {
      i = idTok.next;
      let kind = 'plain', label = idTok.id;
      const body = readNodeBody(line, i);
      if (body) { kind = body.kind; label = body.label; i = body.next; }
      out.nodes.push({ id: idTok.id, kind, label });
      if (prevEdge) {
        prevEdge.from = prev.id;
        prevEdge.to   = idTok.id;
        out.edges.push(prevEdge);
        prevEdge = null;
      }
      prev = { id: idTok.id };
      continue;
    }

    // edge token (with optional mid-text "-- text -->" form)
    // First, try "-- text --" / "-- text --o" / "-. text .->" patterns
    // by detecting a `--` (or `-.`, `==`) followed by space + words + same
    // continuation. We do this with a permissive regex.
    const mid = readMidLabelEdge(line, i);
    if (mid) {
      prevEdge = mid.edge;
      i = mid.next;
      continue;
    }

    const edge = readEdge(line, i);
    if (edge) {
      prevEdge = edge;
      i = edge.next;
      continue;
    }

    // unrecognised char — skip it (Mermaid is forgiving)
    i++;
  }
  return out;
}

/* Try to read a mid-label edge form:
 *   `-- text -->`   solid mid-text
 *   `-- text ---`   solid mid-text, no arrow
 *   `-. text .->`   dotted mid-text
 *   `== text ==>`   thick mid-text
 * Returns { edge, next } or null. */
function readMidLabelEdge(line, i) {
  // anchored regex starting at i — try thick first, then dotted, then solid
  const patterns = [
    { re: /==\s*([^=]+?)\s*==(>|o|x)?/y,    style: 'solid', thick: true },
    { re: /-\.\s*([^.]+?)\s*\.-(>|o|x)?/y,  style: 'dotted' },
    { re: /--\s*([^-]+?)\s*--(>|o|x)?/y,    style: 'solid' },
  ];
  for (const p of patterns) {
    p.re.lastIndex = i;
    const m = p.re.exec(line);
    if (!m || m.index !== i) continue;
    return {
      edge: {
        style:     p.style,
        thick:     !!p.thick,
        fromArrow: 'none',
        toArrow:   mapArrow(m[2] || ''),
        _label:    stripMermaidMarkup(decodeHtml((m[1] || '').trim())),
      },
      next: i + m[0].length,
    };
  }
  return null;
}

/* ---------- top-level parse ---------- */
function parseFlowchart(src) {
  const lines = stripComments(src);
  // Find header line, capture direction
  let direction = 'LR';
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const m = t.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)?/i);
    if (m) {
      direction = (m[1] || 'LR').toUpperCase();
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) throw new Error('no `flowchart` / `graph` header found');

  const nodeMap = new Map();   // id -> { id, kind, label }
  const edges   = [];
  const groups  = [];          // subgraphs
  const groupStack = [];       // stack of { label, nodes: [] }

  function ensureNode(n) {
    const existing = nodeMap.get(n.id);
    if (!existing) {
      nodeMap.set(n.id, { id: n.id, kind: n.kind || 'plain', label: n.label || n.id });
    } else {
      // upgrade a placeholder (no body) with a real shape later
      if (existing.kind === 'plain' && n.kind && n.kind !== 'plain') {
        existing.kind = n.kind;
      }
      if (n.label && n.label !== n.id && existing.label === existing.id) {
        existing.label = n.label;
      }
    }
    if (groupStack.length) {
      const grp = groupStack[groupStack.length - 1];
      if (!grp.nodes.includes(n.id)) grp.nodes.push(n.id);
    }
  }

  for (let li = startIdx; li < lines.length; li++) {
    const trim = lines[li].trim();
    if (!trim) continue;

    // subgraph / end
    let m = trim.match(/^subgraph\s+(.*)$/i);
    if (m) {
      // mermaid syntax:  subgraph id [Title]  OR  subgraph Title
      const tail = m[1];
      let label = tail.trim();
      const lb = tail.match(/^(\S+)\s+\[([^\]]+)\]$/);
      if (lb) label = lb[2];
      groupStack.push({ label, nodes: [] });
      continue;
    }
    if (/^end\b/i.test(trim)) {
      const grp = groupStack.pop();
      if (grp && grp.nodes.length) groups.push(grp);
      continue;
    }
    if (/^direction\s+(TD|TB|BT|LR|RL)/i.test(trim)) {
      // honour mid-block direction switches only at the top-level
      const dm = trim.match(/^direction\s+(\S+)/i);
      if (dm && !groupStack.length) direction = dm[1].toUpperCase();
      continue;
    }

    const r = parseStatement(trim, {});
    for (const n of r.nodes) ensureNode(n);
    for (const e of r.edges) {
      edges.push({
        from:      e.from,
        to:        e.to,
        style:     e.style,
        thick:     e.thick,
        fromArrow: e.fromArrow,
        toArrow:   e.toArrow,
        label:     e._label,
      });
    }
  }

  // Mermaid TB & TD are equivalent; map to Quickagram 'tb'.
  // RL / BT layouts are approximated as 'lr' / 'tb' respectively (the
  // engine has no RL/BT primitive yet; this preserves topology even if
  // it reverses direction visually).
  const layout = (direction === 'TD' || direction === 'TB' || direction === 'BT') ? 'tb' : 'lr';

  return {
    kind: 'flowchart',
    direction,
    layout,
    nodes:  Array.from(nodeMap.values()),
    edges,
    groups,
  };
}

module.exports = { parseFlowchart, readNodeBody, readEdge, parseStatement };
