# API reference

The library exposes a single object — `Quickagram` — via UMD (works as a `<script>` global, AMD module, or CommonJS `require`).

```ts
type Quickagram = {
  render(container: Element | string, diagram: Diagram): SVGElement;
  version: string;
  THEMES: Record<string, Theme>;   // mutable — extend to add kinds
  SHAPES: Record<string, ShapeFn>; // mutable — extend to add shapes
};
```

## `Quickagram.render(container, diagram)`

Renders `diagram` into `container`, replacing its previous contents. Returns the generated `<svg>` element.

```js
const svg = Quickagram.render('#chart', { nodes, edges });
```

- **`container`** — DOM element or CSS selector. The element is cleared (`innerHTML = ''`) before rendering.
- **`diagram`** — see [FORMAT.md](FORMAT.md).
- **returns** — the new `<svg>` element, so you can post-process it (add event handlers, serialise to file, …).

### Serialising to a standalone SVG file

```js
const svg = Quickagram.render(container, diagram);
const xml = new XMLSerializer().serializeToString(svg);
const blob = new Blob([xml], { type: 'image/svg+xml' });
const url = URL.createObjectURL(blob);
// download...
```

## Extending

Both `THEMES` and `SHAPES` are plain objects; mutating them before `render` works.

```js
Quickagram.SHAPES.diamond = (w, h) =>
  `M ${w/2} 0 L ${w} ${h/2} L ${w/2} ${h} L 0 ${h/2} Z`;
Quickagram.THEMES.decision = {
  top: '#fef3c7', bot: '#fbbf24', border: '#92400e', shape: 'diamond',
};
```

## SVG attributes & CSS hooks

Generated elements carry stable class names so you can style or query them:

| element            | class        | notes |
|--------------------|--------------|-------|
| outer SVG          | `qa-svg`     | |
| node `<g>`         | `qa-node`    | also `qa-class` for UML class nodes; has `data-id` |
| edge `<g>`         | `qa-edge`    | |
| group `<g>`        | `qa-group`   | |
| edges layer        | `qa-edges`   | drawn behind nodes |
| groups layer       | `qa-groups`  | drawn behind edges |

Internal defs are namespaced (`qa-shadow` filter, `qa-arrow` marker, `qa-g-…` gradients) to avoid clashes when multiple diagrams share a page.

### Theming via CSS

Most styling is inlined in the generated SVG, but you can override anything via CSS:

```css
.qa-node text { font-family: 'IBM Plex Sans', sans-serif; }
.qa-edge path { stroke-width: 2.2; }
.qa-class path:first-child { filter: none; } /* drop the shadow */
```

## Browser requirements

- SVG 1.1
- `document.createElementNS`, `CSS.escape`, `getBBox()`
- ES2017 (async-free): `String.prototype.padStart`, template literals, `Map`, `Set`, arrow functions

Tested on current Chrome / Firefox / Safari / Edge. No IE11 support.

## Performance notes

- Quickagram does no layout — coordinates are explicit, so render is O(nodes + edges).
- A diagram of ~100 nodes renders in single-digit milliseconds in a modern browser.
- For thousands of nodes, consider Cytoscape / D3-force instead — Quickagram targets architecture diagrams (rarely >50 nodes), not large graphs.
