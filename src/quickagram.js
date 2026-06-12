/*!
 * Quickagram — a tiny, dependency-free SVG diagram engine.
 * https://github.com/kvant83/quickagram
 *
 * Copyright (c) 2024 The Quickagram authors
 * SPDX-License-Identifier: Apache-2.0
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Quickagram = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const DEFAULT_W = 168;
  const DEFAULT_H = 72;

  /* ---------- palette ---------- */
  const THEMES = {
    client:   { top: '#7aa2f7', bot: '#3b66d6', border: '#274690', shape: 'rect',     icon: 'user' },
    user:     { top: '#7aa2f7', bot: '#3b66d6', border: '#274690', shape: 'rect',     icon: 'user' },
    web:      { top: '#a78bfa', bot: '#7c3aed', border: '#5b21b6', shape: 'rect',     icon: 'server' },
    api:      { top: '#c084fc', bot: '#9333ea', border: '#6b21a8', shape: 'rect',     icon: 'cube'   },
    service:  { top: '#2dd4bf', bot: '#0d9488', border: '#0f766e', shape: 'rect',     icon: 'gear'   },
    cache:    { top: '#fcd34d', bot: '#f59e0b', border: '#b45309', shape: 'cylinder', dashed: true   },
    db:       { top: '#4ade80', bot: '#16a34a', border: '#15803d', shape: 'cylinder'                 },
    nosql:    { top: '#86efac', bot: '#22c55e', border: '#15803d', shape: 'cylinder', dashed: true   },
    queue:    { top: '#fb923c', bot: '#ea580c', border: '#9a3412', shape: 'queue'                    },
    storage:  { top: '#22d3ee', bot: '#0891b2', border: '#155e75', shape: 'bucket'                   },
    cdn:      { top: '#7dd3fc', bot: '#0284c7', border: '#075985', shape: 'cloud'                    },
    dns:      { top: '#cbd5e1', bot: '#64748b', border: '#334155', shape: 'cloud'                    },
    internet: { top: '#cbd5e1', bot: '#64748b', border: '#334155', shape: 'cloud'                    },
    lb:       { top: '#94a3b8', bot: '#475569', border: '#1e293b', shape: 'hex'                      },
    analytics:{ top: '#f9a8d4', bot: '#db2777', border: '#9d174d', shape: 'rect',     icon: 'chart'  },
    search:   { top: '#fb7185', bot: '#e11d48', border: '#9f1239', shape: 'rect',     icon: 'lens'   },
    worker:   { top: '#bef264', bot: '#65a30d', border: '#3f6212', shape: 'rect',     icon: 'gear'   },
    mr:       { top: '#c4b5fd', bot: '#7c3aed', border: '#4c1d95', shape: 'stack'                    },
    process:  { top: '#fde68a', bot: '#d97706', border: '#92400e', shape: 'process'                  },
    note:     { top: '#fef3c7', bot: '#fde68a', border: '#a16207', shape: 'note'                     },
    class:    { top: '#818cf8', bot: '#4f46e5', border: '#3730a3', shape: 'class'                    },
    actor:    { top: '#fbcfe8', bot: '#ec4899', border: '#831843', shape: 'actor'                    },
    plain:    { top: '#f1f5f9', bot: '#e2e8f0', border: '#94a3b8', shape: 'rect'                     },
    /* ---- new shapes added in v0.4: flowchart / state / sequence ---- */
    circle:        { top: '#fde68a', bot: '#fbbf24', border: '#b45309', shape: 'circle'                },
    stadium:       { top: '#bae6fd', bot: '#38bdf8', border: '#075985', shape: 'stadium'               },
    parallelogram: { top: '#ddd6fe', bot: '#a78bfa', border: '#5b21b6', shape: 'parallelogram'         },
    parallelogramAlt:{top:'#ddd6fe', bot: '#a78bfa', border: '#5b21b6', shape: 'parallelogramAlt'      },
    trapezoid:     { top: '#fed7aa', bot: '#fb923c', border: '#9a3412', shape: 'trapezoid'             },
    trapezoidAlt:  { top: '#fed7aa', bot: '#fb923c', border: '#9a3412', shape: 'trapezoidAlt'          },
    diamond:       { top: '#fef3c7', bot: '#fbbf24', border: '#92400e', shape: 'diamond'               },
    state:         { top: '#e0e7ff', bot: '#a5b4fc', border: '#3730a3', shape: 'rect'                  },
    /* small markers used by stateDiagrams for [*] start/end. */
    start:         { top: '#1e293b', bot: '#0f172a', border: '#000000', shape: 'dot'                   },
    end:           { top: '#1e293b', bot: '#0f172a', border: '#000000', shape: 'doubleDot'             },
    /* sequenceDiagram participant column header. */
    participant:   { top: '#e0e7ff', bot: '#818cf8', border: '#3730a3', shape: 'rect'                  },
  };

  const ICONS = {
    user:   'M -7 -2 a 7 7 0 1 1 14 0 a 7 7 0 1 1 -14 0 M -12 14 c 0 -7 5 -10 12 -10 s 12 3 12 10',
    server: 'M -10 -10 h 20 v 7 h -20 z M -10 -1 h 20 v 7 h -20 z M -10 8 h 20 v 4 h -20 z',
    cube:   'M -10 -7 L 0 -12 L 10 -7 L 10 7 L 0 12 L -10 7 Z M -10 -7 L 0 -2 L 10 -7 M 0 -2 L 0 12',
    gear:   'M -2 -10 h 4 v 3 l 3 1 l 2 -2 l 3 3 l -2 2 l 1 3 h 3 v 4 h -3 l -1 3 l 2 2 l -3 3 l -2 -2 l -3 1 v 3 h -4 v -3 l -3 -1 l -2 2 l -3 -3 l 2 -2 l -1 -3 h -3 v -4 h 3 l 1 -3 l -2 -2 l 3 -3 l 2 2 l 3 -1 z M 0 -4 a 4 4 0 1 1 0 8 a 4 4 0 1 1 0 -8',
    chart:  'M -10 10 v -16 M -10 10 h 20 M -6 6 v -8 M -1 6 v -12 M 4 6 v -5',
    lens:   'M -4 -4 a 6 6 0 1 1 0 12 a 6 6 0 1 1 0 -12 M 4 6 L 11 12',
  };

  /* ---------- helpers ---------- */
  const $ = (tag, attrs = {}, parent = null) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };

  const lighten = (hex, amt = 0.15) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    const m = c => Math.min(255, Math.round(c + (255 - c) * amt));
    return `#${m(r).toString(16).padStart(2, '0')}${m(g).toString(16).padStart(2, '0')}${m(b).toString(16).padStart(2, '0')}`;
  };
  // Approximate luminance of a hex colour, 0..1
  const luminance = hex => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16) / 255;
    const g = parseInt(h.substr(2, 2), 16) / 255;
    const b = parseInt(h.substr(4, 2), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  // Pick a readable text colour for a node's gradient — light kinds (plain,
  // note, cache) get dark text; everything else gets white.
  const textColorFor = theme => {
    const avg = (luminance(theme.top) + luminance(theme.bot)) / 2;
    return avg > 0.62 ? '#1e293b' : '#ffffff';
  };

  /* ---------- shapes: each returns either a path string (body only)
                       or { body, decoration?, back? }
       body       — filled with the kind's gradient, cast shadow
       decoration — stroke-only, drawn on top of body (rim lines, fold creases)
       back       — drawn behind body (stacked papers, etc.)
  ---------- */
  const SHAPES = {
    rect: (w, h, r = 12) =>
      `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,

    cylinder: (w, h) => {
      const ry = Math.min(10, h * 0.18);
      return {
        body: `M 0 ${ry} a ${w / 2} ${ry} 0 0 1 ${w} 0 V ${h - ry} a ${w / 2} ${ry} 0 0 1 ${-w} 0 Z`,
        decoration: `M 0 ${ry} a ${w / 2} ${ry} 0 0 0 ${w} 0`,
      };
    },

    hex: (w, h) => {
      const k = Math.min(20, w * 0.18);
      return `M ${k} 0 H ${w - k} L ${w} ${h / 2} L ${w - k} ${h} H ${k} L 0 ${h / 2} Z`;
    },

    cloud: (w, h) => {
      const r1 = h * 0.45, r2 = h * 0.4, r3 = h * 0.35, r4 = h * 0.38;
      return `M ${w * 0.2} ${h * 0.95} a ${r1} ${r1} 0 0 1 ${-r1 * 0.6} ${-r1 * 1.4} a ${r2} ${r2} 0 0 1 ${r2 * 1.1} ${-r2 * 0.95} a ${r3} ${r3} 0 0 1 ${r3 * 1.6} ${-r3 * 0.1} a ${r4} ${r4} 0 0 1 ${r4 * 0.9} ${r4 * 1.6} a ${r1} ${r1} 0 0 1 ${-r1 * 0.4} ${r1} Z`;
    },

    queue: (w, h) => {
      let dec = '';
      for (let i = 1; i < 4; i++) {
        const x = (w / 4) * i;
        dec += ` M ${x} 8 V ${h - 8}`;
      }
      return { body: SHAPES.rect(w, h, 6), decoration: dec.trim() };
    },

    bucket: (w, h) => {
      const ry = h * 0.12;
      return {
        body: `M 0 ${ry} a ${w / 2} ${ry} 0 0 1 ${w} 0 V ${h - ry} L ${w * 0.92} ${h} H ${w * 0.08} L 0 ${h - ry} Z`,
        decoration: `M 0 ${ry} a ${w / 2} ${ry} 0 0 0 ${w} 0`,
      };
    },

    stack: (w, h) => {
      const off = 5;
      const back = `M ${off} ${off} h ${w - off * 2} v ${h - off * 2} h ${-(w - off * 2)} z` +
                   ` M 0 0 h ${w - off * 2} v ${h - off * 2} h ${-(w - off * 2)} z`;
      return {
        back,
        body: `M ${off * 2} ${off * 2} h ${w - off * 2} v ${h - off * 2} h ${-(w - off * 2)} z`,
      };
    },

    process: (w, h) => {
      const k = h * 0.5;
      return `M ${k} 0 H ${w - k} L ${w} ${h / 2} L ${w - k} ${h} H ${k} L 0 ${h / 2} Z`;
    },

    note: (w, h) => {
      const f = 16;
      return {
        body: `M 0 0 H ${w - f} L ${w} ${f} V ${h} H 0 Z`,
        decoration: `M ${w - f} 0 V ${f} H ${w}`,
      };
    },

    actor: (w, h) => {
      const cx = w / 2;
      return `M ${cx} 8 a 8 8 0 1 1 0.001 0 Z M ${cx} 16 v 18 M ${cx - 12} 22 h 24 M ${cx} 34 l -10 14 M ${cx} 34 l 10 14`;
    },

    /* ---- new shapes for flowchart / state / sequence ---- */
    circle: (w, h) => {
      const r = Math.min(w, h) / 2;
      const cx = w / 2, cy = h / 2;
      return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
    },

    stadium: (w, h) => {
      // pill: rectangle with semicircular ends (Mermaid `id([text])`)
      const r = h / 2;
      return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    },

    parallelogram: (w, h) => {
      // leans right: Mermaid `id[/text/]`
      const k = Math.min(h * 0.6, w * 0.25);
      return `M ${k} 0 H ${w} L ${w - k} ${h} H 0 Z`;
    },
    parallelogramAlt: (w, h) => {
      // leans left: Mermaid `id[\text\]`
      const k = Math.min(h * 0.6, w * 0.25);
      return `M 0 0 H ${w - k} L ${w} ${h} H ${k} Z`;
    },

    trapezoid: (w, h) => {
      // wider at bottom: Mermaid `id[/text\]`
      const k = Math.min(h * 0.6, w * 0.25);
      return `M ${k} 0 H ${w - k} L ${w} ${h} H 0 Z`;
    },
    trapezoidAlt: (w, h) => {
      // wider at top: Mermaid `id[\text/]`
      const k = Math.min(h * 0.6, w * 0.25);
      return `M 0 0 H ${w} L ${w - k} ${h} H ${k} Z`;
    },

    diamond: (w, h) => {
      // 4-corner rhombus: Mermaid `id{text}`
      const cx = w / 2, cy = h / 2;
      return `M ${cx} 0 L ${w} ${cy} L ${cx} ${h} L 0 ${cy} Z`;
    },

    /* small filled-circle marker for stateDiagram [*] start. */
    dot: (w, h) => {
      const r = Math.min(w, h) / 2;
      const cx = w / 2, cy = h / 2;
      return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
    },
    /* ringed dot for stateDiagram [*] end. */
    doubleDot: (w, h) => {
      const r = Math.min(w, h) / 2;
      const cx = w / 2, cy = h / 2;
      const rin = r * 0.55;
      return {
        body:       `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`,
        decoration: `M ${cx - rin} ${cy} a ${rin} ${rin} 0 1 0 ${rin * 2} 0 a ${rin} ${rin} 0 1 0 ${-rin * 2} 0 Z`,
      };
    },
  };

  /* ---------- defs (gradients + shadow + arrowheads) ---------- */
  function ensureDefs(svg) {
    let defs = svg.querySelector('defs');
    if (defs) return defs;
    defs = $('defs', {}, svg);

    const f = $('filter', { id: 'qa-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    $('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '2.5' }, f);
    $('feOffset', { dx: '0', dy: '3', result: 'off' }, f);
    const fct = $('feComponentTransfer', {}, f);
    $('feFuncA', { type: 'linear', slope: '0.25' }, fct);
    const merge = $('feMerge', {}, f);
    $('feMergeNode', {}, merge);
    $('feMergeNode', { in: 'SourceGraphic' }, merge);

    /* Helpers — each marker is a 10x10 unit symbol attached at refX=9,
     * refY=5 so the marker's tip aligns with the line endpoint. We use
     * orient="auto-start-reverse" so the same marker works at either
     * end of a line. */
    const filledArrow = (id, color) => {
      const m = $('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '8', markerHeight: '8', orient: 'auto-start-reverse' }, defs);
      $('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: color }, m);
    };
    const openTriangle = (id, color) => {
      // Open triangle — UML inheritance / generalisation. Big head, hollow.
      const m = $('marker', { id, viewBox: '0 0 12 12', refX: '11', refY: '6', markerWidth: '12', markerHeight: '12', orient: 'auto-start-reverse' }, defs);
      $('path', { d: 'M 0 0 L 11 6 L 0 12 Z', fill: '#ffffff', stroke: color, 'stroke-width': '1.6', 'stroke-linejoin': 'round' }, m);
    };
    const filledDiamond = (id, color) => {
      // Filled diamond — UML composition. Sits at SOURCE end.
      const m = $('marker', { id, viewBox: '0 0 14 10', refX: '1', refY: '5', markerWidth: '14', markerHeight: '10', orient: 'auto-start-reverse' }, defs);
      $('path', { d: 'M 0 5 L 7 0 L 14 5 L 7 10 Z', fill: color, stroke: color, 'stroke-width': '1.2', 'stroke-linejoin': 'round' }, m);
    };
    const openDiamond = (id, color) => {
      // Hollow diamond — UML aggregation. Sits at SOURCE end.
      const m = $('marker', { id, viewBox: '0 0 14 10', refX: '1', refY: '5', markerWidth: '14', markerHeight: '10', orient: 'auto-start-reverse' }, defs);
      $('path', { d: 'M 0 5 L 7 0 L 14 5 L 7 10 Z', fill: '#ffffff', stroke: color, 'stroke-width': '1.4', 'stroke-linejoin': 'round' }, m);
    };
    const filledCircle = (id, color) => {
      // Solid circle endpoint (Mermaid flowchart `--o`).
      const m = $('marker', { id, viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '8', markerHeight: '8', orient: 'auto-start-reverse' }, defs);
      $('circle', { cx: '5', cy: '5', r: '4', fill: color, stroke: color }, m);
    };
    const cross = (id, color) => {
      // X endpoint (Mermaid flowchart `--x`).
      const m = $('marker', { id, viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '10', markerHeight: '10', orient: 'auto-start-reverse' }, defs);
      $('path', { d: 'M 1 1 L 9 9 M 9 1 L 1 9', fill: 'none', stroke: color, 'stroke-width': '1.8', 'stroke-linecap': 'round' }, m);
    };
    const COLOR = '#334155';
    filledArrow ('qa-arrow',     COLOR);
    openTriangle('qa-triangle',  COLOR);
    filledDiamond('qa-diamond',  COLOR);
    openDiamond ('qa-odiamond',  COLOR);
    filledCircle('qa-circle',    COLOR);
    cross       ('qa-cross',     COLOR);
    return defs;
  }

  /* Map an edge's arrow-name to its marker id. `'none'` and falsy values
   * mean "no marker". Default at the destination end is the regular arrow. */
  const ARROW_MARKER = {
    'arrow':    'qa-arrow',
    'triangle': 'qa-triangle',
    'diamond':  'qa-diamond',
    'odiamond': 'qa-odiamond',
    'circle':   'qa-circle',
    'cross':    'qa-cross',
  };
  function arrowMarker(name) {
    if (!name || name === 'none') return null;
    return ARROW_MARKER[name] ? `url(#${ARROW_MARKER[name]})` : null;
  }

  function ensureGradient(defs, theme) {
    const id = `qa-g-${theme.top.replace('#', '')}-${theme.bot.replace('#', '')}`;
    if (defs.querySelector(`#${CSS.escape(id)}`)) return id;
    const g = $('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    $('stop', { offset: '0%',   'stop-color': lighten(theme.top, 0.08) }, g);
    $('stop', { offset: '100%', 'stop-color': theme.bot }, g);
    return id;
  }

  /* ---------- auto sizing ---------- */
  // Rough text width estimate (Inter @ 13px regular):
  //   monospace ~7.3 px/char, sans-serif ~6.8 px/char average.
  const CHAR_W_SANS = 7.2;
  const CHAR_W_MONO = 7.3;
  const SUB_CHAR_W  = 6.0;

  function autoNodeSize(node) {
    if (node.kind === 'class') {
      const lines = [node.label || ''].concat(node.attrs || []).concat(node.methods || []);
      const longest = lines.reduce((m, s) => Math.max(m, s.length), 0);
      const w = node.w || Math.max(220, Math.ceil(longest * CHAR_W_MONO) + 28);
      const lineH = 18;
      const attrs = node.attrs || [];
      const meths = node.methods || [];
      const headerH = 30;
      const bodyH = (attrs.length + meths.length) * lineH + (attrs.length && meths.length ? 8 : 0) + 16;
      const h = node.h || (headerH + Math.max(bodyH, 28));
      return { w, h };
    }
    const theme = THEMES[node.kind] || THEMES.plain;
    // stateDiagram `[*]` markers render as small filled / ringed circles.
    // Their bbox MUST be small + square — otherwise auto-layout reserves a
    // text-sized rectangle of space and arrows terminate at that hidden
    // rectangle edge, far from the visible dot.
    if (theme.shape === 'dot' || theme.shape === 'doubleDot') {
      const d = node.w || node.h || 24;
      return { w: d, h: d };
    }
    const hasIcon = theme.icon && ICONS[theme.icon];
    const labelW = (node.label || '').length * CHAR_W_SANS;
    const subW   = (node.sub   || '').length * SUB_CHAR_W;
    const contentW = Math.max(labelW, subW);
    let w = node.w || Math.max(DEFAULT_W, Math.ceil(contentW + (hasIcon ? 32 : 0) + 36));
    let h = node.h || (node.sub ? Math.max(DEFAULT_H, 78) : DEFAULT_H);
    // Circle / diamond shapes should be SQUARE so their visible body
    // aligns with the bounding box on all four sides. Otherwise an
    // arrow entering from the left lands in empty space outside the
    // visible curve. Stadium (pill) is intentionally wider than tall.
    if (theme.shape === 'circle' || theme.shape === 'diamond') {
      const m = Math.max(w, h);
      w = node.w || m;
      h = node.h || m;
    }
    return { w, h };
  }

  /* ---------- automatic layered layout (Sugiyama-lite) ---------- */
  // For diagrams that opt in via `layout: 'lr' | 'tb'`.
  // - Layer assignment by longest-path from sources (or honour explicit `layer:` hint)
  // - Within-layer ordering by barycenter heuristic (2 sweeps) to reduce crossings
  // - Place each layer as a column (LR) or row (TB), centring the secondary axis
  function autoLayout(diagram) {
    const dir = diagram.layout === 'tb' ? 'tb' : 'lr';
    const isLR = dir === 'lr';
    const nodes = diagram.nodes;
    const edges = diagram.edges || [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // 1. Ensure sizes are computed up-front
    for (const n of nodes) {
      const { w, h } = autoNodeSize(n);
      n._w = w; n._h = h;
    }

    // 2. Build adjacency. First find cycle-creating "back-edges" via DFS
    //    in declaration order, then exclude them from the layering graph so
    //    longest-path doesn't run away. Back-edges are still drawn — they
    //    just don't influence layer assignment.
    const fwdAdj = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) {
      if (nodeMap.has(e.from) && nodeMap.has(e.to)) fwdAdj.get(e.from).push(e.to);
    }
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map(nodes.map(n => [n.id, WHITE]));
    const backEdges = new Set(); // keys: "from|to"
    function dfs(id) {
      color.set(id, GRAY);
      for (const nxt of fwdAdj.get(id)) {
        const c = color.get(nxt);
        if (c === GRAY) backEdges.add(id + '|' + nxt);
        else if (c === WHITE) dfs(nxt);
      }
      color.set(id, BLACK);
    }
    for (const n of nodes) if (color.get(n.id) === WHITE) dfs(n.id);

    const out = new Map(), inc = new Map();
    for (const n of nodes) { out.set(n.id, []); inc.set(n.id, []); }
    for (const e of edges) {
      if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) continue;
      if (backEdges.has(e.from + '|' + e.to)) continue; // skip for layering
      out.get(e.from).push(e.to);
      inc.get(e.to).push(e.from);
    }

    // 3. Longest-path layering. Explicit `layer` hint wins.
    const layer = new Map();
    for (const n of nodes) {
      if (typeof n.layer === 'number') layer.set(n.id, n.layer);
    }
    // Topological-ish iterative relaxation
    let changed = true, guard = 0;
    while (changed && guard++ < 30) {
      changed = false;
      for (const n of nodes) {
        const preds = inc.get(n.id).filter(p => layer.has(p));
        if (preds.length === 0) {
          if (!layer.has(n.id)) { layer.set(n.id, 0); changed = true; }
        } else {
          const maxL = preds.reduce((m, p) => Math.max(m, layer.get(p)), 0);
          if (!layer.has(n.id) || layer.get(n.id) < maxL + 1) {
            // don't override explicit user-set layer
            if (typeof nodeMap.get(n.id).layer !== 'number') {
              layer.set(n.id, maxL + 1);
              changed = true;
            }
          }
        }
      }
    }
    for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, 0);

    // 4. Bucket into layers
    let maxL = 0;
    for (const l of layer.values()) if (l > maxL) maxL = l;
    const layers = Array.from({ length: maxL + 1 }, () => []);
    // Preserve declaration order for initial within-layer ordering — that's
    // already a useful signal from the author.
    for (const n of nodes) layers[layer.get(n.id)].push(n.id);

    // 5. Barycenter ordering — alternate forward and backward sweeps
    function reorder(layerIdx, adjLayerIdx, adjacency) {
      const col = layers[layerIdx];
      if (col.length < 2) return;
      const adj = layers[adjLayerIdx];
      if (!adj || !adj.length) return;
      const adjPos = new Map(adj.map((id, i) => [id, i]));
      const bcs = col.map((id, idx) => {
        const neigh = adjacency.get(id).filter(x => adjPos.has(x));
        if (!neigh.length) return idx; // keep current order for isolated nodes
        return neigh.reduce((s, x) => s + adjPos.get(x), 0) / neigh.length;
      });
      const indexed = col.map((id, i) => ({ id, b: bcs[i], i }));
      indexed.sort((a, b) => a.b - b.b || a.i - b.i);
      layers[layerIdx] = indexed.map(x => x.id);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let l = 1; l <= maxL; l++) reorder(l, l - 1, inc);
      for (let l = maxL - 1; l >= 0; l--) reorder(l, l + 1, out);
    }

    // 6. Per-gap spacing — grow the gap between layers L and L+1 if there
    //    are long edge labels crossing that gap, so labels don't overflow.
    const COL_GAP = 100;
    const ROW_GAP = 36;
    const layerGap = Array(Math.max(0, maxL)).fill(COL_GAP);
    for (const e of edges) {
      if (!e.label) continue;
      const fl = layer.get(e.from), tl = layer.get(e.to);
      if (fl == null || tl == null) continue;
      const minL = Math.min(fl, tl), span = Math.abs(fl - tl);
      if (span !== 1) continue; // back-edges and skips: the label sits on a longer path, plenty of room
      // approx label pill width at 11px Inter + pill padding + stub margins.
      // Use a generous per-char estimate (8 px) and 48 px slack so the label
      // never lands flush against a node edge.
      const labelW = String(e.label).length * 8 + 48;
      if (labelW > layerGap[minL]) layerGap[minL] = Math.ceil(labelW);
    }

    // 7. Position. Each layer is a column (LR) or row (TB). Secondary axis
    //    centres the layer's nodes around 0; primary axis advances cursor.

    let primaryCursor = 0;
    let secondaryMin = Infinity, secondaryMax = -Infinity;
    for (let l = 0; l <= maxL; l++) {
      const col = layers[l];
      const sizes = col.map(id => isLR ? nodeMap.get(id)._h : nodeMap.get(id)._w);
      const totalSecondary = sizes.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, col.length - 1);
      let secondaryCursor = -totalSecondary / 2;
      let layerPrimary = 0;
      col.forEach((id, idx) => {
        const n = nodeMap.get(id);
        if (isLR) {
          n.x = primaryCursor;
          n.y = secondaryCursor;
          layerPrimary = Math.max(layerPrimary, n._w);
        } else {
          n.x = secondaryCursor;
          n.y = primaryCursor;
          layerPrimary = Math.max(layerPrimary, n._h);
        }
        secondaryCursor += sizes[idx] + ROW_GAP;
        secondaryMin = Math.min(secondaryMin, isLR ? n.y : n.x);
        secondaryMax = Math.max(secondaryMax, isLR ? n.y + n._h : n.x + n._w);
      });
      const gap = l < maxL ? layerGap[l] : 0;
      primaryCursor += layerPrimary + gap;
    }
  }

  /* ---------- sequence-diagram layout ----------
   *
   * Triggered by `diagram.layout === 'sequence'`. Treats `nodes` as the
   * row of participants laid out left-to-right at the top, and `edges`
   * as time-ordered messages stacked top-to-bottom below the
   * participants. The renderer also draws a vertical "lifeline" under
   * each participant spanning the entire message column.
   *
   * Layout rules:
   *   - All participants sit at y=0 in declaration order, with a fixed
   *     gap (PARTICIPANT_GAP) between them.
   *   - Each edge gets a _seqY slot: messages stack with MESSAGE_GAP
   *     vertical spacing, starting MESSAGE_TOP below the participant
   *     row.
   *   - The lifeline length is the y of the last message + MESSAGE_TOP.
   *
   * Edges marked `_sequence: true` in this pass are rendered as straight
   * horizontal arrows by drawSequenceEdge() rather than orthogonal
   * polylines. */
  const PARTICIPANT_GAP = 80;
  const MESSAGE_GAP     = 48;
  const MESSAGE_TOP     = 40;

  /* Notes are 56 px tall and need a bit more vertical room than a
   * plain message line; frames extend a margin above the first
   * contained message to fit the label pill. */
  const NOTE_GAP   = 64;
  const FRAME_PAD  = 16;

  function sequenceLayout(diagram) {
    const nodes = diagram.nodes;
    const edges = diagram.edges || [];

    // 1. Size + place participants in a row.
    let cursorX = 0;
    for (const n of nodes) {
      const { w, h } = autoNodeSize(n);
      n._w = w; n._h = h;
      n.x  = cursorX;
      n.y  = 0;
      cursorX += w + PARTICIPANT_GAP;
    }
    const participantBottom = nodes.reduce((m, n) => Math.max(m, n.y + n._h), 0);

    // 2. Stack edges as time-ordered messages. Note items get a wider
    //    slot so the note box doesn't crowd the surrounding arrows.
    let yCursor = participantBottom + MESSAGE_TOP;
    for (const e of edges) {
      e._sequence = true;
      e._seqY = yCursor;
      const slot = (e.kind === 'note' && e.note) ? NOTE_GAP : MESSAGE_GAP;
      yCursor += slot;
    }
    // 3. Lifeline extent.
    diagram._lifelineY1 = participantBottom + 8;
    diagram._lifelineY2 = Math.max(yCursor, participantBottom + MESSAGE_TOP) + 12;
  }

  function drawLifelines(svg, diagram) {
    const y1 = diagram._lifelineY1, y2 = diagram._lifelineY2;
    if (y1 == null || y2 == null) return;
    const g = $('g', { class: 'qa-lifelines' });
    svg.insertBefore(g, svg.firstChild);
    for (const n of diagram.nodes) {
      const cx = n.x + n._w / 2;
      $('line', {
        x1: cx, x2: cx, y1, y2,
        stroke: '#94a3b8', 'stroke-width': '1.2', 'stroke-dasharray': '4 4',
      }, g);
    }
  }

  /* Render a note from a sequence-edge item with `kind: 'note'` and a
   * `note: { position, participants, text }` payload. The note is a
   * yellow rounded rectangle:
   *   - `over A,B` spans from A's lifeline to B's, plus 12 px on each side
   *   - `over A`   spans the width of A's lifeline area
   *   - `left of A`  sits to the left of A's lifeline
   *   - `right of A` sits to the right of A's lifeline
   *
   * If the note payload is missing (older converter output) we fall
   * back to the previous self-loop-arrow rendering — the caller
   * dispatches there. */
  function drawSequenceNote(layer, edge, nodeMap) {
    const note = edge.note || {};
    const ids  = (note.participants || [edge.from]).filter(id => nodeMap.has(id));
    if (!ids.length) return;
    const xs = ids.map(id => {
      const n = nodeMap.get(id);
      return n.x + n._w / 2;
    });
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const text  = (note.text || edge.label || '').replace(/^📝\s*/, '');
    const padX = 14, padY = 8, gap = 12;
    const textW = Math.max(40, text.length * 6.5);
    const textH = 16;
    let x, w;
    if (note.position === 'left' || note.position === 'left of') {
      w = Math.max(textW + padX * 2, 80);
      x = minX - gap - w;
    } else if (note.position === 'right' || note.position === 'right of') {
      w = Math.max(textW + padX * 2, 80);
      x = maxX + gap;
    } else {
      // 'over' — span from leftmost to rightmost lifeline, plus padding
      const span = maxX - minX;
      w = Math.max(span + gap * 2, textW + padX * 2);
      x = (minX + maxX) / 2 - w / 2;
    }
    const h = textH + padY * 2;
    const y = edge._seqY - h / 2;

    const g = $('g', { class: 'qa-seq-note' }, layer);
    $('rect', {
      x, y, width: w, height: h, rx: 4,
      fill: '#fef3c7', stroke: '#a16207', 'stroke-width': '1',
      filter: 'url(#qa-shadow)',
    }, g);
    const t = $('text', {
      x: x + w / 2, y: y + h / 2 + 1,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#78350f', 'font-family': "'Inter', system-ui, sans-serif",
      'font-size': '11', 'font-weight': '500',
    }, g);
    t.textContent = text;
  }

  /* Frame primitive — labeled rectangle wrapping a contiguous block
   * of messages. Used for Mermaid loop / alt / opt / par / critical /
   * break / rect. Each frame has:
   *   { kind, label, startMsgIdx, endMsgIdx, dividers? }
   * The Y range is derived from `edges[startMsgIdx]._seqY` (inclusive)
   * down to `edges[endMsgIdx]._seqY` plus a margin. The X range covers
   * the leftmost-to-rightmost participant touched by any message in
   * the range, plus padding. */
  function drawSequenceFrames(svg, diagram, nodeMap) {
    const frames = diagram.frames || [];
    if (!frames.length) return;
    const edges = diagram.edges || [];
    const g = $('g', { class: 'qa-seq-frames' });
    // Insert behind everything else but in front of lifelines.
    const lifelineG = svg.children.find(c => (c.attrs && (c.attrs.class || '')) === 'qa-lifelines');
    if (lifelineG && lifelineG.parentNode === svg) {
      svg.insertBefore(g, lifelineG);
    } else {
      svg.insertBefore(g, svg.firstChild);
    }
    for (const f of frames) {
      const slice = edges.slice(f.startMsgIdx, f.endMsgIdx + 1);
      if (!slice.length) continue;
      // y range
      const ys = slice.map(e => e._seqY).filter(v => v != null);
      if (!ys.length) continue;
      const yTop = Math.min(...ys) - 28;
      const yBot = Math.max(...ys) + (slice[slice.length - 1] && slice[slice.length - 1].kind === 'note' ? 36 : 20);
      // x range — touch every participant referenced by any message in the slice
      const ids = new Set();
      for (const e of slice) {
        if (e.from && nodeMap.has(e.from)) ids.add(e.from);
        if (e.to   && nodeMap.has(e.to))   ids.add(e.to);
        if (e.note && e.note.participants) for (const p of e.note.participants) if (nodeMap.has(p)) ids.add(p);
      }
      if (!ids.size) continue;
      const xs = Array.from(ids).map(id => {
        const n = nodeMap.get(id);
        return [n.x, n.x + n._w];
      });
      const xL = Math.min(...xs.map(p => p[0])) - FRAME_PAD;
      const xR = Math.max(...xs.map(p => p[1])) + FRAME_PAD;
      const fg = $('g', { class: 'qa-seq-frame qa-seq-frame-' + f.kind }, g);
      $('rect', {
        x: xL, y: yTop, width: xR - xL, height: yBot - yTop, rx: 6,
        fill: 'none', stroke: '#64748b', 'stroke-width': '1.2',
        'stroke-dasharray': f.kind === 'opt' ? '4 3' : null,
      }, fg);
      // Label pill in the top-left corner
      const labelText = (f.kind === 'rect' ? '' : f.kind) + (f.label ? ' ' + f.label : '');
      if (labelText.trim()) {
        const labelW = Math.max(40, labelText.trim().length * 6.5 + 18);
        $('rect', {
          x: xL, y: yTop, width: labelW, height: 18, rx: 0,
          fill: '#475569', stroke: 'none',
        }, fg);
        const t = $('text', {
          x: xL + labelW / 2, y: yTop + 9 + 1,
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          fill: '#ffffff', 'font-family': "'Inter', system-ui, sans-serif",
          'font-size': '10', 'font-weight': '700',
          'text-transform': 'uppercase', 'letter-spacing': '0.05em',
        }, fg);
        t.textContent = labelText.trim();
      }
      // Dividers (for alt/par): horizontal line at each divider index
      if (f.dividers && f.dividers.length) {
        for (const d of f.dividers) {
          const dEdge = edges[d.idx];
          if (!dEdge || dEdge._seqY == null) continue;
          const dy = dEdge._seqY - 14;
          $('line', {
            x1: xL, x2: xR, y1: dy, y2: dy,
            stroke: '#94a3b8', 'stroke-width': '1', 'stroke-dasharray': '4 4',
          }, fg);
          if (d.label) {
            $('text', {
              x: xL + 8, y: dy - 4,
              'font-family': "'Inter', system-ui, sans-serif", 'font-size': '10',
              'font-weight': '600', fill: '#475569',
            }, fg).textContent = '[' + d.label + ']';
          }
        }
      }
    }
  }

  function drawSequenceEdge(layer, edge, nodeMap) {
    // Dispatch to the note renderer when the converter has emitted
    // proper note metadata. Edges without `note` fall through to the
    // legacy self-loop-arrow rendering for backward compatibility.
    if (edge.kind === 'note' && edge.note) {
      drawSequenceNote(layer, edge, nodeMap);
      return;
    }
    const a = nodeMap.get(edge.from), b = nodeMap.get(edge.to);
    if (!a || !b) return;
    const ax = a.x + a._w / 2;
    const bx = b.x + b._w / 2;
    const y  = edge._seqY;

    // Self-message: render as a small right-going loop on the same lifeline.
    if (a === b) {
      const loopW = 60;
      const d = `M ${ax} ${y} h ${loopW} v ${MESSAGE_GAP * 0.6} h ${-loopW}`;
      const g = $('g', { class: 'qa-edge qa-seq-edge' }, layer);
      const style = edge.style || 'solid';
      const dash = style === 'dashed' ? '6 5' : style === 'dotted' ? '2 4' : null;
      $('path', {
        d, fill: 'none', stroke: edge.color || '#475569', 'stroke-width': 1.8,
        'stroke-dasharray': dash, 'stroke-linecap': 'round',
        'marker-end': arrowMarker(edge.toArrow || 'arrow') || 'url(#qa-arrow)',
      }, g);
      if (edge.label) {
        const t = $('text', {
          x: ax + loopW + 6, y: y + MESSAGE_GAP * 0.3,
          'dominant-baseline': 'middle', fill: '#0f172a',
          'font-family': "'Inter', system-ui, sans-serif", 'font-size': '11',
        }, g);
        t.textContent = edge.label;
      }
      return;
    }

    const g = $('g', { class: 'qa-edge qa-seq-edge' }, layer);
    const style = edge.style || 'solid';
    const dash = style === 'dashed' ? '6 5' : style === 'dotted' ? '2 4' : null;
    $('path', {
      d: `M ${ax} ${y} L ${bx} ${y}`,
      fill: 'none', stroke: edge.color || '#475569', 'stroke-width': 1.8,
      'stroke-dasharray': dash, 'stroke-linecap': 'round',
      'marker-end': arrowMarker(edge.toArrow || 'arrow') || 'url(#qa-arrow)',
    }, g);
    if (edge.label) {
      const mx = (ax + bx) / 2;
      const txt = $('text', {
        x: mx, y: y - 6, 'text-anchor': 'middle',
        fill: '#0f172a', 'font-family': "'Inter', system-ui, sans-serif",
        'font-size': '11', 'font-weight': '500',
      }, g);
      txt.textContent = edge.label;
      const bbox = txt.getBBox();
      const pad = 6;
      const bg = $('rect', {
        x: bbox.x - pad, y: bbox.y - 3, width: bbox.width + pad * 2, height: bbox.height + 6,
        rx: 7, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1,
      });
      g.insertBefore(bg, txt);
    }
  }

  /* ---------- node rendering ---------- */
  function drawNode(svg, defs, node) {
    const theme = THEMES[node.kind] || THEMES.plain;
    const w = node._w, h = node._h;
    const ink = textColorFor(theme);                 // foreground (label, icon, sub)
    const isLight = ink === '#1e293b';
    // semi-transparent counterpart for decoration strokes and badge surfaces
    const onLightHi  = 'rgba(15,23,42,0.62)';        // dark wash for light bg
    const onDarkHi   = 'rgba(255,255,255,0.85)';     // white wash for dark bg
    const decorStroke = isLight ? onLightHi : '#ffffff';
    const badgeFill   = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.25)';
    const badgeStroke = isLight ? 'rgba(15,23,42,0.25)' : 'rgba(255,255,255,0.45)';

    const g = $('g', { class: 'qa-node', transform: `translate(${node.x},${node.y})`, 'data-id': node.id }, svg);
    const gradId = ensureGradient(defs, theme);
    const shapeFn = SHAPES[theme.shape] || SHAPES.rect;
    const out = shapeFn(w, h);
    const body = typeof out === 'string' ? out : out.body;
    const decoration = typeof out === 'string' ? null : out.decoration;
    const back = typeof out === 'string' ? null : out.back;

    if (back) {
      $('path', { d: back, fill: '#ffffff', stroke: theme.border, 'stroke-width': 1, 'stroke-opacity': 0.65 }, g);
    }
    $('path', {
      d: body, fill: `url(#${gradId})`, stroke: theme.border, 'stroke-width': 1.5,
      'stroke-dasharray': theme.dashed ? '5 4' : null, filter: 'url(#qa-shadow)',
    }, g);
    if (decoration) {
      $('path', {
        d: decoration, fill: 'none', stroke: decorStroke,
        'stroke-width': 1.2, 'stroke-opacity': isLight ? 1 : 0.7,
        'stroke-linecap': 'round',
      }, g);
    }

    const hasIcon = theme.icon && ICONS[theme.icon];
    const textX = w / 2 + (hasIcon ? 8 : 0);

    if (hasIcon) {
      const ig = $('g', { transform: `translate(16, ${h / 2})`, opacity: '0.9' }, g);
      $('path', {
        d: ICONS[theme.icon], fill: 'none', stroke: ink,
        'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, ig);
    }

    const t = $('text', {
      x: textX, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: ink, 'font-family': "'Inter', system-ui, sans-serif",
      'font-size': '13', 'font-weight': '600', 'pointer-events': 'none',
    }, g);

    if (node.sub) {
      $('tspan', { x: textX, dy: '-0.5em' }, t).textContent = node.label || '';
      $('tspan', { x: textX, dy: '1.4em', 'font-size': '11', 'font-weight': '400', 'fill-opacity': '0.88' }, t)
        .textContent = node.sub;
    } else {
      t.textContent = node.label || '';
    }

    if (node.badge) {
      const bg = $('g', { transform: `translate(${w - 8}, 8)` }, g);
      const bw = Math.max(22, node.badge.length * 7 + 10);
      $('rect', {
        x: -bw, y: -6, width: bw, height: 16, rx: 8,
        fill: badgeFill, stroke: badgeStroke,
      }, bg);
      $('text', {
        x: -bw / 2, y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: ink, 'font-size': '10', 'font-weight': '700',
        'font-family': "'Inter', system-ui, sans-serif",
      }, bg).textContent = node.badge;
    }
  }

  /* ---------- UML class box ---------- */
  function drawClassNode(svg, defs, node) {
    const theme = THEMES.class;
    const w = node._w, h = node._h;
    const headH = 30;
    const lineH = 18;
    const padY = 8;
    const attrs = node.attrs || [];
    const meths = node.methods || [];

    const g = $('g', { class: 'qa-node qa-class', transform: `translate(${node.x},${node.y})`, 'data-id': node.id }, svg);
    const gradId = ensureGradient(defs, theme);

    $('path', { d: SHAPES.rect(w, h, 8), fill: '#ffffff', stroke: theme.border, 'stroke-width': 1.5, filter: 'url(#qa-shadow)' }, g);
    $('path', { d: `M 8 0 H ${w - 8} A 8 8 0 0 1 ${w} 8 V ${headH} H 0 V 8 A 8 8 0 0 1 8 0 Z`, fill: `url(#${gradId})` }, g);
    $('text', {
      x: w / 2, y: headH / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#fff', 'font-size': '13', 'font-weight': '700',
      'font-family': "'Inter', system-ui, sans-serif",
    }, g).textContent = node.label;

    let yCur = headH + padY + 4;
    const drawList = items => {
      for (const it of items) {
        $('text', {
          x: 12, y: yCur, 'dominant-baseline': 'hanging', fill: '#1e293b',
          'font-size': '12', 'font-family': "'JetBrains Mono', 'SF Mono', Menlo, monospace",
        }, g).textContent = it;
        yCur += lineH;
      }
    };
    drawList(attrs);
    if (attrs.length && meths.length) {
      $('line', { x1: 0, x2: w, y1: yCur - 4, y2: yCur - 4, stroke: theme.border, 'stroke-opacity': 0.4 }, g);
      yCur += 4;
    }
    drawList(meths);
  }

  /* ---------- edge geometry ---------- */
  /* For a node, return the point where an edge attached to `side`
   * with a perpendicular `offset` from the side midpoint actually
   * meets the node's VISIBLE shape.
   *
   * Rectangles, stadiums, cylinders, hexagons, parallelograms,
   * trapezoids: the bbox edge IS the visible perimeter at all offsets.
   *
   * Diamonds: the visible perimeter is 4 line segments inscribed in
   * the bbox. As you walk along a bbox side away from the tip, the
   * diamond's surface tapers diagonally inward — for a square diamond,
   * y = h - |offset| on the bottom side, etc. Without this projection
   * fan-out offsets place the arrow exit far outside the visible shape.
   *
   * Circles / dots: project the bbox-edge point radially onto the
   * inscribed circle. The exit is at the circle perimeter on the ray
   * from the node centre through the would-be bbox point. */
  function sidePoint(n, side, offset = 0) {
    const cx = n.x + n._w / 2, cy = n.y + n._h / 2;
    const w = n._w, h = n._h;
    const theme = THEMES[n.kind] || THEMES.plain;
    const shape = theme.shape;
    const o = offset || 0;

    if (shape === 'diamond') {
      const ao = Math.abs(o);
      switch (side) {
        case 'top':    return [cx + o, n.y         + ao];
        case 'bottom': return [cx + o, n.y + h     - ao];
        case 'left':   return [n.x         + ao,   cy + o];
        case 'right':  return [n.x + w     - ao,   cy + o];
      }
    }

    if (shape === 'circle' || shape === 'dot' || shape === 'doubleDot') {
      const r = Math.min(w, h) / 2;
      // Direction from centre to the would-be bbox point.
      let dx, dy;
      switch (side) {
        case 'top':    dx = o;        dy = -h / 2; break;
        case 'bottom': dx = o;        dy =  h / 2; break;
        case 'left':   dx = -w / 2;   dy = o;      break;
        case 'right':  dx =  w / 2;   dy = o;      break;
      }
      const d = Math.hypot(dx, dy) || 1;
      return [cx + dx * r / d, cy + dy * r / d];
    }

    switch (side) {
      case 'right':  return [n.x + n._w, cy + o];
      case 'left':   return [n.x,        cy + o];
      case 'top':    return [cx + o, n.y];
      case 'bottom': return [cx + o, n.y + n._h];
    }
  }
  function autoSides(a, b) {
    const dx = (b.x + b._w / 2) - (a.x + a._w / 2);
    const dy = (b.y + b._h / 2) - (a.y + a._h / 2);
    if (Math.abs(dx) >= Math.abs(dy)) {
      return [dx > 0 ? 'right' : 'left', dx > 0 ? 'left' : 'right'];
    }
    return [dy > 0 ? 'bottom' : 'top', dy > 0 ? 'top' : 'bottom'];
  }

  /* ---------- edge fan-out: when many edges share a (node, side),
                distribute their exit points along that side so they don't
                stack on top of each other. ---------- */
  function planEdgeOffsets(edges, nodeMap) {
    // Step 1: pick sides per edge (auto or explicit), record on the edge object
    for (const e of edges) {
      const a = nodeMap.get(e.from), b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const [autoFs, autoTs] = autoSides(a, b);
      e._fs = e.fromSide || autoFs;
      e._ts = e.toSide   || autoTs;
    }
    // Step 2: group by (node, side, endpoint role)
    const groups = new Map(); // key: 'nodeId|side|role' (role: 'from' or 'to')
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (!e._fs || !e._ts) continue;
      const a = nodeMap.get(e.from), b = nodeMap.get(e.to);
      const keyA = `${e.from}|${e._fs}|from`;
      const keyB = `${e.to}|${e._ts}|to`;
      if (!groups.has(keyA)) groups.set(keyA, []);
      if (!groups.has(keyB)) groups.set(keyB, []);
      groups.get(keyA).push({ idx: i, other: b });
      groups.get(keyB).push({ idx: i, other: a });
    }
    // Step 3: for each group with >1 edges, fan them out
    for (const [key, items] of groups) {
      if (items.length < 2) continue;
      const [nodeId, side, role] = key.split('|');
      const n = nodeMap.get(nodeId);
      const sideLen = (side === 'left' || side === 'right') ? n._h : n._w;
      const usable = Math.max(20, sideLen - 24); // leave 12px margin each end
      // sort items by the perpendicular coordinate of the OTHER endpoint, so
      // edges don't cross at the fan-out
      items.sort((a, b) => {
        const perp = m => (side === 'left' || side === 'right')
          ? m.y + m._h / 2
          : m.x + m._w / 2;
        return perp(a.other) - perp(b.other);
      });
      const step = usable / (items.length - 1 || 1);
      items.forEach((it, idx) => {
        const off = items.length === 1 ? 0 : -usable / 2 + step * idx;
        const e = edges[it.idx];
        const fld = role === 'from' ? '_fromOff' : '_toOff';
        // user-set explicit offset wins
        const userOff = role === 'from' ? e.fromOffset : e.toOffset;
        e[fld] = userOff != null ? userOff : off;
      });
    }

    /* PASS 2 — fan out edges that connect the SAME pair of nodes
     * (in either direction). This catches the back-edge case (A→B
     * plus B→A) which the previous pass misses because it groups by
     * (node, side, role) and the two edges have different roles on
     * each endpoint, putting them in singleton groups.
     *
     * Each multi-edge group between the same two nodes is given
     * symmetric perpendicular offsets so the paths run in parallel
     * corridors rather than on top of each other. */
    const pairKey = new Map();   // 'minId|maxId' -> [edge indices]
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) continue;
      const k = e.from < e.to ? e.from + '|' + e.to : e.to + '|' + e.from;
      if (!pairKey.has(k)) pairKey.set(k, []);
      pairKey.get(k).push(i);
    }
    const pairStep = 14;          // px between parallel corridors
    for (const idxs of pairKey.values()) {
      if (idxs.length < 2) continue;
      idxs.forEach((idx, i) => {
        const e = edges[idx];
        const off = (i - (idxs.length - 1) / 2) * pairStep;
        // don't override what pass 1 (or the user) already set
        if (e._fromOff == null && e.fromOffset == null) e._fromOff = off;
        if (e._toOff   == null && e.toOffset   == null) e._toOff   = off;
      });
    }
  }

  /* Find nodes that obstruct the rectangular routing band between two
   * points, excluding the source and target nodes themselves. Returns
   * the obstacles' y-span so the caller can detour above or below. */
  function findRoutingObstacles(p1, p2, nodeMap, source, target) {
    if (!nodeMap) return null;
    const xMin = Math.min(p1[0], p2[0]);
    const xMax = Math.max(p1[0], p2[0]);
    const yMin = Math.min(p1[1], p2[1]);
    const yMax = Math.max(p1[1], p2[1]);
    let topY = Infinity, botY = -Infinity, count = 0;
    for (const n of nodeMap.values()) {
      if (n === source || n === target) continue;
      // overlap on X (with a small slack so a node that's exactly at
      // the band edge isn't counted)
      if (n.x + n._w <= xMin + 1 || n.x >= xMax - 1) continue;
      // node's y-band must intersect the routing band (with margin)
      const margin = 4;
      if (n.y + n._h <= yMin - margin) continue;
      if (n.y         >= yMax + margin) continue;
      topY = Math.min(topY, n.y);
      botY = Math.max(botY, n.y + n._h);
      count++;
    }
    return count ? { topY, botY, count } : null;
  }

  function buildPolyline(p1, s1, p2, s2, ctx) {
    const [x1, y1] = p1, [x2, y2] = p2;
    const stub = 18;
    const ex = s => s === 'right' ? [x1 + stub, y1] : s === 'left' ? [x1 - stub, y1] : s === 'bottom' ? [x1, y1 + stub] : [x1, y1 - stub];
    const en = s => s === 'right' ? [x2 + stub, y2] : s === 'left' ? [x2 - stub, y2] : s === 'bottom' ? [x2, y2 + stub] : [x2, y2 - stub];
    const a = ex(s1), b = en(s2);
    const horiz1 = s1 === 'left' || s1 === 'right';
    const horiz2 = s2 === 'left' || s2 === 'right';

    /* Obstacle-aware routing for horizontal-to-horizontal edges. The
     * default mid-X bend produces a STRAIGHT horizontal line whenever
     * source and target lie at the same y, which then plows through
     * any nodes sitting in the columns between them. Detect that case
     * and detour over or under the obstacles. */
    if (horiz1 && horiz2 && ctx && ctx.nodeMap) {
      const obs = findRoutingObstacles(a, b, ctx.nodeMap, ctx.source, ctx.target);
      if (obs) {
        const margin = 22;
        const ay = a[1], by = b[1];
        const detourUp   = Math.min(ay, by) - (obs.topY - margin);  // dist to climb over the top
        const detourDown = (obs.botY + margin) - Math.max(ay, by);  // dist to dip under the bottom
        const detourY = detourUp <= detourDown
          ? obs.topY - margin     // route over
          : obs.botY + margin;    // route under
        return [
          [x1, y1],
          a,
          [a[0], detourY],
          [b[0], detourY],
          b,
          [x2, y2],
        ];
      }
    }

    const out = [[x1, y1]];
    out.push(a);
    if (horiz1 && horiz2) {
      const midX = (a[0] + b[0]) / 2;
      out.push([midX, a[1]], [midX, b[1]]);
    } else if (!horiz1 && !horiz2) {
      const midY = (a[1] + b[1]) / 2;
      out.push([a[0], midY], [b[0], midY]);
    } else if (horiz1 && !horiz2) {
      out.push([b[0], a[1]]);
    } else {
      out.push([a[0], b[1]]);
    }
    out.push(b);
    out.push([x2, y2]);
    return out;
  }

  function smoothPath(pts, r = 8) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const len1 = Math.hypot(x1 - x0, y1 - y0);
      const len2 = Math.hypot(x2 - x1, y2 - y1);
      const rr = Math.max(2, Math.min(r, len1 / 2, len2 / 2));
      const t1 = [x1 - (x1 - x0) / (len1 || 1) * rr, y1 - (y1 - y0) / (len1 || 1) * rr];
      const t2 = [x1 + (x2 - x1) / (len2 || 1) * rr, y1 + (y2 - y1) / (len2 || 1) * rr];
      d += ` L ${t1[0]} ${t1[1]} Q ${x1} ${y1} ${t2[0]} ${t2[1]}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last[0]} ${last[1]}`;
    return d;
  }

  // place a point along the polyline at fraction t (0..1) of the total length
  function pointAtFraction(pts, t) {
    let total = 0;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(total);
    }
    const target = total * t;
    for (let i = 1; i < pts.length; i++) {
      if (lens[i] >= target) {
        const seg = lens[i] - lens[i - 1];
        const u = seg === 0 ? 0 : (target - lens[i - 1]) / seg;
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u,
        ];
      }
    }
    return pts[pts.length - 1];
  }

  /* ---------- groups ---------- */
  function drawCluster(layer, group, nodeMap) {
    const ids = group.nodes || [];
    if (!ids.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const n = nodeMap.get(id);
      if (!n) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n._w);
      maxY = Math.max(maxY, n.y + n._h);
    }
    const pad = 22;
    const x = minX - pad, y = minY - pad - 14;
    const w = (maxX - minX) + pad * 2;
    const h = (maxY - minY) + pad * 2 + 14;
    const g = $('g', { class: 'qa-group' }, layer);
    $('rect', {
      x, y, width: w, height: h, rx: 14,
      fill: group.fill || '#f8fafc', stroke: group.stroke || '#cbd5e1',
      'stroke-width': 1.5, 'stroke-dasharray': group.dash === false ? null : '5 4', opacity: 0.95,
    }, g);
    if (group.label) {
      $('text', {
        x: x + 16, y: y + 18,
        'font-family': "'Inter', system-ui, sans-serif", 'font-size': '11',
        'font-weight': '700', fill: group.labelColor || '#475569',
        'letter-spacing': '0.05em', 'text-transform': 'uppercase',
      }, g).textContent = group.label;
    }
  }

  /* ---------- edges ---------- */
  function drawEdge(layer, edge, nodeMap) {
    const a = nodeMap.get(edge.from), b = nodeMap.get(edge.to);
    if (!a || !b) return;
    const fs = edge._fs || edge.fromSide || 'right';
    const ts = edge._ts || edge.toSide   || 'left';
    const fromOff = edge._fromOff != null ? edge._fromOff : (edge.fromOffset || 0);
    const toOff   = edge._toOff   != null ? edge._toOff   : (edge.toOffset   || 0);
    const p1 = sidePoint(a, fs, fromOff);
    const p2 = sidePoint(b, ts, toOff);
    const pts = buildPolyline(p1, fs, p2, ts, { nodeMap, source: a, target: b });
    const d = smoothPath(pts, 10);

    const g = $('g', { class: 'qa-edge' }, layer);
    const style = edge.style || 'solid';
    const dash = style === 'dashed' ? '6 5' : style === 'dotted' ? '2 4' : null;

    // Pick markers. `toArrow` / `fromArrow` (added v0.4) override the
    // legacy `endArrow` / `bidir` flags. The defaults preserve
    // pre-v0.4 behaviour: solid arrow at the destination, none at the
    // source unless `bidir` is set.
    let endMarker, startMarker;
    if (edge.toArrow !== undefined) {
      endMarker = arrowMarker(edge.toArrow);
    } else {
      endMarker = edge.endArrow === false ? null : 'url(#qa-arrow)';
    }
    if (edge.fromArrow !== undefined) {
      startMarker = arrowMarker(edge.fromArrow);
    } else {
      startMarker = edge.bidir ? 'url(#qa-arrow)' : null;
    }
    $('path', {
      d, fill: 'none', stroke: edge.color || '#475569', 'stroke-width': 1.8,
      'stroke-dasharray': dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'marker-end':   endMarker,
      'marker-start': startMarker,
    }, g);

    if (edge.label) {
      const [mx, my] = pointAtFraction(pts, 0.5);
      const txt = $('text', {
        x: mx, y: my, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': "'Inter', system-ui, sans-serif", 'font-size': '11',
        'font-weight': '500', fill: '#0f172a', 'pointer-events': 'none',
      }, g);
      txt.textContent = edge.label;
      const bbox = txt.getBBox();
      const pad = 6;
      const bg = $('rect', {
        x: bbox.x - pad, y: bbox.y - 3, width: bbox.width + pad * 2, height: bbox.height + 6,
        rx: 7, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1,
      });
      g.insertBefore(bg, txt);
    }
  }

  /* ---------- render entry ---------- */
  function render(container, diagram) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) throw new Error('Quickagram: container not found');
    container.innerHTML = '';

    // ensure _w/_h set on every node — even in manual mode
    for (const n of diagram.nodes) {
      const { w, h } = autoNodeSize(n);
      n._w = w; n._h = h;
    }

    // Auto-layout when requested. We treat "no node has x or y" as also
    // implying auto-layout to make the format ergonomic. Sequence
    // diagrams use a completely different layout function.
    if (diagram.layout === 'sequence') {
      sequenceLayout(diagram);
    } else {
      const wantsAuto = diagram.layout || diagram.nodes.every(n => n.x == null && n.y == null);
      if (wantsAuto) {
        if (!diagram.layout) diagram.layout = 'lr';
        autoLayout(diagram);
      }
    }

    // Compute viewBox bounds
    const padding = diagram.padding != null ? diagram.padding : 40;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of diagram.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n._w);
      maxY = Math.max(maxY, n.y + n._h);
    }
    // In sequence layout the lifelines + messages extend well below the
    // participant row; include the lifeline extent in the bbox.
    if (diagram.layout === 'sequence' && diagram._lifelineY2 != null) {
      maxY = Math.max(maxY, diagram._lifelineY2);
    }
    const vbW = (maxX - minX) + padding * 2;
    const vbH = (maxY - minY) + padding * 2;

    const svg = $('svg', {
      xmlns: NS, viewBox: `${minX - padding} ${minY - padding} ${vbW} ${vbH}`,
      class: 'qa-svg', preserveAspectRatio: 'xMidYMid meet',
    });
    svg.style.width = '100%';
    svg.style.height = 'auto';
    if (diagram.maxHeight !== false) svg.style.maxHeight = diagram.maxHeight || '78vh';
    container.appendChild(svg);

    const defs = ensureDefs(svg);

    const nodeMap = new Map();
    for (const n of diagram.nodes) {
      nodeMap.set(n.id, n);
      if (n.kind === 'class') drawClassNode(svg, defs, n);
      else drawNode(svg, defs, n);
    }

    // Pre-plan edge offsets for fan-out before drawing — except for
    // sequence diagrams, which use straight horizontal arrows and
    // don't need orthogonal routing.
    if (diagram.edges && diagram.layout !== 'sequence') planEdgeOffsets(diagram.edges, nodeMap);

    const firstNode = svg.querySelector('.qa-node');
    if (diagram.groups && diagram.groups.length) {
      const gLayer = $('g', { class: 'qa-groups' });
      svg.insertBefore(gLayer, firstNode);
      for (const grp of diagram.groups) drawCluster(gLayer, grp, nodeMap);
    }
    if (diagram.layout === 'sequence') {
      drawLifelines(svg, diagram);
      // Frame rectangles sit BEHIND messages and notes but above the
      // lifelines (insertion order handled inside drawSequenceFrames).
      drawSequenceFrames(svg, diagram, nodeMap);
    }
    const eLayer = $('g', { class: 'qa-edges' });
    svg.insertBefore(eLayer, firstNode);
    for (const e of (diagram.edges || [])) {
      if (e._sequence) drawSequenceEdge(eLayer, e, nodeMap);
      else             drawEdge(eLayer, e, nodeMap);
    }

    return svg;
  }

  /* ========================================================================
   *  Syntax highlighting
   *  -------------------------------------------------------------------
   *  Quickagram.highlight(code, language) → HTML string with token spans.
   *  Each token is wrapped in a <span class="qa-tok qa-tok-<type>">; pair
   *  with one of the bundled themes via `installTheme(name)` or by writing
   *  your own CSS targeting `.qa-tok-*`.
   *
   *  Built-in languages:  python | javascript | js | sql | text
   *  Built-in themes:     dracula | nord | github-light
   * ====================================================================== */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const LANGUAGES = {
    python: {
      lineComment: '#',
      strings: [`"""`, `'''`, `"`, `'`],
      keywords: ['def','class','if','else','elif','for','while','in','not','and','or','True','False','None','return','import','from','as','with','try','except','finally','raise','yield','lambda','pass','break','continue','global','nonlocal','assert','del','is','async','await','self','super','cls'],
      builtins: ['print','len','range','int','str','float','list','dict','set','tuple','bool','type','isinstance','enumerate','zip','map','filter','sum','min','max','abs','open','sorted','reversed','any','all','iter','next','hasattr','getattr','setattr','property','staticmethod','classmethod','repr','format','round','divmod','sys','os','re','collections','deque','defaultdict','OrderedDict','Counter','heapq','itertools','functools','json','time','datetime','math','random','abstractmethod','ABCMeta','Enum'],
    },
    javascript: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
      strings: ['`', '"', "'"],
      keywords: ['var','let','const','function','return','if','else','for','while','do','switch','case','break','continue','default','class','extends','new','this','super','import','export','from','as','default','try','catch','finally','throw','typeof','instanceof','in','of','delete','void','null','undefined','true','false','async','await','yield','static','get','set'],
      builtins: ['console','log','warn','error','document','window','globalThis','Math','Date','JSON','Object','Array','String','Number','Boolean','Map','Set','WeakMap','WeakSet','Promise','Symbol','Error','TypeError','RangeError','RegExp','parseInt','parseFloat','isNaN','isFinite','encodeURI','decodeURI','encodeURIComponent','decodeURIComponent','setTimeout','setInterval','clearTimeout','clearInterval','fetch','require','module','exports'],
    },
    sql: {
      lineComment: '--',
      blockComment: ['/*', '*/'],
      strings: [`'`, `"`],
      caseInsensitive: true,
      keywords: ['SELECT','FROM','WHERE','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','JOIN','INNER','OUTER','LEFT','RIGHT','FULL','ON','AS','AND','OR','NOT','IN','BETWEEN','LIKE','IS','NULL','DISTINCT','UNION','ALL','CREATE','TABLE','PRIMARY','KEY','FOREIGN','INDEX','UNIQUE','CONSTRAINT','REFERENCES','DEFAULT','INSERT','INTO','VALUES','UPDATE','SET','DELETE','DROP','ALTER','ADD','COLUMN','RENAME','TRUNCATE','BEGIN','COMMIT','ROLLBACK','TRANSACTION','IF','EXISTS','CASE','WHEN','THEN','ELSE','END','WITH','RETURNING','GRANT','REVOKE'],
      types: ['INT','INTEGER','BIGINT','SMALLINT','VARCHAR','CHAR','TEXT','BLOB','BYTEA','DATE','DATETIME','TIMESTAMP','TIME','BOOLEAN','BOOL','DECIMAL','NUMERIC','FLOAT','DOUBLE','REAL','JSON','JSONB','UUID','SERIAL','BIGSERIAL'],
    },
    text: {},
  };
  LANGUAGES.js = LANGUAGES.javascript;
  LANGUAGES.py = LANGUAGES.python;

  function tokenize(code, lang) {
    const out = [];
    const n = code.length;
    let i = 0;
    const sortedStrs = lang.strings ? [...lang.strings].sort((a, b) => b.length - a.length) : null;
    const kwSet = lang.keywords ? new Set(lang.caseInsensitive ? lang.keywords.map(k => k.toUpperCase()) : lang.keywords) : null;
    const typeSet = lang.types ? new Set(lang.caseInsensitive ? lang.types.map(t => t.toUpperCase()) : lang.types) : null;
    const builtinSet = lang.builtins ? new Set(lang.builtins) : null;

    while (i < n) {
      const ch = code[i];

      // whitespace
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        let j = i;
        while (j < n && (code[j] === ' ' || code[j] === '\t' || code[j] === '\n' || code[j] === '\r')) j++;
        out.push({ t: 'ws', v: code.slice(i, j) });
        i = j;
        continue;
      }

      // line comment
      if (lang.lineComment && code.startsWith(lang.lineComment, i)) {
        let j = i;
        while (j < n && code[j] !== '\n') j++;
        out.push({ t: 'comment', v: code.slice(i, j) });
        i = j;
        continue;
      }

      // block comment
      if (lang.blockComment && code.startsWith(lang.blockComment[0], i)) {
        const end = code.indexOf(lang.blockComment[1], i + lang.blockComment[0].length);
        const j = end === -1 ? n : end + lang.blockComment[1].length;
        out.push({ t: 'comment', v: code.slice(i, j) });
        i = j;
        continue;
      }

      // string (longest delimiter first → "" before " in JS, """ before " in Py)
      if (sortedStrs) {
        let q = null;
        for (const s of sortedStrs) {
          if (code.startsWith(s, i)) { q = s; break; }
        }
        if (q) {
          const start = i;
          i += q.length;
          while (i < n) {
            if (code[i] === '\\' && i + 1 < n) { i += 2; continue; }
            if (code.startsWith(q, i)) { i += q.length; break; }
            if (code[i] === '\n' && q.length === 1) break; // unterminated single-line string
            i++;
          }
          out.push({ t: 'string', v: code.slice(start, i) });
          continue;
        }
      }

      // number (int, float, hex, scientific)
      if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < n && code[i + 1] >= '0' && code[i + 1] <= '9')) {
        let j = i;
        // hex
        if (ch === '0' && i + 1 < n && (code[i + 1] === 'x' || code[i + 1] === 'X')) {
          j = i + 2;
          while (j < n && /[0-9a-fA-F_]/.test(code[j])) j++;
        } else {
          while (j < n && /[0-9._]/.test(code[j])) j++;
          if (j < n && (code[j] === 'e' || code[j] === 'E')) {
            j++;
            if (j < n && (code[j] === '+' || code[j] === '-')) j++;
            while (j < n && /[0-9]/.test(code[j])) j++;
          }
        }
        out.push({ t: 'number', v: code.slice(i, j) });
        i = j;
        continue;
      }

      // identifier / keyword / type / builtin / class / function
      if (/[a-zA-Z_$]/.test(ch)) {
        let j = i;
        while (j < n && /[a-zA-Z0-9_$]/.test(code[j])) j++;
        const word = code.slice(i, j);
        const cmp = lang.caseInsensitive ? word.toUpperCase() : word;
        let type = 'ident';
        if (kwSet && kwSet.has(cmp)) type = 'keyword';
        else if (typeSet && typeSet.has(cmp)) type = 'type';
        else if (builtinSet && builtinSet.has(word)) type = 'builtin';
        else if (/^[A-Z]/.test(word)) type = 'class';
        else if (j < n && code[j] === '(') type = 'function';
        out.push({ t: type, v: word });
        i = j;
        continue;
      }

      // decorator (Python) / attribute (JS) — keep '@' as its own punct
      if (ch === '@') {
        out.push({ t: 'decorator', v: '@' });
        i++;
        continue;
      }

      // multi-char operator
      if (/[+\-*/%=<>!&|^~?]/.test(ch)) {
        let j = i;
        while (j < n && /[+\-*/%=<>!&|^~?]/.test(code[j])) j++;
        out.push({ t: 'operator', v: code.slice(i, j) });
        i = j;
        continue;
      }

      // single-char punct
      if (/[(){}\[\];,.:]/.test(ch)) {
        out.push({ t: 'punct', v: ch });
        i++;
        continue;
      }

      // fallback
      out.push({ t: 'ident', v: ch });
      i++;
    }

    return out;
  }

  function highlight(code, opts) {
    const langName = typeof opts === 'string' ? opts : (opts && opts.language) || 'text';
    const lang = LANGUAGES[langName] || LANGUAGES.text;
    if (!lang.keywords && !lang.strings && !lang.lineComment) {
      // unknown / text → just escape
      return escapeHtml(code);
    }
    const tokens = tokenize(code, lang);
    let out = '';
    for (const tok of tokens) {
      if (tok.t === 'ws') { out += escapeHtml(tok.v); continue; }
      out += '<span class="qa-tok qa-tok-' + tok.t + '">' + escapeHtml(tok.v) + '</span>';
    }
    return out;
  }

  /* ---------- bundled themes — CSS strings ---------- */
  const CODE_THEMES = {
    dracula: [
      '.qa-code{background:#282a36;color:#f8f8f2;font-family:"JetBrains Mono","SF Mono",Menlo,monospace;font-size:12.5px;line-height:1.55;padding:14px 18px;border-radius:10px;overflow-x:auto;white-space:pre}',
      '.qa-code .qa-tok-comment{color:#6272a4;font-style:italic}',
      '.qa-code .qa-tok-keyword{color:#ff79c6;font-weight:600}',
      '.qa-code .qa-tok-string {color:#f1fa8c}',
      '.qa-code .qa-tok-number {color:#bd93f9}',
      '.qa-code .qa-tok-builtin{color:#8be9fd;font-style:italic}',
      '.qa-code .qa-tok-class  {color:#50fa7b}',
      '.qa-code .qa-tok-function{color:#50fa7b}',
      '.qa-code .qa-tok-type   {color:#8be9fd}',
      '.qa-code .qa-tok-operator{color:#ff79c6}',
      '.qa-code .qa-tok-decorator{color:#f1fa8c;font-style:italic}',
      '.qa-code .qa-tok-punct  {color:#f8f8f2}',
      '.qa-code .qa-tok-ident  {color:#f8f8f2}',
    ].join(''),

    nord: [
      '.qa-code{background:#2e3440;color:#d8dee9;font-family:"JetBrains Mono","SF Mono",Menlo,monospace;font-size:12.5px;line-height:1.55;padding:14px 18px;border-radius:10px;overflow-x:auto;white-space:pre}',
      '.qa-code .qa-tok-comment{color:#4c566a;font-style:italic}',
      '.qa-code .qa-tok-keyword{color:#81a1c1;font-weight:600}',
      '.qa-code .qa-tok-string {color:#a3be8c}',
      '.qa-code .qa-tok-number {color:#b48ead}',
      '.qa-code .qa-tok-builtin{color:#88c0d0;font-style:italic}',
      '.qa-code .qa-tok-class  {color:#8fbcbb}',
      '.qa-code .qa-tok-function{color:#88c0d0}',
      '.qa-code .qa-tok-type   {color:#8fbcbb}',
      '.qa-code .qa-tok-operator{color:#81a1c1}',
      '.qa-code .qa-tok-decorator{color:#ebcb8b;font-style:italic}',
      '.qa-code .qa-tok-punct  {color:#eceff4}',
      '.qa-code .qa-tok-ident  {color:#d8dee9}',
    ].join(''),

    'github-light': [
      '.qa-code{background:#f6f8fa;color:#24292e;border:1px solid #e1e4e8;font-family:"JetBrains Mono","SF Mono",Menlo,monospace;font-size:12.5px;line-height:1.55;padding:14px 18px;border-radius:10px;overflow-x:auto;white-space:pre}',
      '.qa-code .qa-tok-comment{color:#6a737d;font-style:italic}',
      '.qa-code .qa-tok-keyword{color:#d73a49;font-weight:600}',
      '.qa-code .qa-tok-string {color:#032f62}',
      '.qa-code .qa-tok-number {color:#005cc5}',
      '.qa-code .qa-tok-builtin{color:#6f42c1}',
      '.qa-code .qa-tok-class  {color:#6f42c1}',
      '.qa-code .qa-tok-function{color:#6f42c1}',
      '.qa-code .qa-tok-type   {color:#005cc5}',
      '.qa-code .qa-tok-operator{color:#d73a49}',
      '.qa-code .qa-tok-decorator{color:#e36209;font-style:italic}',
      '.qa-code .qa-tok-punct  {color:#24292e}',
      '.qa-code .qa-tok-ident  {color:#24292e}',
    ].join(''),
  };

  function installTheme(name) {
    if (typeof document === 'undefined') return false;
    const id = 'qa-code-theme-' + name;
    if (document.getElementById(id)) return true;
    const css = CODE_THEMES[name];
    if (!css) return false;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    return true;
  }

  return {
    render,
    version: '0.4.4',
    THEMES,
    SHAPES,
    autoLayout,
    // syntax highlighting
    highlight,
    tokenize,
    languages: LANGUAGES,
    codeThemes: CODE_THEMES,
    installTheme,
  };
}));
