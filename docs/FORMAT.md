# Quickagram Diagram Format

A Quickagram diagram is a single JavaScript / JSON object passed to `Quickagram.render(container, diagram)`. This document describes every field.

```ts
type Diagram = {
  nodes:    Node[];        // required
  edges?:   Edge[];        // default: []
  groups?:  Group[];       // default: [] — drawn behind nodes
  padding?: number;        // default: 40 — px around the bounding box
  maxHeight?: string | false; // default: "78vh" — set false to disable
};
```

---

## Node

```ts
type Node = {
  id:    string;       // unique within this diagram
  kind:  Kind;         // see KINDS.md
  label: string;       // primary text
  x:     number;       // top-left X, in SVG units (pixels)
  y:     number;       // top-left Y, in SVG units (pixels)

  // optional
  sub?:    string;     // small secondary line under the label
  w?:      number;     // width  — default 168 (220 for `class`)
  h?:      number;     // height — default 72  (auto for `class`)
  badge?:  string;     // small pill in the top-right corner

  // UML class only (kind: 'class')
  attrs?:   string[];  // attribute rows
  methods?: string[];  // method rows
};
```

### Coordinates

All positions are in **pixels** in a virtual canvas. The engine computes the bounding box of every node, adds `padding` on every side, and emits an SVG `viewBox` accordingly. The SVG then scales to fit its container (`width: 100%; max-height: 78vh`).

In practice: lay things out on a rough grid (e.g. multiples of 220 horizontally, 140 vertically) and let the viewBox handle scaling.

### `kind`

The `kind` determines colour theme, shape, and built-in icon. See [KINDS.md](KINDS.md) for the full table. Common ones:

| kind | look |
|------|------|
| `client` / `user` | blue, user icon |
| `web` | indigo, server icon |
| `api` | purple, cube icon |
| `service` | teal, gear icon |
| `cache` | dashed amber cylinder |
| `db` | green cylinder |
| `nosql` | dashed green cylinder |
| `queue` | orange ribbed rectangle |
| `storage` | cyan bucket |
| `cdn` / `dns` / `internet` | cloud |
| `lb` | slate hexagon |
| `class` | indigo UML class box |

If a `kind` isn’t recognised, it falls back to a plain grey rectangle.

### `badge`

A small white pill in the top-right corner. Useful for `WR` / `RO`, replica counts, version tags. Example:

```js
{ id: 'm', kind: 'db', label: 'MySQL Master', x: 100, y: 100, badge: 'WR' }
```

---

## Edge

```ts
type Edge = {
  from: string;  // source node id
  to:   string;  // target node id

  // optional
  label?:      string;
  style?:      'solid' | 'dashed' | 'dotted';  // default 'solid'
  color?:      string;                          // CSS colour
  bidir?:      boolean;                         // arrowheads on both ends
  endArrow?:   boolean;                         // false → no arrowhead at the target

  // manual routing overrides
  fromSide?:   'top' | 'right' | 'bottom' | 'left';
  toSide?:     'top' | 'right' | 'bottom' | 'left';
  fromOffset?: number;  // shift the exit point along the chosen side
  toOffset?:   number;
};
```

### Auto-routing

Without `fromSide` / `toSide`, the engine picks sides based on the relative positions of the source and target centres: if the horizontal distance is greater, edges exit horizontally; otherwise vertically.

Routing always uses **orthogonal** segments with rounded corners. The path leaves the source side, makes one or two right-angle turns, and enters the target side perpendicularly.

### Avoiding edge overlap

When two edges share a side, give them different `fromOffset` / `toOffset` values to fan them out:

```js
{ from: 'web', to: 'cache', fromOffset: -10 },
{ from: 'web', to: 'db',    fromOffset:  10 },
```

### Labels

A label is placed at the midpoint of the central segment with a white rounded-rectangle background so it reads on top of crossing edges.

---

## Group

```ts
type Group = {
  nodes:  string[];   // node ids to enclose
  label?: string;     // small uppercase label in the top-left
  fill?:  string;     // default '#f8fafc'
  stroke?: string;    // default '#cbd5e1'
  dash?:   boolean;   // false → solid border. default: dashed
  labelColor?: string;
};
```

Groups are rendered **behind** the nodes they contain. The engine measures the bounding box of the listed nodes and draws a rounded dashed rectangle with the supplied label.

```js
{
  groups: [
    { label: 'AVAILABILITY ZONE A', nodes: ['web1', 'web2', 'cache1'] },
    { label: 'AVAILABILITY ZONE B', nodes: ['web3', 'web4', 'cache2'] },
  ]
}
```

---

## Full example

```js
const diagram = {
  padding: 60,
  nodes: [
    { id: 'u',   kind: 'user',  label: 'User',          x: 0,   y: 200 },
    { id: 'lb',  kind: 'lb',    label: 'Load Balancer', x: 220, y: 200 },
    { id: 'w1',  kind: 'web',   label: 'web-1',         x: 440, y: 80  },
    { id: 'w2',  kind: 'web',   label: 'web-2',         x: 440, y: 200 },
    { id: 'w3',  kind: 'web',   label: 'web-3',         x: 440, y: 320 },
    { id: 'c',   kind: 'cache', label: 'Redis',         x: 680, y: 80  },
    { id: 'm',   kind: 'db',    label: 'MySQL Master',  x: 680, y: 320, badge: 'WR' },
    { id: 'r',   kind: 'db',    label: 'MySQL Replica', x: 920, y: 320, badge: 'RO' },
  ],
  edges: [
    { from: 'u',  to: 'lb' },
    { from: 'lb', to: 'w1' },
    { from: 'lb', to: 'w2' },
    { from: 'lb', to: 'w3' },
    { from: 'w1', to: 'c', label: 'GET key' },
    { from: 'w2', to: 'c' },
    { from: 'w3', to: 'c' },
    { from: 'w1', to: 'm', label: 'write' },
    { from: 'w2', to: 'm' },
    { from: 'm',  to: 'r', style: 'dashed', label: 'replicate' },
  ],
  groups: [
    { label: 'WEB TIER',   nodes: ['w1', 'w2', 'w3'] },
    { label: 'DATA TIER',  nodes: ['c', 'm', 'r'] },
  ],
};

Quickagram.render('#chart', diagram);
```

---

## JSON-only mode

The format is pure JSON — no functions, no `Date.now()`. You can store diagrams as `.json` files and `fetch()` them at runtime:

```js
fetch('./architecture.json')
  .then(r => r.json())
  .then(diagram => Quickagram.render('#chart', diagram));
```

This makes diagrams easy to diff, lint, generate from upstream sources (Terraform, OpenAPI, …), and serve from any static host.
