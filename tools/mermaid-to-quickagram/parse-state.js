/* Parse a Mermaid `stateDiagram` / `stateDiagram-v2` into an AST.
 *
 * Supported (Mermaid docs: stateDiagram.html):
 *
 *   stateDiagram-v2
 *   [*] --> Still                    initial transition
 *   Still --> [*]                    final transition
 *   Still --> Moving : event         transition with label
 *   Moving --> Crash : break
 *
 *   state "Long Description" as L    state with description
 *   note right of A: explanation     (ignored — no Quickagram primitive)
 *
 *   state X {                        composite state — flatten into a group
 *     A --> B
 *   }
 *
 * NOT supported (yet): <<choice>>, <<fork>>, <<join>>, concurrent regions.
 */
'use strict';

const { stripComments } = require('./util');

/* Mermaid's `[*]` is a SINGLETON per scope — every `[*]` appearing as
 * a source in the diagram refers to the same single start state, and
 * every `[*]` appearing as a target refers to the same single end
 * state. Rendered output therefore has one filled-circle start marker
 * and one ringed-circle end marker per scope, regardless of how many
 * transitions touch them.
 *
 * We model this with two synthetic ids per scope. The top-level scope
 * uses `__start__` / `__end__`. Composite states nest under their own
 * scope id (`__start__<comp>` / `__end__<comp>`) so a composite's
 * internal start/end don't collide with the outer diagram's. */
function startId(scope) { return scope ? '__start__' + scope : '__start__'; }
function endId(scope)   { return scope ? '__end__'   + scope : '__end__';   }

function readStateId(line, i) {
  if (line.startsWith('[*]', i)) return { id: '[*]', next: i + 3 };
  let j = i;
  while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
  return j > i ? { id: line.slice(i, j), next: j } : null;
}

function skipSp(line, i) {
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

function parseState(src) {
  const lines = stripComments(src);

  // find header (also accept the legacy `stateDiagram` form)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*stateDiagram(-v2)?\b/i.test(lines[i])) { startIdx = i + 1; break; }
  }
  if (startIdx === -1) throw new Error('no `stateDiagram` header found');

  const states = new Map();    // id -> { id, label }
  const edges  = [];
  const groups = [];           // composite states
  const stack  = [];           // composite-state stack: { id, members: [] }

  function ensureState(id, label) {
    if (id === '[*]') return;          // handled separately
    if (!states.has(id)) states.set(id, { id, label: label || id });
    else if (label) states.get(id).label = label;
    if (stack.length) {
      const top = stack[stack.length - 1];
      if (!top.members.includes(id)) top.members.push(id);
    }
  }

  for (let li = startIdx; li < lines.length; li++) {
    const trim = lines[li].trim();
    if (!trim) continue;

    // state "Description" as Id
    let m = trim.match(/^state\s+"([^"]+)"\s+as\s+(\S+)\s*$/);
    if (m) { ensureState(m[2], m[1]); continue; }

    // state Name : description  (alt syntax)
    m = trim.match(/^state\s+(\S+)\s*:\s*(.+)$/);
    if (m) { ensureState(m[1], m[2]); continue; }

    // composite state open:  state Name { OR state "Desc" as Id {
    m = trim.match(/^state\s+(?:"([^"]+)"\s+as\s+)?(\S+)\s*\{$/);
    if (m) {
      const id = m[2];
      const label = m[1] || id;
      ensureState(id, label);
      stack.push({ id, label, members: [] });
      continue;
    }
    if (trim === '}') {
      const grp = stack.pop();
      if (grp) groups.push({ label: grp.label, nodes: grp.members.slice() });
      continue;
    }

    // notes — ignored (no Quickagram primitive); leave them out rather
    // than fudge into something misleading.
    if (/^note\b/i.test(trim)) continue;

    // skip directives we don't handle:
    if (/^(direction|classDef|class\b)/i.test(trim)) continue;

    // transition:  X --> Y [: label]
    m = trim.match(/^(\[\*\]|\S+)\s*-->\s*(\[\*\]|\S+)\s*(?::\s*(.+))?$/);
    if (m) {
      let from = m[1], to = m[2];
      const label = m[3] ? m[3].trim() : undefined;
      // Scope = innermost composite state on the stack (or top-level).
      const scope = stack.length ? stack[stack.length - 1].id : '';
      if (from === '[*]') {
        const id = startId(scope);
        if (!states.has(id)) {
          states.set(id, { id, label: '', _marker: 'start' });
          if (stack.length) stack[stack.length - 1].members.push(id);
        }
        from = id;
      }
      if (to === '[*]') {
        const id = endId(scope);
        if (!states.has(id)) {
          states.set(id, { id, label: '', _marker: 'end' });
          if (stack.length) stack[stack.length - 1].members.push(id);
        }
        to = id;
      }
      ensureState(from);
      ensureState(to);
      edges.push({ from, to, label, style: 'solid', toArrow: 'arrow' });
      continue;
    }
  }

  return {
    kind: 'state',
    states: Array.from(states.values()),
    edges,
    groups,
  };
}

module.exports = { parseState };
