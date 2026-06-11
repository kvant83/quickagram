# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — syntax highlighting

### Added
- **`Quickagram.highlight(code, language)`** — tokeniser + HTML emitter for embedding coloured code blocks. Returns a string of HTML where each token is wrapped in `<span class="qa-tok qa-tok-<type>">`.
- **`Quickagram.tokenize(code, langConfig)`** — lower-level API, returns `{t, v}[]` tokens you can render however you like.
- **`Quickagram.languages`** — bundled language configs: `python` (alias `py`), `javascript` (alias `js`), `sql`, `text` (no-op). Each declares keywords / builtins / types, comment + string delimiters, optional case-insensitivity. Add your own by mutating the object.
- **`Quickagram.codeThemes`** — bundled CSS theme strings: `dracula`, `nord`, `github-light`. Apply by wrapping your `<pre>` in `class="qa-code"` and including the theme CSS.
- **`Quickagram.installTheme(name)`** — convenience helper that injects a theme\'s CSS into `<head>` once. Returns true if applied.

### Notes
- Tokeniser is regex-based and handles: line + block comments, single / double / triple-quoted strings (with escapes), numbers (int / float / hex / scientific), keywords, types, builtins, capitalised identifiers (treated as classes), function calls, decorators (`@`), multi-char operators, punctuation. Sufficient for displaying interview-style code snippets; not a replacement for tree-sitter or Lezer for editor use.

## [0.2.2] — more generous label gap

### Fixed
- Per-layer-gap estimate for long edge labels was tight (6.6 px/char + 28 px slack). At 11 px Inter the actual rendered width of mixed-case latin can be marginally wider — labels still touched node edges in some diagrams. Bumped to 8 px/char + 48 px slack so labels always sit comfortably inside the gap.

## [0.2.1] — readability fixes

### Fixed
- **Text legibility on light kinds.** `plain` and `note` rendered their labels in white on a near-white gradient — invisible. The engine now picks text colour from the gradient's average luminance (WCAG-ish), so light kinds get dark ink (`#1e293b`) automatically. Affects label, sub-label, icon stroke, badge text and surfaces.
- **Edge-label overflow between layers.** Auto-layout used a constant 100-px gap between columns regardless of label length, so any label wider than the gap overflowed into the neighbouring node. Per-gap spacing now grows to fit the longest forward edge label crossing that gap.

### Notes
- Pure rendering fix — same diagram input renders correctly. No data changes required.

## [0.2.0] — engine quality release

### Added
- **Automatic layered layout**. Opt in with `layout: "lr"` (or `"tb"`) on the diagram object — author just declares nodes and edges, the engine layers them by longest path, orders within layers via a barycenter heuristic to minimise edge crossings, and computes positions. The previous explicit `x`/`y` mode still works for hand-tuned diagrams; whichever the author uses, the API is the same.
  - Per-node `layer: <int>` hint to pin a node to a specific column / row.
  - `Quickagram.autoLayout(diagram)` exported for advanced use.
- **Automatic node width**. Width now defaults to the natural width of the label / sub / class content; no more text overflowing the default 168px box. Override with `w` if you want a fixed size.
- **Edge fan-out**. When multiple edges share a `(node, side)`, the engine distributes their exit / entry points along that side so they stop stacking on top of each other before the bend.
- **Edge labels at true path midpoint**. Labels now sit at 50% along the cumulative path length (not the central polyline-segment midpoint), so they don't land on top of an intermediate node. Background pill is fully opaque white with a soft border.

### Changed
- **Shape body / decoration split**. `cylinder`, `queue`, `note`, and `bucket` now return `{ body, decoration }`. The body gets the gradient fill + shadow; the decoration is stroked on top in white. This fixes the "stripes are filled with gradient" artifact (queue dividers, cylinder back rim, note fold, bucket rim).
- **`stack`** returns `{ body, back }` — the back rectangles render behind the front rect, giving a proper layered look instead of a single oddly-filled path.
- Edge label background is slightly larger and opaque; better readability when crossing other edges.

### Notes
- Backwards compatible. Existing diagrams with explicit `x`/`y` render identically. Adding `layout: "lr"` switches to auto mode.

## [0.1.0] — 2024 initial release

### Added
- Core engine `Quickagram.render(container, diagram)`.
- 23 built-in node kinds: `client`, `user`, `web`, `api`, `service`, `cache`, `db`, `nosql`, `queue`, `storage`, `cdn`, `dns`, `internet`, `lb`, `analytics`, `search`, `worker`, `mr`, `process`, `note`, `class`, `actor`, `plain`.
- 10 shape primitives: rounded rect, cylinder, hexagon, cloud, bucket, ribbed queue, layered stack, process arrow, sticky note, actor stick figure, UML class box.
- Orthogonal edge routing with rounded corners, auto-side picking, dashed/dotted/bidirectional variants, white-pill labels.
- Group / cluster rendering behind nodes.
- UML class boxes with attribute and method sections.
- Extension hooks: mutable `Quickagram.THEMES` and `Quickagram.SHAPES`.
- UMD wrapper — works as a `<script>` global, AMD module, or CommonJS `require`.
- Documentation: README, FORMAT, KINDS, API, COOKBOOK.
- Examples: basic web architecture, scaled architecture, UML class diagram.
