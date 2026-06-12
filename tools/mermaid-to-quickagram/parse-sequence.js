/* Parse a Mermaid `sequenceDiagram` block into a normalised AST.
 *
 * Supported (Mermaid docs: sequenceDiagram.html):
 *
 *   sequenceDiagram
 *   participant Alice
 *   participant Bob as B           (alias — render label 'B', id 'Bob')
 *   actor Carol                    (actor kind, otherwise same)
 *   Alice ->> Bob: hello           solid arrow
 *   Bob -->> Alice: hi             dashed arrow
 *   Alice -> Bob: line             solid line, no arrow
 *   Alice --> Bob: dashed line     dashed line, no arrow
 *   Alice -x Bob: lost             solid line + x marker
 *   Alice --x Bob: lost dashed     dashed line + x marker
 *
 *   Note over Alice,Bob: text
 *   Note left of Alice: text
 *   Note right of Bob:  text
 *
 * NOT supported (yet): activate/deactivate, loop/alt/opt/par/critical,
 * autonumber, links, accTitle/accDescr. They are silently skipped so
 * the rest of the diagram still parses. */
'use strict';

const { stripComments } = require('./util');

/* Maps a Mermaid arrow token to { style, toArrow } for Quickagram.
 *
 * Mermaid arrows:
 *   ->     solid line, no arrowhead
 *   ->>    solid line, arrowhead
 *   -->    dashed line, no arrowhead
 *   -->>   dashed line, arrowhead
 *   -x     solid + cross marker
 *   --x    dashed + cross marker
 *   -)     solid + open arrow (async)
 *   --)    dashed + open arrow (async)
 */
const ARROW_TABLE = [
  { tok: '-->>', style: 'dashed', toArrow: 'arrow'  },
  { tok: '->>',  style: 'solid',  toArrow: 'arrow'  },
  { tok: '-->',  style: 'dashed', toArrow: 'none'   },
  { tok: '-->',  style: 'dashed', toArrow: 'none'   },
  { tok: '--x',  style: 'dashed', toArrow: 'cross'  },
  { tok: '-x',   style: 'solid',  toArrow: 'cross'  },
  { tok: '--)',  style: 'dashed', toArrow: 'arrow'  },
  { tok: '-)',   style: 'solid',  toArrow: 'arrow'  },
  { tok: '->',   style: 'solid',  toArrow: 'none'   },
];

function tryArrow(line, i) {
  for (const a of ARROW_TABLE) {
    if (line.startsWith(a.tok, i)) return { ...a, len: a.tok.length };
  }
  return null;
}

/* Strict id: letters, digits, underscore. Mermaid sequence ids don't
 * allow hyphens or dots (those are participant *names*, quoted if
 * unusual). */
function readSeqId(line, i) {
  let j = i;
  while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
  return j > i ? { id: line.slice(i, j), next: j } : null;
}

function skipSp(line, i) {
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

/* Look for an arrow somewhere in the line; return its position + descriptor
 * or null. Used to find  `id ->> id : text` patterns. */
function locateArrow(line) {
  for (let i = 0; i < line.length; i++) {
    const a = tryArrow(line, i);
    if (a) return { pos: i, ...a };
  }
  return null;
}

function parseSequence(src) {
  const lines = stripComments(src);

  // find header
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*sequenceDiagram\b/i.test(lines[i])) { startIdx = i + 1; break; }
  }
  if (startIdx === -1) throw new Error('no `sequenceDiagram` header found');

  const participants = new Map();   // id -> { id, kind: 'participant'|'actor', label }
  const messages     = [];
  const frames       = [];          // emitted { kind, label, startMsgIdx, endMsgIdx, dividers? }
  const frameStack   = [];          // open frames being assembled

  function ensureParticipant(id, opts = {}) {
    if (!participants.has(id)) {
      participants.set(id, {
        id,
        kind:  opts.kind  || 'participant',
        label: opts.label || id,
      });
    } else if (opts.label) {
      // explicit declaration upgrades the label
      participants.get(id).label = opts.label;
      if (opts.kind) participants.get(id).kind = opts.kind;
    }
  }

  for (let li = startIdx; li < lines.length; li++) {
    const trim = lines[li].trim();
    if (!trim) continue;

    // participant / actor declaration
    let m = trim.match(/^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i);
    if (m) {
      const kind = m[1].toLowerCase() === 'actor' ? 'actor' : 'participant';
      ensureParticipant(m[2], { kind, label: m[3] ? m[3].trim() : m[2] });
      continue;
    }

    // Note
    //
    // Emit as a "note" message in the timeline so it keeps its slot
    // in the message stream (so frame y-bounds are calculated
    // correctly). The legacy fields (from/to/label/style/toArrow/
    // fromArrow) are kept so older snapshot tests / asserts that
    // expected a self-loop "📝 …" still see one. The engine's
    // sequence renderer now dispatches on the `note` payload field
    // and draws a proper yellow note box positioned per the
    // position spec when present, falling back to the self-loop
    // form when the payload is missing.
    m = trim.match(/^Note\s+(left of|right of|over)\s+(.+?)\s*:\s*(.+)$/i);
    if (m) {
      const position = m[1].toLowerCase().replace(' of', '');  // 'left' | 'right' | 'over'
      const ids = m[2].split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
      const text = m[3];
      for (const id of ids) ensureParticipant(id);
      messages.push({
        kind:      'note',
        from:      ids[0],
        to:        ids[0],
        label:     '📝 ' + text,
        style:     'dotted',
        toArrow:   'none',
        fromArrow: 'none',
        note: { position, participants: ids, text },
      });
      continue;
    }

    // Frame-opener:  loop / alt / opt / par / critical / break / rect <label?>
    //
    // Each opens a region. `end` closes the innermost open region and
    // emits a frame with the message indices it spans. `else` (in alt)
    // / `and` (in par) / `option` (in critical) add a divider inside
    // the current frame at the next message position.
    m = trim.match(/^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/i);
    if (m) {
      frameStack.push({
        kind: m[1].toLowerCase(),
        label: (m[2] || '').trim(),
        startMsgIdx: messages.length,
        dividers: [],
      });
      continue;
    }
    if (/^end\b/i.test(trim)) {
      const top = frameStack.pop();
      if (top && messages.length > top.startMsgIdx) {
        frames.push({
          kind: top.kind,
          label: top.label,
          startMsgIdx: top.startMsgIdx,
          endMsgIdx:   messages.length - 1,
          dividers:    top.dividers.length ? top.dividers : undefined,
        });
      }
      continue;
    }
    m = trim.match(/^(else|and|option)\b\s*(.*)$/i);
    if (m && frameStack.length) {
      const top = frameStack[frameStack.length - 1];
      top.dividers.push({ idx: messages.length, label: (m[2] || '').trim() });
      continue;
    }

    // Remaining skip-list — features we still don't represent.
    if (/^(activate|deactivate|autonumber|links?|accTitle|accDescr|box)\b/i.test(trim)) {
      continue;
    }

    // message: <id> <arrow> <id> : <text>
    const arr = locateArrow(trim);
    if (!arr) continue;
    const fromPart = trim.slice(0, arr.pos).trim();
    const rest     = trim.slice(arr.pos + arr.len);
    const colonAt  = rest.indexOf(':');
    const toPart   = (colonAt === -1 ? rest : rest.slice(0, colonAt)).trim();
    const label    = colonAt === -1 ? '' : rest.slice(colonAt + 1).trim();
    if (!fromPart || !toPart) continue;
    ensureParticipant(fromPart);
    ensureParticipant(toPart);
    messages.push({
      kind:      'message',
      from:      fromPart,
      to:        toPart,
      label,
      style:     arr.style,
      toArrow:   arr.toArrow,
      fromArrow: 'none',
    });
  }

  return {
    kind: 'sequence',
    participants: Array.from(participants.values()),
    messages,
    frames,
  };
}

module.exports = { parseSequence, tryArrow, ARROW_TABLE };
