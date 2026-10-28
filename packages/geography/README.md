# @uk-data-atlas/geography

Geography code shared by the atlas and the API: the area lineage, the ward,
parish and LSOA containment file formats, geometry substitutions and grid
offset corrections.

It holds code only. It reads no files and knows no paths: each consumer loads
its own data (the API its full build, the atlas its locally compiled projections) and
passes it in. That keeps it safe to bundle into the browser.

The tsconfig enforces most of this. It has no DOM or Node types, so
`node:fs` and `window` fail to typecheck, and no path aliases, so the atlas's
`@/` imports fail too. Import it by name, never by a relative path:

```ts
import { followLineage } from "@uk-data-atlas/geography";
```

Coordinate parsing and conversion are available from `@uk-data-atlas/geography/coordinates`. The module accepts WGS 84, British National Grid and Irish Grid coordinates, and point lookup results name the transformation used for projected inputs. It also converts supported geometries and packed geometries to WGS 84.

Run `pnpm --filter @uk-data-atlas/geography typecheck` after changing it.
