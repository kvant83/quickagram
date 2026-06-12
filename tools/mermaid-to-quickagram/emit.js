/* Turn one of the parsed Mermaid ASTs into a Quickagram diagram
 * object, then pretty-print as either a JS object literal (default)
 * or strict JSON. */
'use strict';

function build(ast) {
  switch (ast.kind) {
    case 'flowchart': return buildFlowchart(ast);
    case 'sequence':  return buildSequence(ast);
    case 'class':     return buildClass(ast);
    case 'state':     return buildState(ast);
  }
  throw new Error('unsupported AST kind: ' + ast.kind);
}

/* ---------- flowchart ---------- */
function buildFlowchart(ast) {
  const nodes = ast.nodes.map(n => ({ id: n.id, kind: n.kind, label: n.label }));
  const edges = ast.edges.map(e => {
    const out = { from: e.from, to: e.to };
    if (e.label) out.label = e.label;
    if (e.style && e.style !== 'solid') out.style = e.style;
    // when both ends have a marker, default toArrow=arrow at the target
    if (e.toArrow !== undefined && e.toArrow !== 'arrow') out.toArrow = e.toArrow;
    if (e.fromArrow !== undefined && e.fromArrow !== 'none') out.fromArrow = e.fromArrow;
    if (e.thick) out.color = '#0f172a';
    return out;
  });
  const diagram = { layout: ast.layout || 'lr', padding: 40, nodes, edges };
  if (ast.groups && ast.groups.length) {
    diagram.groups = ast.groups.map(g => ({ label: g.label, nodes: g.nodes.slice() }));
  }
  return diagram;
}

/* ---------- sequence ---------- */
function buildSequence(ast) {
  const nodes = ast.participants.map(p => ({
    id: p.id, kind: p.kind === 'actor' ? 'actor' : 'participant', label: p.label,
  }));
  const edges = ast.messages.map(m => {
    const out = { from: m.from, to: m.to };
    if (m.label) out.label = m.label;
    if (m.style && m.style !== 'solid') out.style = m.style;
    if (m.toArrow !== undefined && m.toArrow !== 'arrow') out.toArrow = m.toArrow;
    if (m.fromArrow !== undefined && m.fromArrow !== 'none') out.fromArrow = m.fromArrow;
    // Carry the note-rendering metadata + the message kind through. The
    // engine dispatches on `kind: 'note'` + `note: {…}` to draw a yellow
    // note box; absence falls back to the legacy self-loop rendering.
    if (m.kind === 'note') {
      out.kind = 'note';
      if (m.note) out.note = m.note;
    }
    return out;
  });
  const diagram = { layout: 'sequence', padding: 40, nodes, edges };
  if (ast.frames && ast.frames.length) diagram.frames = ast.frames;
  return diagram;
}

/* ---------- class ---------- */
function buildClass(ast) {
  const nodes = ast.classes.map(c => {
    const n = { id: c.id, kind: 'class', label: c.label };
    if (c.attrs   && c.attrs.length)   n.attrs   = c.attrs.slice();
    if (c.methods && c.methods.length) n.methods = c.methods.slice();
    return n;
  });
  const edges = ast.edges.map(e => {
    const out = { from: e.from, to: e.to };
    if (e.label) out.label = e.label;
    if (e.style && e.style !== 'solid') out.style = e.style;
    if (e.toArrow !== undefined && e.toArrow !== 'arrow') out.toArrow = e.toArrow;
    if (e.fromArrow !== undefined && e.fromArrow !== 'none') out.fromArrow = e.fromArrow;
    return out;
  });
  return { layout: 'lr', padding: 40, nodes, edges };
}

/* ---------- state ---------- */
function buildState(ast) {
  const nodes = ast.states.map(s => {
    if (s._marker === 'start') return { id: s.id, kind: 'start', label: '' };
    if (s._marker === 'end')   return { id: s.id, kind: 'end',   label: '' };
    return { id: s.id, kind: 'state', label: s.label };
  });
  const edges = ast.edges.map(e => {
    const out = { from: e.from, to: e.to };
    if (e.label) out.label = e.label;
    if (e.style && e.style !== 'solid') out.style = e.style;
    if (e.toArrow !== undefined && e.toArrow !== 'arrow') out.toArrow = e.toArrow;
    if (e.fromArrow !== undefined && e.fromArrow !== 'none') out.fromArrow = e.fromArrow;
    return out;
  });
  const diagram = { layout: 'lr', padding: 40, nodes, edges };
  if (ast.groups && ast.groups.length) {
    diagram.groups = ast.groups.map(g => ({ label: g.label, nodes: g.nodes.slice() }));
  }
  return diagram;
}

/* ---------- pretty-printers ---------- */
function prettyJS(diagram) {
  const lines = ['{'];
  if (diagram.layout)  lines.push('  layout:  ' + JSON.stringify(diagram.layout) + ',');
  if (diagram.padding != null) lines.push('  padding: ' + diagram.padding + ',');
  lines.push('  nodes: [');
  for (const n of diagram.nodes) lines.push('    ' + nodeLiteral(n) + ',');
  lines.push('  ],');
  if (diagram.edges && diagram.edges.length) {
    lines.push('  edges: [');
    for (const e of diagram.edges) lines.push('    ' + edgeLiteral(e) + ',');
    lines.push('  ],');
  }
  if (diagram.groups && diagram.groups.length) {
    lines.push('  groups: [');
    for (const g of diagram.groups) lines.push('    ' + groupLiteral(g) + ',');
    lines.push('  ],');
  }
  if (diagram.frames && diagram.frames.length) {
    lines.push('  frames: [');
    for (const f of diagram.frames) lines.push('    ' + frameLiteral(f) + ',');
    lines.push('  ],');
  }
  lines.push('}');
  return lines.join('\n');
}

function nodeLiteral(n) {
  const parts = [
    'id: '    + JSON.stringify(n.id),
    'kind: '  + JSON.stringify(n.kind),
    'label: ' + JSON.stringify(n.label),
  ];
  if (n.attrs   && n.attrs.length)   parts.push('attrs: '   + JSON.stringify(n.attrs));
  if (n.methods && n.methods.length) parts.push('methods: ' + JSON.stringify(n.methods));
  return '{ ' + parts.join(', ') + ' }';
}

function frameLiteral(f) {
  const parts = [
    'kind: '         + JSON.stringify(f.kind),
    'label: '        + JSON.stringify(f.label || ''),
    'startMsgIdx: ' + f.startMsgIdx,
    'endMsgIdx: '   + f.endMsgIdx,
  ];
  if (f.dividers && f.dividers.length) {
    parts.push('dividers: ' + JSON.stringify(f.dividers));
  }
  return '{ ' + parts.join(', ') + ' }';
}

function edgeLiteral(e) {
  const parts = [
    'from: ' + JSON.stringify(e.from),
    'to: '   + JSON.stringify(e.to),
  ];
  if (e.kind === 'note') parts.push('kind: ' + JSON.stringify(e.kind));
  if (e.label)      parts.push('label: '     + JSON.stringify(e.label));
  if (e.style)      parts.push('style: '     + JSON.stringify(e.style));
  if (e.toArrow)    parts.push('toArrow: '   + JSON.stringify(e.toArrow));
  if (e.fromArrow)  parts.push('fromArrow: ' + JSON.stringify(e.fromArrow));
  if (e.color)      parts.push('color: '     + JSON.stringify(e.color));
  if (e.note)       parts.push('note: '      + JSON.stringify(e.note));
  return '{ ' + parts.join(', ') + ' }';
}

function groupLiteral(g) {
  return '{ label: ' + JSON.stringify(g.label) + ', nodes: ' + JSON.stringify(g.nodes) + ' }';
}

module.exports = { build, prettyJS };
