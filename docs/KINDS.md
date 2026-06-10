# Node Kinds

Each `kind` value selects a colour theme, a shape, and (sometimes) a built-in icon. All built-ins are listed below. To add your own, mutate `Quickagram.THEMES` before calling `render`.

| `kind`       | Shape       | Colour family | Icon    | Typical use |
|--------------|-------------|---------------|---------|-------------|
| `client`     | rounded rect| blue          | user    | A user-agent or end-user device |
| `user`       | rounded rect| blue          | user    | Alias for `client` |
| `web`        | rounded rect| indigo        | server  | Web server / reverse proxy |
| `api`        | rounded rect| purple        | cube    | Application / API server |
| `service`    | rounded rect| teal          | gear    | Microservice or internal service |
| `cache`      | cylinder    | amber (dashed)| —       | In-memory cache (Redis, Memcached) |
| `db`         | cylinder    | green         | —       | Relational database |
| `nosql`      | cylinder    | green (dashed)| —       | NoSQL / document / wide-column store |
| `queue`      | ribbed rect | orange        | —       | Message queue or task queue |
| `storage`    | bucket      | cyan          | —       | Object store (S3, GCS) |
| `cdn`        | cloud       | sky           | —       | CDN |
| `dns`        | cloud       | grey          | —       | DNS or other directory service |
| `internet`   | cloud       | grey          | —       | The public internet or an external API |
| `lb`         | hexagon     | slate         | —       | Load balancer |
| `analytics`  | rounded rect| pink          | chart   | Analytics warehouse / dashboard |
| `search`     | rounded rect| rose          | lens    | Search service / Lucene cluster |
| `worker`     | rounded rect| lime          | gear    | Background worker / job processor |
| `mr`         | layered stack | violet      | —       | MapReduce / batch processing |
| `process`    | hex-process | amber         | —       | Generic process (flow-chart style) |
| `note`       | sticky note | yellow        | —       | Annotation, sticky note |
| `class`      | UML box     | indigo        | —       | UML class (requires `attrs` / `methods`) |
| `actor`      | stick figure| pink          | —       | Use-case diagram actor |
| `plain`      | rounded rect| neutral       | —       | Default fallback for unknown kinds |

## Colour preview

The theme for each kind is a top→bottom linear gradient. Roughly:

```
client/user  #7aa2f7 → #3b66d6    (blue)
web          #a78bfa → #7c3aed    (indigo)
api          #c084fc → #9333ea    (purple)
service      #2dd4bf → #0d9488    (teal)
cache        #fcd34d → #f59e0b    (amber)
db           #4ade80 → #16a34a    (emerald)
nosql        #86efac → #22c55e    (emerald, dashed)
queue        #fb923c → #ea580c    (orange)
storage      #22d3ee → #0891b2    (cyan)
cdn          #7dd3fc → #0284c7    (sky)
dns/internet #cbd5e1 → #64748b    (slate-grey)
lb           #94a3b8 → #475569    (slate)
analytics    #f9a8d4 → #db2777    (pink)
search       #fb7185 → #e11d48    (rose)
worker       #bef264 → #65a30d    (lime)
mr           #c4b5fd → #7c3aed    (violet)
process      #fde68a → #d97706    (amber)
note         #fef3c7 → #fde68a    (yellow)
class        #818cf8 → #4f46e5    (indigo)
actor        #fbcfe8 → #ec4899    (pink)
plain        #f1f5f9 → #e2e8f0    (neutral)
```

## Defining a custom kind

```js
Quickagram.THEMES.lambda = {
  top: '#fbbf24', bot: '#d97706', border: '#92400e',
  shape: 'rect', icon: 'gear',
  dashed: false,
};
// then use it normally
{ id: 'fn', kind: 'lambda', label: 'thumbnailFn', x: 0, y: 0 }
```

## Custom shapes

```js
Quickagram.SHAPES.diamond = (w, h) =>
  `M ${w/2} 0 L ${w} ${h/2} L ${w/2} ${h} L 0 ${h/2} Z`;
Quickagram.THEMES.decision = {
  top: '#fef3c7', bot: '#fbbf24', border: '#92400e', shape: 'diamond',
};
```

Shape generators receive `(width, height)` and return an SVG path `d` string. Origin is the node’s top-left corner.

## UML class (`kind: 'class'`)

```js
{
  id: 'User', kind: 'class', label: 'User',
  x: 0, y: 0, w: 240,
  attrs:   ['+ id: UserId', '- name: String', '- email: String'],
  methods: ['+ login()', '+ logout()', '+ rename(n: String)'],
}
```

The header band uses the indigo theme; the body is white with monospace text. The horizontal divider between attributes and methods appears automatically when both arrays are non-empty. Height is computed; `h` is ignored.
