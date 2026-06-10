/*!
 * Quickagram — a tiny, dependency-free SVG diagram engine.
 * https://github.com/quickagram/quickagram
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

  /* ---------- palette: each "kind" maps to a colour theme + shape ---------- */
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

  /* ---------- shape path generators (origin = node top-left) ---------- */
  const SHAPES = {
    rect: (w, h, r = 12) =>
      `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
    cylinder: (w, h) => {
      const ry = Math.min(10, h * 0.18);
      return `M 0 ${ry} a ${w / 2} ${ry} 0 0 1 ${w} 0 V ${h - ry} a ${w / 2} ${ry} 0 0 1 ${-w} 0 Z M 0 ${ry} a ${w / 2} ${ry} 0 0 0 ${w} 0`;
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
      let d = SHAPES.rect(w, h, 6);
      for (let i = 1; i < 4; i++) {
        const x = (w / 4) * i;
        d += ` M ${x} 6 V ${h - 6}`;
      }
      return d;
    },
    bucket: (w, h) => {
      const ry = h * 0.12;
      return `M 0 ${ry} a ${w / 2} ${ry} 0 0 1 ${w} 0 V ${h - ry} L ${w * 0.92} ${h} H ${w * 0.08} L 0 ${h - ry} Z M 0 ${ry} a ${w / 2} ${ry} 0 0 0 ${w} 0`;
    },
    stack: (w, h) => {
      const off = 6;
      return `M ${off * 2} ${off * 2} h ${w - off * 2} v ${h - off * 2} h ${-(w - off * 2)} z M ${off} ${off} h ${w - off * 2} v ${h - off * 2} h ${-(w - off * 2)} z M 0 0 h ${w - off * 2} v ${h - off * 2} h ${-(w - off * 2)} z`;
    },
    process: (w, h) => {
      const k = h * 0.5;
      return `M ${k} 0 H ${w - k} L ${w} ${h / 2} L ${w - k} ${h} H ${k} L 0 ${h / 2} Z`;
    },
    note: (w, h) => {
      const f = 16;
      return `M 0 0 H ${w - f} L ${w} ${f} V ${h} H 0 Z M ${w - f} 0 V ${f} H ${w}`;
    },
    actor: (w, h) => {
      const cx = w / 2;
      return `M ${cx} 8 a 8 8 0 1 1 0.001 0 Z M ${cx} 16 v 18 M ${cx - 12} 22 h 24 M ${cx} 34 l -10 14 M ${cx} 34 l 10 14`;
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

    const mk = (id, color) => {
      const m = $('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '8', markerHeight: '8', orient: 'auto-start-reverse' }, defs);
      $('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: color }, m);
    };
    mk('qa-arrow', '#334155');
    return defs;
  }

  function ensureGradient(defs, theme) {
    const id = `qa-g-${theme.top.replace('#', '')}-${theme.bot.replace('#', '')}`;
    if (defs.querySelector(`#${CSS.escape(id)}`)) return id;
    const g = $('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    $('stop', { offset: '0%',   'stop-color': lighten(theme.top, 0.08) }, g);
    $('stop', { offset: '100%', 'stop-color': theme.bot }, g);
    return id;
  }

  /* ---------- node rendering ---------- */
  function drawNode(svg, defs, node) {
    const theme = THEMES[node.kind] || THEMES.plain;
    const w = node.w || DEFAULT_W;
    const h = node.h || DEFAULT_H;
    node._w = w; node._h = h;

    const g = $('g', { class: 'qa-node', transform: `translate(${node.x},${node.y})`, 'data-id': node.id }, svg);
    const gradId = ensureGradient(defs, theme);
    const shapeFn = SHAPES[theme.shape] || SHAPES.rect;

    $('path', {
      d: shapeFn(w, h),
      fill: `url(#${gradId})`,
      stroke: theme.border,
      'stroke-width': 1.5,
      'stroke-dasharray': theme.dashed ? '5 4' : null,
      filter: 'url(#qa-shadow)',
    }, g);

    const hasIcon = theme.icon && ICONS[theme.icon];
    const textX = w / 2 + (hasIcon ? 8 : 0);

    if (hasIcon) {
      const ig = $('g', { transform: `translate(16, ${h / 2})`, opacity: '0.9' }, g);
      $('path', {
        d: ICONS[theme.icon], fill: 'none', stroke: '#fff',
        'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, ig);
    }

    const t = $('text', {
      x: textX, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#fff', 'font-family': "'Inter', system-ui, sans-serif",
      'font-size': '13', 'font-weight': '600', 'pointer-events': 'none',
    }, g);

    if (node.sub) {
      $('tspan', { x: textX, dy: '-0.5em' }, t).textContent = node.label || '';
      $('tspan', { x: textX, dy: '1.4em', 'font-size': '11', 'font-weight': '400', 'fill-opacity': '0.85' }, t)
        .textContent = node.sub;
    } else {
      t.textContent = node.label || '';
    }

    if (node.badge) {
      const bg = $('g', { transform: `translate(${w - 8}, 8)` }, g);
      const bw = Math.max(22, node.badge.length * 7 + 10);
      $('rect', {
        x: -bw, y: -6, width: bw, height: 16, rx: 8,
        fill: 'rgba(255,255,255,0.25)', stroke: 'rgba(255,255,255,0.4)',
      }, bg);
      $('text', {
        x: -bw / 2, y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: '#fff', 'font-size': '10', 'font-weight': '700',
        'font-family': "'Inter', system-ui, sans-serif",
      }, bg).textContent = node.badge;
    }
  }

  /* ---------- UML class box ---------- */
  function drawClassNode(svg, defs, node) {
    const theme = THEMES.class;
    const w = node.w || 220;
    const headH = 30;
    const lineH = 18;
    const padY = 8;
    const attrs = node.attrs || [];
    const meths = node.methods || [];
    const bodyH = padY * 2 + (attrs.length + meths.length) * lineH + (attrs.length && meths.length ? 8 : 0);
    const h = headH + Math.max(bodyH, 28);
    node._w = w; node._h = h;

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

  /* ---------- edge routing ---------- */
  function sidePoint(n, side, offset = 0) {
    const cx = n.x + n._w / 2, cy = n.y + n._h / 2;
    switch (side) {
      case 'right':  return [n.x + n._w, cy + offset];
      case 'left':   return [n.x,        cy + offset];
      case 'top':    return [cx + offset, n.y];
      case 'bottom': return [cx + offset, n.y + n._h];
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

  function buildPolyline(p1, s1, p2, s2) {
    const [x1, y1] = p1, [x2, y2] = p2;
    const out = [[x1, y1]];
    const stub = 18;
    const ex = s => s === 'right' ? [x1 + stub, y1] : s === 'left' ? [x1 - stub, y1] : s === 'bottom' ? [x1, y1 + stub] : [x1, y1 - stub];
    const en = s => s === 'right' ? [x2 + stub, y2] : s === 'left' ? [x2 - stub, y2] : s === 'bottom' ? [x2, y2 + stub] : [x2, y2 - stub];
    const a = ex(s1), b = en(s2);
    out.push(a);
    const horiz1 = s1 === 'left' || s1 === 'right';
    const horiz2 = s2 === 'left' || s2 === 'right';
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
    const [sa, sb] = autoSides(a, b);
    const fs = edge.fromSide || sa, ts = edge.toSide || sb;
    const p1 = sidePoint(a, fs, edge.fromOffset || 0);
    const p2 = sidePoint(b, ts, edge.toOffset || 0);
    const pts = buildPolyline(p1, fs, p2, ts);
    const d = smoothPath(pts, 10);

    const g = $('g', { class: 'qa-edge' }, layer);
    const style = edge.style || 'solid';
    const dash = style === 'dashed' ? '6 5' : style === 'dotted' ? '2 4' : null;

    $('path', {
      d, fill: 'none', stroke: edge.color || '#475569', 'stroke-width': 1.8,
      'stroke-dasharray': dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'marker-end': edge.endArrow === false ? null : 'url(#qa-arrow)',
      'marker-start': edge.bidir ? 'url(#qa-arrow)' : null,
    }, g);

    if (edge.label) {
      const mid = Math.floor(pts.length / 2);
      const [x1, y1] = pts[mid - 1], [x2, y2] = pts[mid];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const txt = $('text', {
        x: mx, y: my, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': "'Inter', system-ui, sans-serif", 'font-size': '11',
        'font-weight': '500', fill: '#0f172a', 'pointer-events': 'none',
      }, g);
      txt.textContent = edge.label;
      const bbox = txt.getBBox();
      const pad = 5;
      const bg = $('rect', {
        x: bbox.x - pad, y: bbox.y - 2, width: bbox.width + pad * 2, height: bbox.height + 4,
        rx: 6, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1,
      });
      g.insertBefore(bg, txt);
    }
  }

  /* ---------- render entry ---------- */
  function render(container, diagram) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) throw new Error('Quickagram: container not found');
    container.innerHTML = '';

    const padding = diagram.padding != null ? diagram.padding : 40;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of diagram.nodes) {
      const w = n.w || (n.kind === 'class' ? 220 : DEFAULT_W);
      const h = n.h || (n.kind === 'class'
        ? 60 + ((n.attrs || []).length + (n.methods || []).length) * 18
        : DEFAULT_H);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
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

    const firstNode = svg.querySelector('.qa-node');
    if (diagram.groups && diagram.groups.length) {
      const gLayer = $('g', { class: 'qa-groups' });
      svg.insertBefore(gLayer, firstNode);
      for (const grp of diagram.groups) drawCluster(gLayer, grp, nodeMap);
    }
    const eLayer = $('g', { class: 'qa-edges' });
    svg.insertBefore(eLayer, firstNode);
    for (const e of (diagram.edges || [])) drawEdge(eLayer, e, nodeMap);

    return svg;
  }

  return {
    render,
    version: '0.1.0',
    THEMES, // exposed so consumers can extend or recolour
    SHAPES,
  };
}));
