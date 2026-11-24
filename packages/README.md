# Packages

Shared code for the atlas, the API and the pipeline. Each package exports
TypeScript source and is imported by its `@uk-data-atlas/` name. There is no
build step.

## Layers

A package may import only packages in a lower layer. Packages that share L0
are the exception: they sit on the same layer but import none of each other.
`tests/packages/packageLayers.test.ts` enforces this against each manifest and
each source import.

| Layer | Package         | Purpose                                                          | Runs in              |
| ----- | --------------- | ---------------------------------------------------------------- | -------------------- |
| L0    | `geography`     | Area codes, kinds, coordinates and geometry primitives.          | Browser and Node     |
| L0    | `artifacts`     | Content hashing and CSV, Parquet and SQLite file formats.        | Node                 |
| L0    | `datasets`      | Declares datasets and compiles their contents.                   | Browser and Node     |
| L1    | `atlas-db`      | Opens atlas.sqlite, resolves data file locations, search indexes | Node, `./search` too |
| L2    | `geometry`      | Stores, loads and queries area geometry, tiles and terrain.      | Node, tiles in both  |
| L3    | `areas`         | Looks up, resolves, searches and loads boundaries for areas.     | Node                 |
| L4    | `relationships` | Crosswalks between areas and translation of values across them.  | Node                 |
| L5    | `measures`      | Measure definitions, quality, reconciliation and unit conversion | Node                 |
| L6    | `catalogue`     | The catalogue of boundaries, units, corrections and place facts. | Browser and Node     |
| L7    | `places`        | Named places, the gazetteer, postcodes and place membership.     | Node                 |
| L8    | `atlas-loader`  | Loads a complete atlas release by wiring the domain packages.    | Node                 |

`atlas-loader` is the composition root. Nothing imports it, and it holds only
the loaders and the resolvers that need several domains at once.

Browser-safe packages (`geography`, `datasets`, and the browser entries of
`catalogue` and `geometry/tiles`) import no `node:*` module and no Node-only
package.

## Subpath entries

Entries are listed in each `package.json` under `exports`. Wildcard exports are
not allowed. The `geometry` package holds `./shapefile`, `./tiles`,
`./tiles/node`, `./tiles/featureIds` and `./terrain`. The `atlas-db` package
holds `./search` and `./search/node`. The `places` package holds `./postcodes`.

## When to create a package

Create a package only when the code has one of these:

- a different runtime target, such as browser against Node;
- a different set of consumers from every existing package;
- clearly separate ownership.

Otherwise add it as a subpath export of the package it belongs to, in its own
folder under `src/`, and give it a layer by that package. A new package needs a
layer in the table above, and it may import only lower layers.
