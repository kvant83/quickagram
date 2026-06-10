# Cookbook

Patterns lifted from real diagrams.

## Three-tier web app

```js
Quickagram.render('#chart', {
  nodes: [
    { id: 'u',  kind: 'user',  label: 'User',           x: 0,   y: 120 },
    { id: 'lb', kind: 'lb',    label: 'Load Balancer',  x: 220, y: 120 },
    { id: 'w',  kind: 'web',   label: 'Web Servers',
                              sub: '×N reverse proxies', x: 440, y: 120 },
    { id: 'a',  kind: 'api',   label: 'API Servers',    x: 680, y: 120 },
    { id: 'c',  kind: 'cache', label: 'Redis',          x: 920, y: 0   },
    { id: 'd',  kind: 'db',    label: 'PostgreSQL',     x: 920, y: 240 },
  ],
  edges: [
    { from: 'u', to: 'lb' },
    { from: 'lb', to: 'w' },
    { from: 'w', to: 'a' },
    { from: 'a', to: 'c', label: 'check' },
    { from: 'a', to: 'd', label: 'miss → query' },
  ],
});
```

## Master / replica with arrowhead labels

```js
{
  nodes: [
    { id: 'app', kind: 'api', label: 'App',           x: 0,   y: 100 },
    { id: 'm',   kind: 'db',  label: 'MySQL Master',  x: 240, y: 0,   badge: 'WR' },
    { id: 'r1',  kind: 'db',  label: 'MySQL Replica', x: 240, y: 140, badge: 'RO' },
    { id: 'r2',  kind: 'db',  label: 'MySQL Replica', x: 240, y: 280, badge: 'RO' },
  ],
  edges: [
    { from: 'app', to: 'm', label: 'writes' },
    { from: 'app', to: 'r1', label: 'reads' },
    { from: 'app', to: 'r2' },
    { from: 'm',  to: 'r1', style: 'dashed' },
    { from: 'm',  to: 'r2', style: 'dashed', label: 'replicate' },
  ],
}
```

## Queue + workers

```js
{
  nodes: [
    { id: 'api',  kind: 'api',    label: 'API',    x: 0,   y: 100 },
    { id: 'q',    kind: 'queue',  label: 'SQS',    x: 220, y: 100 },
    { id: 'w',    kind: 'worker', label: 'Workers',
                                  sub: 'autoscale', x: 440, y: 100 },
    { id: 'db',   kind: 'db',     label: 'DB',     x: 660, y: 0   },
    { id: 's3',   kind: 'storage', label: 'S3',    x: 660, y: 200 },
  ],
  edges: [
    { from: 'api', to: 'q', label: 'enqueue' },
    { from: 'q',   to: 'w' },
    { from: 'w',   to: 'db' },
    { from: 'w',   to: 's3' },
  ],
}
```

## Edge-to-edge labelling without crossing

When two edges from the same source might overlap, use `fromOffset` / `toOffset`:

```js
{ from: 'api', to: 'cache', fromOffset: -8, label: 'hit' },
{ from: 'api', to: 'cache', fromOffset:  8, label: 'set' },
```

Or override sides explicitly:

```js
{ from: 'api', to: 'cache', fromSide: 'top',    toSide: 'left' },
{ from: 'api', to: 'cache', fromSide: 'bottom', toSide: 'left' },
```

## Grouping by availability zone

```js
{
  nodes: [
    { id: 'w1', kind: 'web', label: 'web-1', x: 0,   y: 0 },
    { id: 'w2', kind: 'web', label: 'web-2', x: 200, y: 0 },
    { id: 'c1', kind: 'cache', label: 'cache-1', x: 0, y: 120 },

    { id: 'w3', kind: 'web', label: 'web-3', x: 500, y: 0 },
    { id: 'w4', kind: 'web', label: 'web-4', x: 700, y: 0 },
    { id: 'c2', kind: 'cache', label: 'cache-2', x: 500, y: 120 },
  ],
  edges: [],
  groups: [
    { label: 'AZ A', nodes: ['w1', 'w2', 'c1'] },
    { label: 'AZ B', nodes: ['w3', 'w4', 'c2'] },
  ],
}
```

## UML class with inheritance

```js
{
  nodes: [
    { id: 'Animal', kind: 'class', label: 'Animal «abstract»',
      attrs: ['# name: String', '# age: int'],
      methods: ['+ speak(): String', '+ describe(): String'],
      x: 100, y: 0, w: 260 },

    { id: 'Dog', kind: 'class', label: 'Dog',
      methods: ['+ speak() → "woof"'], x: 0,   y: 240, w: 200 },
    { id: 'Cat', kind: 'class', label: 'Cat',
      methods: ['+ speak() → "meow"'], x: 240, y: 240, w: 200 },
  ],
  edges: [
    { from: 'Dog', to: 'Animal', label: 'extends', style: 'dashed' },
    { from: 'Cat', to: 'Animal', label: 'extends', style: 'dashed' },
  ],
}
```

## Sketching state with `kind: 'note'`

```js
{ id: 'note', kind: 'note', label: 'TODO: rate limit', sub: 'before launch', x: 0, y: 0, w: 200, h: 80 }
```

## Custom palette

If you want a darker theme:

```js
for (const t of Object.values(Quickagram.THEMES)) {
  t.top = darken(t.top, 0.3);
  t.bot = darken(t.bot, 0.3);
}
```

Or recolour a single kind for a brand match:

```js
Quickagram.THEMES.web = {
  top: '#22c55e', bot: '#16a34a', border: '#14532d',
  shape: 'rect', icon: 'server',
};
```
