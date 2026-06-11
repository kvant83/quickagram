# mermaid-to-quickagram

Convert Mermaid diagram source files into Quickagram diagram literals
on the command line.

```
node tools/mermaid-to-quickagram/index.js input.mmd
```

Supports the four most-used Mermaid diagram types:

| Mermaid header              | Quickagram output |
|-----------------------------|-------------------|
| `flowchart` / `graph`       | `layout: 'lr'` or `'tb'` flowchart with shaped nodes |
| `sequenceDiagram`           | `layout: 'sequence'` with participants + lifelines |
| `classDiagram(-v2)`         | UML class boxes + typed relationships |
| `stateDiagram(-v2)`         | states + `[*]` start/end markers |

## Install

The tool is a Node.js script with **no npm dependencies** — it ships
inside the Quickagram repo. Just clone the repo and run it:

```sh
git clone https://github.com/kvant83/quickagram.git
cd quickagram
node tools/mermaid-to-quickagram/index.js my-diagram.mmd
```

## Usage

```
node tools/mermaid-to-quickagram/index.js <input.mmd|-> [options]

Options:
  -o, --out <path>   Write output to file (default: stdout)
  --json             Emit strict JSON (default: JavaScript object literal)
  -h, --help         Show this help
```

Read from stdin with `-`:

```sh
cat my-diagram.mmd | node tools/mermaid-to-quickagram/index.js -
```

Write to a file:

```sh
node tools/mermaid-to-quickagram/index.js my-diagram.mmd -o diagram.js
```

Strict JSON for non-JS consumers:

```sh
node tools/mermaid-to-quickagram/index.js my-diagram.mmd --json -o diagram.json
```

## Examples

### Flowchart

Input (`my-flow.mmd`):

```
flowchart LR
  A[Start] --> B{Decision}
  B -->|yes| C((Yes path))
  B -->|no| D([Stop])
  C --> D
```

Output:

```js
{
  layout:  "lr",
  padding: 40,
  nodes: [
    { id: "A", kind: "plain",   label: "Start" },
    { id: "B", kind: "diamond", label: "Decision" },
    { id: "C", kind: "circle",  label: "Yes path" },
    { id: "D", kind: "stadium", label: "Stop" },
  ],
  edges: [
    { from: "A", to: "B" },
    { from: "B", to: "C", label: "yes" },
    { from: "B", to: "D", label: "no" },
    { from: "C", to: "D" },
  ],
}
```

Supported flowchart shapes:

| Mermaid               | Quickagram kind     |
|-----------------------|---------------------|
| `A[text]`             | `plain`             |
| `A(text)`             | `plain` (rounded)   |
| `A((text))`           | `circle`            |
| `A([text])`           | `stadium` (pill)    |
| `A[(text)]`           | `db` (cylinder)     |
| `A{text}`             | `diamond`           |
| `A{{text}}`           | `lb` (hexagon)      |
| `A[/text/]`           | `parallelogram`     |
| `A[\text\]`           | `parallelogramAlt`  |
| `A[/text\]`           | `trapezoid`         |
| `A[\text/]`           | `trapezoidAlt`      |

Supported flowchart edges: `-->`, `---`, `-.->`, `-.-`, `==>`, `===`,
`--o`, `--x`, `<-->`, `-- text -->`, `-->|label|`.

Subgraphs are converted to Quickagram `groups`.

### Sequence

Input:

```
sequenceDiagram
  Alice->>John: Hello John, how are you?
  John-->>Alice: I am good, thanks!
```

Output:

```js
{
  layout:  "sequence",
  padding: 40,
  nodes: [
    { id: "Alice", kind: "participant", label: "Alice" },
    { id: "John",  kind: "participant", label: "John"  },
  ],
  edges: [
    { from: "Alice", to: "John",  label: "Hello John, how are you?" },
    { from: "John",  to: "Alice", label: "I am good, thanks!", style: "dashed" },
  ],
}
```

Supported sequence arrows:

| Mermaid     | Style    | toArrow    |
|-------------|----------|------------|
| `->>`       | solid    | arrow      |
| `-->>`      | dashed   | arrow      |
| `->`        | solid    | none       |
| `-->`       | dashed   | none       |
| `-x`        | solid    | cross      |
| `--x`       | dashed   | cross      |
| `-)`        | solid    | arrow (async) |
| `--)`       | dashed   | arrow (async) |

Also supports: `participant Foo as F`, `actor Bob`, `Note over A,B: text`
(rendered as a self-loop labelled with `📝 text`).

Not yet supported: `loop`/`alt`/`opt`/`par`/`critical` control blocks,
`activate`/`deactivate`, `autonumber`. These are silently skipped so the
rest of the diagram still converts.

### Class

Input:

```
classDiagram
  Animal <|-- Dog
  Animal <|-- Cat
  class Animal {
    +String name
    +int age
    +eat() void
  }
  Dog *-- Tail
  Cat o-- Whiskers
  Animal ..> Food : eats
```

Output:

```js
{
  layout:  "lr",
  padding: 40,
  nodes: [
    { id: "Animal", kind: "class", label: "Animal",
      attrs: ["+String name","+int age"], methods: ["+eat() void"] },
    { id: "Dog",      kind: "class", label: "Dog"      },
    { id: "Cat",      kind: "class", label: "Cat"      },
    { id: "Tail",     kind: "class", label: "Tail"     },
    { id: "Whiskers", kind: "class", label: "Whiskers" },
    { id: "Food",     kind: "class", label: "Food"     },
  ],
  edges: [
    { from: "Animal", to: "Dog",      toArrow: "none", fromArrow: "triangle" },
    { from: "Animal", to: "Cat",      toArrow: "none", fromArrow: "triangle" },
    { from: "Dog",    to: "Tail",     toArrow: "none", fromArrow: "diamond"  },
    { from: "Cat",    to: "Whiskers", toArrow: "none", fromArrow: "odiamond" },
    { from: "Animal", to: "Food",     label: "eats", style: "dashed" },
  ],
}
```

Supported class relationships:

| Mermaid   | Meaning        | Arrow rendering              |
|-----------|----------------|------------------------------|
| `<\|--`   | inheritance    | open triangle at parent      |
| `--\|>`   | inheritance    | open triangle at parent      |
| `<\|..`   | realization    | dashed open triangle         |
| `..\|>`   | realization    | dashed open triangle         |
| `*--`     | composition    | filled diamond at composite  |
| `--*`     | composition    | filled diamond at composite  |
| `o--`     | aggregation    | open diamond at aggregate    |
| `--o`     | aggregation    | open diamond at aggregate    |
| `-->`     | association    | regular arrow                |
| `--`      | link           | plain line                   |
| `..>`     | dependency     | dashed arrow                 |
| `..`      | dashed link    | plain dashed line            |

Cardinality is preserved as part of the edge label:

```
A "1" --> "*" B : owns
```
→ `{ from: "A", to: "B", label: '"1" owns "*"' }`.

Members are split into `attrs` (no parentheses) vs `methods` (have `()`).

### State

Input:

```
stateDiagram-v2
  [*] --> Still
  Still --> Moving : start
  Moving --> Still : stop
  Moving --> Crash : break
  Crash --> [*]
```

Output:

```js
{
  layout:  "lr",
  padding: 40,
  nodes: [
    { id: "__start__Still", kind: "start", label: "" },
    { id: "Still",          kind: "state", label: "Still"  },
    { id: "Moving",         kind: "state", label: "Moving" },
    { id: "Crash",          kind: "state", label: "Crash"  },
    { id: "__end__Crash",   kind: "end",   label: "" },
  ],
  edges: [
    { from: "__start__Still", to: "Still" },
    { from: "Still",          to: "Moving", label: "start" },
    { from: "Moving",         to: "Still",  label: "stop"  },
    { from: "Moving",         to: "Crash",  label: "break" },
    { from: "Crash",          to: "__end__Crash" },
  ],
}
```

`[*]` is mapped to synthetic `start` / `end` nodes (small filled / ringed
circles). Composite states (`state Foo { ... }`) become Quickagram
`groups`.

Not yet supported: `<<choice>>`, `<<fork>>`, `<<join>>`, concurrent
regions, notes.

## Render the output

Drop the generated JS object into a Quickagram `render` call:

```html
<script src="https://cdn.jsdelivr.net/gh/kvant83/quickagram@v0.4.0/src/quickagram.js"></script>
<div id="chart"></div>
<script>
  Quickagram.render('#chart', /* paste the generated object here */);
</script>
```

For JSON, fetch and pass:

```js
fetch('./diagram.json').then(r => r.json()).then(d => Quickagram.render('#chart', d));
```

## Comments and HTML entities

- Mermaid line comments (`%% ...`) are stripped.
- Common HTML entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`,
  `&nbsp;`) and `<br>` inside labels are decoded to plain characters.
