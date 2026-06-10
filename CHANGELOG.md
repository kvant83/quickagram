# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
