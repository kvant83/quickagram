# Quickagram

> Tiny, dependency-free SVG diagram engine for system & architecture diagrams.
> Declarative JSON in, polished SVG out. ~600 lines of plain JS. Apache-2.0.

Quickagram turns a small JavaScript object into a Lucid-style architecture diagram — coloured nodes for different component types (clients, web servers, caches, queues, DBs, …), orthogonal edges with rounded corners and labelled pills, optional grouping, and UML class boxes. No build step, no framework, no runtime dependencies.

```js
// Auto-layout (default) — engine works out positions from the graph.
Quickagram.render('#chart', {
  layout: 'lr',                                  // left-to-right
  nodes: [
    { id: 'c',  kind: 'client', label: 'Client' },
    { id: 'lb', kind: 'lb',     label: 'Load Balancer' },
    { id: 'w',  kind: 'web',    label: 'Web Servers', sub: '×N' },
    { id: 'db', kind: 'db',     label: 'MySQL' },
  ],
  edges: [
    { from: 'c',  to: 'lb' },
    { from: 'lb', to: 'w' },
    { from: 'w',  to: 'db', label: 'query' },
  ],
});
```

You can still hand-place nodes with explicit `x` / `y` when you need pixel control — see [docs/FORMAT.md](docs/FORMAT.md).

## Why

Mermaid is excellent for flowcharts, but its **system-architecture** output is generic-looking; Lucidchart looks great but is a GUI tool. Quickagram aims at the sweet spot:

| | Mermaid | Lucidchart | Quickagram |
|---|---|---|---|
| declarative text source | yes | no | yes |
| beautiful SVG output | OK | yes | yes |
| no GUI required | yes | no | yes |
| no build/runtime deps | yes | n/a | yes |
| component-specific shapes & colours | limited | manual | built-in |
| size | ~3 MB | n/a | **~12 KB** |

It’s built for the kinds of diagrams that fill a system-design book — the original use case is [system-design-primer](https://github.com/donnemartin/system-design-primer)’s 28 challenge diagrams.

## Install

**Drop-in `<script>` tag (no build step):**
```html
<script src="https://cdn.jsdelivr.net/gh/kvant83/quickagram@v0.1.0/src/quickagram.js"></script>
<div id="chart"></div>
<script>
  Quickagram.render('#chart', { nodes: [...], edges: [...] });
</script>
```

**npm:**
```bash
npm install quickagram
```
```js
import Quickagram from 'quickagram';
Quickagram.render(document.getElementById('chart'), diagram);
```

**Just copy the file** — it’s one ~600-line file with no dependencies. Vendor it.

## Quick example

```html
<!doctype html>
<html>
  <body>
    <div id="chart" style="max-width: 800px"></div>
    <script src="src/quickagram.js"></script>
    <script>
      Quickagram.render('#chart', {
        nodes: [
          { id: 'client', kind: 'client', label: 'Client',        x: 0,   y: 120 },
          { id: 'cdn',    kind: 'cdn',    label: 'CDN',           x: 240, y: 0   },
          { id: 'lb',     kind: 'lb',     label: 'Load Balancer', x: 240, y: 120 },
          { id: 'web',    kind: 'web',    label: 'Web Servers',
                                          sub: 'x N',             x: 480, y: 120 },
          { id: 'cache',  kind: 'cache',  label: 'Redis',         x: 720, y: 0   },
          { id: 'db',     kind: 'db',     label: 'MySQL',         x: 720, y: 240, badge: 'WR' },
        ],
        edges: [
          { from: 'client', to: 'cdn', style: 'dashed' },
          { from: 'client', to: 'lb' },
          { from: 'lb',     to: 'web' },
          { from: 'web',    to: 'cache', label: 'check' },
          { from: 'web',    to: 'db',    label: 'miss → query' },
        ],
      });
    </script>
  </body>
</html>
```

See [`examples/`](examples/) for a gallery — open the HTML files directly in a browser, no server required.

## Documentation

- **[Diagram format](docs/FORMAT.md)** — the full schema for `{ nodes, edges, groups }`
- **[Node kinds](docs/KINDS.md)** — all 23 built-in component types with sample syntax
- **[API reference](docs/API.md)** — `Quickagram.render()` and extension hooks
- **[Cookbook](docs/COOKBOOK.md)** — common patterns: fan-out, master/replica, queues, UML classes

## Features

- **Automatic layered layout** (opt in with `layout: "lr"` or `"tb"`) — Sugiyama-lite: longest-path layering + barycenter ordering for minimal edge crossings. No more hand-placing nodes.
- **Automatic node width** based on label / sub / class content. No more overflowing text.
- **Edge fan-out** when multiple edges share a `(node, side)` — they spread along the side instead of stacking.
- **23 built-in node kinds** — `client`, `web`, `api`, `service`, `cache`, `db`, `nosql`, `queue`, `storage`, `cdn`, `dns`, `lb`, `analytics`, `search`, `worker`, `mr`, `process`, `note`, `class`, `actor`, … each with its own colour theme and shape.
- **10 shape primitives** — rounded rect, cylinder, hex, cloud, bucket, queue with internal dividers, layered stack, process arrow, sticky note, actor stick figure, UML class box.
- **Orthogonal edge routing** with auto-side picking, rounded corners, optional labels in white pills, dashed/dotted/bidirectional variants.
- **Optional grouping** — wrap a set of nodes in a labelled dashed container.
- **UML class boxes** with attribute / method sections.
- **Auto-fit viewBox** with `preserveAspectRatio` — diagrams scale cleanly into any container width.
- **No dependencies, no build step, ~12 KB of plain JS**.

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses SVG, ES2017 features, `CSS.escape`, and `getBBox`. No IE11.

## Versioning

Quickagram follows [SemVer](https://semver.org). Until 1.0, expect breaking changes; pin to an exact version in production.

## Contributing

Issues and PRs welcome at https://github.com/kvant83/quickagram. `npm test` runs a lightweight smoke test of the public API; render correctness is verified manually via the files in `examples/`.

## License

[Apache License 2.0](LICENSE) — see file for full text.
