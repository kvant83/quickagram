/* Visual correctness invariants for rendered Quickagram diagrams.
 *
 * These tests assert things that MUST be true for a diagram to be
 * visually correct, regardless of whether the SVG output has changed.
 * Snapshot tests catch CHANGES; invariants catch BUGS.
 *
 * Available checks (all take a rendered SVG element + the diagram):
 *
 *   detectEdgeNodeIntersection(svg, diagram)
 *     Returns [{edge, node}] for every edge segment that passes
 *     through the bbox of a non-source/non-target node — i.e. the
 *     arrow visually crosses an unrelated rectangle.
 *
 *   detectEdgeOverlap(svg, diagram)
 *     Returns [{a, b}] for every pair of edges whose paths share a
 *     collinear segment longer than `minOverlap` pixels — e.g. an
 *     A→B and B→A back-edge pair drawn on top of each other.
 *
 *   detectEdgeMissesTarget(svg, diagram)
 *     Returns [{edge}] for every edge whose final endpoint is more
 *     than `slack` pixels away from the target node's bbox edge —
 *     i.e. the arrow tip lands in empty space, not on the node.
 */
'use strict';

/* ------------------------------------------------------------------ */
/* Parse an SVG `d` attribute into a list of [x, y] points. We only
 * support the subset Quickagram produces: M / L / Q / H / V (Q with
 * control + end, we keep the end point). Returns the polyline as a
 * sequence of points. */
function pathPoints(d) {
  const tokens = d.match(/[MLQHVZmlqhvz]|-?\d+(?:\.\d+)?/g) || [];
  const out = [];
  let cx = 0, cy = 0;
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i++];
    if (t === 'M' || t === 'L') {
      cx = +tokens[i++]; cy = +tokens[i++];
      out.push([cx, cy]);
    } else if (t === 'H') { cx = +tokens[i++]; out.push([cx, cy]); }
    else if (t === 'V')   { cy = +tokens[i++]; out.push([cx, cy]); }
    else if (t === 'Q')   {
      // control + end — keep only the end point (the curve sweeps near
      // it; for overlap detection the corner-rounded curves are close
      // to the chord)
      i += 2;                              // skip control point
      cx = +tokens[i++]; cy = +tokens[i++];
      out.push([cx, cy]);
    } else if (t === 'Z' || t === 'z') {
      // ignore
    } else {
      // unexpected token — bail
      break;
    }
  }
  return out;
}

/* Find all <path> elements that belong to .qa-edge groups, returning
 * { edgeData?, pts } pairs. edgeData links back to the diagram's edge
 * object IF the engine recorded an order (we just zip in declaration
 * order, which is what the engine renders in). */
function collectEdgePaths(svg, diagram) {
  const groups = svg.querySelectorAll('.qa-edge');
  const out = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const p = g.children.find(c => c.tag === 'path' && c.attrs.d);
    if (!p) continue;
    out.push({
      idx: i,
      edge: diagram.edges ? diagram.edges[i] : null,
      pts: pathPoints(p.attrs.d),
    });
  }
  return out;
}

/* Does a 2D segment (a,b) cross the (closed) axis-aligned rectangle
 * with corners (rx1,ry1)-(rx2,ry2)? Uses the Liang-Barsky line clip.
 * Returns true if any of the segment lies strictly inside the rect
 * (interior overlap) — i.e. an edge ENTERING the rectangle, not
 * merely touching its boundary. */
function segmentCrossesRect(ax, ay, bx, by, rx1, ry1, rx2, ry2, margin) {
  const m = margin || 1;
  const x1 = rx1 + m, y1 = ry1 + m, x2 = rx2 - m, y2 = ry2 - m;
  if (x1 >= x2 || y1 >= y2) return false;     // degenerate rect
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else       { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!clip(-dx, ax - x1)) return false;
  if (!clip( dx, x2 - ax)) return false;
  if (!clip(-dy, ay - y1)) return false;
  if (!clip( dy, y2 - ay)) return false;
  return t1 > t0;
}

/* Detect edges that pass through nodes that are neither their source
 * nor their target — e.g. an A→D edge crossing through B and C in the
 * columns between. */
function detectEdgeNodeIntersection(svg, diagram, opts) {
  opts = opts || {};
  const margin = opts.margin != null ? opts.margin : 2;
  const edgePaths = collectEdgePaths(svg, diagram);
  const violations = [];
  for (const ep of edgePaths) {
    if (!ep.edge) continue;
    const src = ep.edge.from, dst = ep.edge.to;
    for (let i = 0; i < ep.pts.length - 1; i++) {
      const [ax, ay] = ep.pts[i];
      const [bx, by] = ep.pts[i + 1];
      for (const n of diagram.nodes) {
        if (n.id === src || n.id === dst) continue;
        const rx1 = n.x, ry1 = n.y;
        const rx2 = n.x + n._w, ry2 = n.y + n._h;
        if (segmentCrossesRect(ax, ay, bx, by, rx1, ry1, rx2, ry2, margin)) {
          violations.push({
            edge: src + '→' + dst,
            node: n.id,
            segment: [[ax, ay], [bx, by]],
          });
          break;     // one violation per edge is enough info
        }
      }
    }
  }
  return violations;
}

/* Coalesce consecutive collinear axis-aligned points into a minimal
 * polyline. Quickagram emits Q-bends around every corner, which leaves
 * 3-4 collinear points along each straight run; without coalescing,
 * overlap measurements fragment into many tiny segments that each fall
 * under the visual-significance threshold even though their union is
 * obviously visible. */
function coalesceCollinear(pts) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur  = pts[i];
    const next = pts[i + 1];
    const horizCollinear = Math.abs(prev[1] - cur[1]) < 0.5 && Math.abs(cur[1] - next[1]) < 0.5;
    const vertCollinear  = Math.abs(prev[0] - cur[0]) < 0.5 && Math.abs(cur[0] - next[0]) < 0.5;
    if (horizCollinear || vertCollinear) continue;     // cur is redundant
    out.push(cur);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* Length of the collinear overlap between two axis-aligned segments.
 * Returns 0 if they are not collinear, or the length of the shared
 * horizontal/vertical interval otherwise. */
function collinearOverlapLen(a, b) {
  // a = [[ax1,ay1],[ax2,ay2]]; b same.
  const horizA = a[0][1] === a[1][1];
  const horizB = b[0][1] === b[1][1];
  if (horizA && horizB) {
    if (Math.abs(a[0][1] - b[0][1]) > 0.5) return 0;     // not same y
    const aL = Math.min(a[0][0], a[1][0]), aR = Math.max(a[0][0], a[1][0]);
    const bL = Math.min(b[0][0], b[1][0]), bR = Math.max(b[0][0], b[1][0]);
    return Math.max(0, Math.min(aR, bR) - Math.max(aL, bL));
  }
  const vertA = a[0][0] === a[1][0];
  const vertB = b[0][0] === b[1][0];
  if (vertA && vertB) {
    if (Math.abs(a[0][0] - b[0][0]) > 0.5) return 0;     // not same x
    const aT = Math.min(a[0][1], a[1][1]), aB = Math.max(a[0][1], a[1][1]);
    const bT = Math.min(b[0][1], b[1][1]), bB = Math.max(b[0][1], b[1][1]);
    return Math.max(0, Math.min(aB, bB) - Math.max(aT, bT));
  }
  return 0;     // diagonals not supported (Quickagram routes orthogonally)
}

/* Detect edge pairs whose paths share a substantial collinear segment —
 * e.g. A→B and B→A both rendered along the same horizontal corridor.
 * Both paths are coalesced into their minimal polyline first so that
 * Q-bend point clutter doesn't fragment a single visible overlap into
 * many sub-threshold pieces. */
function detectEdgeOverlap(svg, diagram, opts) {
  opts = opts || {};
  const minOverlap = opts.minOverlap != null ? opts.minOverlap : 16;
  const edgePaths = collectEdgePaths(svg, diagram)
    .map(ep => ({ ...ep, pts: coalesceCollinear(ep.pts) }));
  const violations = [];
  for (let i = 0; i < edgePaths.length; i++) {
    for (let j = i + 1; j < edgePaths.length; j++) {
      const A = edgePaths[i], B = edgePaths[j];
      let totalOverlap = 0;
      for (let ia = 0; ia < A.pts.length - 1; ia++) {
        const segA = [A.pts[ia], A.pts[ia + 1]];
        for (let ib = 0; ib < B.pts.length - 1; ib++) {
          const segB = [B.pts[ib], B.pts[ib + 1]];
          totalOverlap += collinearOverlapLen(segA, segB);
        }
      }
      if (totalOverlap >= minOverlap) {
        violations.push({
          a: A.edge ? A.edge.from + '→' + A.edge.to : 'edge[' + i + ']',
          b: B.edge ? B.edge.from + '→' + B.edge.to : 'edge[' + j + ']',
          overlapPx: Math.round(totalOverlap),
        });
      }
    }
  }
  return violations;
}

/* Detect edges whose final endpoint is far from the declared target
 * node — i.e. the arrow points off into empty space rather than
 * landing on the node. */
function detectEdgeMissesTarget(svg, diagram, opts) {
  opts = opts || {};
  const slack = opts.slack != null ? opts.slack : 4;
  const edgePaths = collectEdgePaths(svg, diagram);
  const violations = [];
  for (const ep of edgePaths) {
    if (!ep.edge) continue;
    const target = diagram.nodes.find(n => n.id === ep.edge.to);
    if (!target) continue;
    const last = ep.pts[ep.pts.length - 1];
    const [x, y] = last;

    // Sequence layout: the arrow target is the LIFELINE column under
    // the participant, not the participant's header bbox. The lifeline
    // is a vertical line at the participant's centre x, extending from
    // just below the header down to the last message y. Treat any
    // endpoint sitting on that column as landing on-target.
    if (diagram.layout === 'sequence') {
      const cx = target.x + target._w / 2;
      const lifelineY1 = target.y + target._h;
      const lifelineY2 = diagram._lifelineY2 != null ? diagram._lifelineY2 : Infinity;
      const onLifeline = Math.abs(x - cx) <= slack && y >= lifelineY1 - slack && y <= lifelineY2 + slack;
      if (!onLifeline) {
        violations.push({
          edge: ep.edge.from + '→' + ep.edge.to,
          endpoint: [x, y],
          expectedLifelineX: cx,
        });
      }
      continue;
    }

    const onLeft   = Math.abs(x - target.x)                  <= slack && y >= target.y && y <= target.y + target._h;
    const onRight  = Math.abs(x - (target.x + target._w))    <= slack && y >= target.y && y <= target.y + target._h;
    const onTop    = Math.abs(y - target.y)                  <= slack && x >= target.x && x <= target.x + target._w;
    const onBottom = Math.abs(y - (target.y + target._h))    <= slack && x >= target.x && x <= target.x + target._w;
    if (!(onLeft || onRight || onTop || onBottom)) {
      violations.push({
        edge: ep.edge.from + '→' + ep.edge.to,
        endpoint: [x, y],
        targetBBox: { x: target.x, y: target.y, w: target._w, h: target._h },
      });
    }
  }
  return violations;
}

/* Distance from a point to a node's actual VISIBLE perimeter — not its
 * bbox edge. Returns -1 if the kind has no special perimeter geometry
 * (rect/stadium/parallelogram/trapezoid/hexagon all closely fill their
 * bbox so the bbox-edge test in detectEdgeMissesTarget catches them). */
function distanceToShapePerimeter(point, node, kind) {
  const [px, py] = point;
  const cx = node.x + node._w / 2, cy = node.y + node._h / 2;
  const w = node._w, h = node._h;
  if (kind === 'diamond') {
    // 4 line segments: (cx,top)→(right,cy)→(cx,bot)→(left,cy)→(cx,top)
    const tips = [[cx, node.y], [node.x + w, cy], [cx, node.y + h], [node.x, cy], [cx, node.y]];
    let best = Infinity;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = tips[i], [bx, by] = tips[i + 1];
      // distance from (px,py) to segment a-b
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      let t = ((px - ax) * dx + (py - ay) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + t * dx, qy = ay + t * dy;
      best = Math.min(best, Math.hypot(px - qx, py - qy));
    }
    return best;
  }
  if (kind === 'circle' || kind === 'start' || kind === 'end') {
    const r = Math.min(w, h) / 2;
    return Math.abs(Math.hypot(px - cx, py - cy) - r);
  }
  return -1;       // not specially modelled — let bbox check handle it
}

/* Detect edges whose endpoints land outside the VISIBLE shape (not
 * just outside the bbox). Catches the case where fan-out offsets
 * place an arrow at the bbox edge but well outside the inscribed
 * diamond/circle. */
function detectEdgeEndpointOffShape(svg, diagram, opts) {
  opts = opts || {};
  const slack = opts.shapeSlack != null ? opts.shapeSlack : 4;
  const edgePaths = collectEdgePaths(svg, diagram);
  const nodeByKind = new Map(diagram.nodes.map(n => [n.id, n.kind]));
  const violations = [];
  for (const ep of edgePaths) {
    if (!ep.edge) continue;
    const checkEnd = (point, nodeId, role) => {
      const n = diagram.nodes.find(x => x.id === nodeId);
      if (!n) return;
      const d = distanceToShapePerimeter(point, n, nodeByKind.get(nodeId));
      if (d < 0) return;
      if (d > slack) {
        violations.push({
          edge:    ep.edge.from + '→' + ep.edge.to,
          role,
          node:    nodeId,
          kind:    nodeByKind.get(nodeId),
          point,
          distancePx: Math.round(d),
        });
      }
    };
    checkEnd(ep.pts[0],                       ep.edge.from, 'source');
    checkEnd(ep.pts[ep.pts.length - 1],       ep.edge.to,   'target');
  }
  return violations;
}

/* Single entry point — runs every invariant on a rendered diagram and
 * returns a list of violations across all checks. Empty array = the
 * diagram is visually correct under our checks. */
function checkInvariants(svg, diagram, opts) {
  return [
    ...detectEdgeNodeIntersection (svg, diagram, opts).map(v => ({ kind: 'edge-crosses-node',     ...v })),
    ...detectEdgeOverlap          (svg, diagram, opts).map(v => ({ kind: 'edges-overlap',         ...v })),
    ...detectEdgeMissesTarget     (svg, diagram, opts).map(v => ({ kind: 'edge-misses-target',    ...v })),
    ...detectEdgeEndpointOffShape (svg, diagram, opts).map(v => ({ kind: 'edge-endpoint-off-shape', ...v })),
  ];
}

module.exports = {
  checkInvariants,
  detectEdgeNodeIntersection,
  detectEdgeOverlap,
  detectEdgeMissesTarget,
  detectEdgeEndpointOffShape,
  distanceToShapePerimeter,
  pathPoints,
  segmentCrossesRect,
  collinearOverlapLen,
};
