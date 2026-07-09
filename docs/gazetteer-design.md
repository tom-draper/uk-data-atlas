# Gazetteer: a canonical location registry

Status: draft / design. No code yet. This document proposes consolidating the
app's scattered location logic into one precomputed registry so that adding a
new dataset stops requiring us to re-solve "what geography is this?" every time.

## 1. Problem

Every dataset arrives keyed by some geography (LAD, ward, constituency, LSOA,
police force area, ...) at some vintage (2011 census, 2021 census, a boundary
review year). Today the knowledge needed to place that data on the map is spread
across three modules that overlap and are each rebuilt in the browser from
loaded geometry:

- **`lib/data/locations.ts`** (`LOCATIONS`): named area (`"Greater Manchester"`,
  `"Cheshire"`, nations) to its constituent `lad_codes` plus a bounding box.
- **`lib/data/areaBank.ts`** (`buildAreaBank`): per `(level, year)` sets of codes
  and `name -> code` maps, built at load time from boundary GeoJSON. Used to
  match uploaded CSV columns to a geography.
- **`lib/hooks/useCodeMapper.ts`**: hierarchy relations (ward to LAD, ward to
  constituency, LAD to wards) and cross-year code equivalence, also derived from
  geometry.

Consequences:

- Three structures encode overlapping facts; none is the source of truth.
- All three are rebuilt client-side from megabytes of geometry on every load.
- Onboarding an "obscure" dataset means re-deriving its level, matching its
  codes/names, and reconciling its vintage by hand.

## 2. Goals / non-goals

**Goals**

- One canonical, precomputed registry of UK areas: code, name, level, vintage,
  hierarchy (parents/children), name aliases, and bounding box.
- Make dataset onboarding declarative: state the level + code/name column, and
  location scoping, roll-up aggregation, name matching, and boundary loading all
  derive from the registry.
- Be smaller and cheaper than today (one lookup artifact vs. three in-browser
  rebuilds from geometry).

**Non-goals**

- Storing boundary geometry inside the registry (it stays lazy-loaded, see 4.2).
- A full client-side postcode database (infeasible, see 4.3).
- Eliminating one-time work for non-standard geographies (inherent, see 8).

## 3. Three layers, deliberately separated

The single biggest design decision: do **not** build one monolith. Split by
size and volatility.

| Layer | What | Size | Where it lives |
|-------|------|------|----------------|
| **Gazetteer** | code / name / level / vintage / hierarchy / bbox | small (~MBs, compresses well) | precomputed artifact, loaded once |
| **Geometry** | boundary polygons | large (MBs per level per year) | lazy-loaded by `(level, year)` key, unchanged from today |
| **Postcodes** | ~1.7M postcode -> area | ~1GB (ONSPD) | out of the browser: server-side, or district-level only, or centroid index |

The gazetteer *references* geometry by key; it never embeds it. Postcodes are a
separate subsystem the gazetteer links to at district granularity at most.

## 4. Data model

### 4.1 Gazetteer entry

```ts
type Level =
  | "region" | "county" | "localAuthority" | "constituency"
  | "ward" | "lsoa" | "dataZone" | "superOutputArea";

interface GazetteerEntry {
  code: string;              // canonical ONS code, e.g. "E08000003"
  name: string;              // canonical name, e.g. "Manchester"
  level: Level;
  vintage: number;           // boundary year this code belongs to, e.g. 2023
  parents: string[];         // codes one level up (LAD -> county, region)
  children?: string[];       // optional; can be derived from parents instead
  aliases?: string[];        // lowercased name variants for matching
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  // Geometry is referenced, never embedded:
  geometryRef?: { level: Level; year: number }; // where to lazy-load the polygon
  successors?: Record<number, string>; // vintage -> code, for cross-year mapping
}
```

### 4.2 Geometry stays external

`GEOJSON_PATHS` (in `boundaries.ts`) already keys geometry by `(level, year)` and
`useBoundaryData` lazy-loads it. That stays. The gazetteer only holds
`geometryRef` so a consumer knows *which* file to fetch for a given code. No
change to how or when polygons load.

### 4.3 Postcodes

Not in the in-memory gazetteer. Options, in preference order:

1. **Postcode district** (`M1`, `SW1A`) only, small enough to ship, links to LAD.
2. **Server-side full-postcode lookup** (API endpoint over ONSPD).
3. **Compressed centroid index** if we ever need full-postcode client-side.

The current `areaBank` already distinguishes `postcode-full` /
`postcode-district` match types and marks them "coming soon"; this is where that
resolves.

## 5. Source data

The registry is not invented, it is compiled from ONS lookup tables (the
authoritative "central bank"):

- Ward -> LAD -> County -> Region lookups.
- LSOA -> Ward -> LAD lookups.
- Westminster constituency lookups (incl. the 2010->2024 boundary change lookup
  already present under `data/boundaries/constituencies/`).
- Names come from the same lookups; bboxes are computed once from geometry at
  build time.

These are small CSVs. We download them into `data/gazetteer/` like any other
source dataset.

## 6. Build pipeline

Add a `loadGazetteer()` step to `scripts/precompile-data.ts`, mirroring the
existing loaders:

1. Read the ONS lookup CSVs from `data/gazetteer/`.
2. Read boundary GeoJSON once to compute per-code bounding boxes.
3. Emit `data/gazetteer/gazetteer.json` (and the `public/` mirror) as:
   - `byCode: Record<string, GazetteerEntry>`
   - `nameIndex: Record<string /*lowercased name|alias*/, string[] /*codes*/>`
   - `namedLocations: Record<string, { memberCodes: string[]; bbox: [...] }>`
     (this replaces `LOCATIONS`)

Precompute once at build, not per browser session. This is the efficiency win.

## 7. Runtime API

A single module `lib/data/gazetteer.ts` (loaded via a hook like the other
precompiled datasets) supersedes `LOCATIONS`, `areaBank`, and `codeMapper`:

```ts
interface Gazetteer {
  get(code: string): GazetteerEntry | undefined;
  resolveName(name: string, level?: Level): GazetteerEntry[]; // alias-aware
  ancestors(code: string): GazetteerEntry[];  // up the hierarchy
  descendants(code: string, level: Level): GazetteerEntry[]; // e.g. LAD -> wards
  mapToVintage(code: string, targetYear: number): string | undefined;
  membersOf(named: string): string[];         // "Greater Manchester" -> codes
  boundsOf(named: string): [number, number, number, number];
  matchColumn(values: string[]): AreaMatch[];  // subsumes areaBank matching
}
```

Method-by-method, this is a strict superset of what the three current modules
expose, so migration is mechanical (see 9).

## 8. Dataset manifest

Once the gazetteer exists, a standard-geography dataset declares itself:

```ts
interface DatasetManifest {
  id: string;
  level: Level;
  vintage: number;
  join: { by: "code"; column: string } | { by: "name"; column: string };
  valueColumns: string[];
}
```

The loader then joins rows to the gazetteer generically: location scoping (which
members fall in the selected named location), roll-up aggregation (sum/average up
`parents`), name matching, vintage reconciliation, and boundary selection all
come from the registry. The bespoke per-dataset location code largely disappears.

**Limit (honest):** this only trivialises datasets on *standard ONS
geographies*. Non-standard ones (police force areas, NHS trusts, travel-to-work
areas, water companies) still need a **one-time** mapping into the hierarchy,
added as extra `Level`s or crosswalk tables. The gazetteer shrinks repeat work;
it does not abolish bespoke geographies.

## 9. Migration: folding in the three modules

| Today | Folds into |
|-------|-----------|
| `LOCATIONS` (named -> lad_codes + bounds) | `namedLocations` + `membersOf` / `boundsOf` |
| `areaBank` (code sets, name->code, matching) | `nameIndex` + `matchColumn` |
| `codeMapper` (ward↔LAD↔constituency, cross-year) | `parents`/`children` + `ancestors`/`descendants` + `successors`/`mapToVintage` |

Do it incrementally: build the gazetteer artifact first, wrap the new API around
it, then migrate call sites one module at a time behind the existing interfaces
(`CodeMapper`, `AreaBank`) so nothing breaks in one big bang. Delete the old
modules once their call sites are gone.

## 10. Concrete wins, measured against recent work

- The road-safety points scoping we just shipped uses a **bounding box** filter.
  With the gazetteer plus the DfT `local_authority_ons_district` column, points
  could scope to actual LAD membership within a named location instead of a
  rectangle.
- Adding the next choropleth on a standard geography becomes: drop the CSV,
  write a manifest, done. No new location wrangling.

## 11. Open questions

- **Hierarchy across census vintages.** LSOA/ward boundaries change between 2011
  and 2021; `parents`/`successors` must be vintage-aware. `codeMapper` already
  does cross-year mapping we can lift.
- **Children storage.** Store `parents` only and invert at load, or precompute
  `children` too? Inverting is smaller on disk; measure.
- **Nation coverage.** England/Wales use LSOA, Scotland data zones, NI SOAs. The
  `Level` union already reflects this; the lookups differ per nation.
- **Artifact size budget.** Target: gazetteer JSON materially smaller than the
  sum of geometry we currently parse client-side to derive the same facts.

## 12. Phased rollout

1. Compile `gazetteer.json` from ONS lookups + computed bboxes; ship it, unused.
2. Add `lib/data/gazetteer.ts` + hook; validate against current `LOCATIONS` /
   `areaBank` / `codeMapper` outputs (they must agree).
3. Migrate `LOCATIONS` consumers to `membersOf`/`boundsOf`.
4. Migrate `areaBank` (custom upload matching) to `matchColumn`.
5. Migrate `codeMapper` consumers to `ancestors`/`descendants`/`mapToVintage`.
6. Introduce `DatasetManifest`; convert one existing dataset as the reference.
7. Delete superseded modules.
8. Postcodes: separate track, district-level first.
