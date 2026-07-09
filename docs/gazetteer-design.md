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
  // parents/children ONLY encode clean nesting (ward -> LAD -> county -> region;
  // LSOA -> LAD). Non-nesting relations (constituency <-> LAD) and boundary
  // reviews are many-to-many and live in weighted crosswalks instead (see 4.4).
  parents: string[];         // codes one level up in a nesting relation
  children?: string[];       // optional; can be inverted from parents at load
  aliases?: string[];        // lowercased name variants for matching
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  // Geometry is referenced, never embedded:
  geometryRef?: { level: Level; year: number }; // where to lazy-load the polygon
  // 1:1 vintage recodes only (an area recoded but geographically unchanged).
  // Boundary reviews that split/merge areas are crosswalks, not this (see 4.4).
  successors?: Record<number, string>; // vintage -> code, when 1:1
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

### 4.4 Conversions and crosswalks

Conversions are the highest-value thing the gazetteer unlocks, and they are
where the naive "clean hierarchy" model breaks. "Conversion" hides two very
different questions:

| | Question | What it needs |
|---|----------|---------------|
| **Membership** | which LADs does this constituency overlap? | overlap > 0 |
| **Apportionment** | this 2024 constituency's figure in 2019 boundaries? | area- or population-**weighted** split/merge |

`parents`/`successors` are scalars and can only answer membership for clean
nesting. Two situations need more:

- **Non-nesting relations.** Constituencies and LADs do not nest: a constituency
  spans several LADs, an LAD holds parts of several constituencies. This is a
  many-to-many overlap, not a hierarchy.
- **Boundary reviews.** The 2024 Westminster review redrew constituencies; a 2024
  constituency is stitched from pieces of several 2019 ones, so there is no
  single "2020 equivalent" code. Many-to-many again.

Both are modelled with a weighted crosswalk:

```ts
type Crosswalk = Record<
  string,                                  // source code
  Array<{ code: string; weight: number }>  // targets + share of source in each
>;
// weight = fraction of the source area's population (best-fit) or land area
// (exact-fit) that falls within each target.
```

From a crosswalk:

- **Membership** = targets with `weight > 0` (e.g. constituency -> overlapping
  LADs).
- **Apportionment** = `sum(source_value * weight)` accumulated into each target
  (e.g. re-express 2024 constituency values on 2019 boundaries). Only valid for
  *extensive* quantities (counts, populations); *intensive* ones (rates, medians)
  must apportion a numerator and denominator separately, never the ratio.

ONS publishes these as best-fit (population-weighted) and exact-fit
(area-weighted) lookups. The 2010->2024 constituency lookup already sits in
`data/boundaries/constituencies/`, which is exactly the 2025->2020 case.

**The general form.** Every conversion collapses to one mechanism if the
gazetteer records each area's membership in a universal building block. Output
Areas (OAs) are the atom that all standard geographies are best-fit aggregated
from. With OA-level membership, any query becomes: decompose the source to OAs,
re-aggregate up to the target level/vintage, weighting by OA population.
Constituency->LAD, 2025->2020, ward->region are then the same operation. Cost:
shipping an OA-level lookup (small as codes; OA geometry stays out per 4.2).
Today the app approximates the constituency->ward case at runtime with
`buildConstituencyWardMappings` (ward-centroid-in-polygon); precomputing OA
membership replaces that with an exact, build-time crosswalk.

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
  ancestors(code: string): GazetteerEntry[];  // up the nesting hierarchy
  descendants(code: string, level: Level): GazetteerEntry[]; // e.g. LAD -> wards
  membersOf(named: string): string[];         // "Greater Manchester" -> codes
  boundsOf(named: string): [number, number, number, number];
  matchColumn(values: string[]): AreaMatch[];  // subsumes areaBank matching

  // Conversions (see 4.4). Work across both non-nesting relations and vintages.
  mapToVintage(code: string, targetYear: number): string | undefined; // 1:1 only
  overlaps(code: string, targetLevel: Level, targetVintage?: number):
    Array<{ code: string; weight: number }>;   // membership + weights
  apportion(
    values: Record<string, number>,            // source code -> extensive value
    targetLevel: Level,
    targetVintage: number,
  ): Record<string, number>;                    // weighted re-aggregation
}
```

`overlaps` answers "LADs within a constituency" (`overlaps(pcon, "localAuthority")`
-> weighted list). `apportion` answers "2024 constituency values on 2019
boundaries". `mapToVintage` stays for the easy 1:1 recode case. Method-by-method
this is a strict superset of the three current modules, so migration is
mechanical (see 9).

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
| `codeMapper` nesting (ward↔LAD) + cross-year 1:1 | `parents`/`children` + `ancestors`/`descendants` + `mapToVintage` |
| `codeMapper` constituency↔ward (`buildConstituencyWardMappings`, point-in-polygon) | precomputed crosswalk + `overlaps` (see 4.4) |

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
- "LADs within a constituency" and "2025 constituency -> 2020 equivalent" become
  one-line calls (`overlaps` / `apportion`, see 4.4) instead of runtime
  point-in-polygon or bespoke per-case code.

## 11. Open questions

- **Hierarchy across census vintages.** LSOA/ward boundaries change between 2011
  and 2021; `parents`/`successors` must be vintage-aware. `codeMapper` already
  does cross-year mapping we can lift.
- **Children storage.** Store `parents` only and invert at load, or precompute
  `children` too? Inverting is smaller on disk; measure.
- **Nation coverage.** England/Wales use LSOA, Scotland data zones, NI SOAs. The
  `Level` union already reflects this; the lookups differ per nation.
- **Best-fit vs exact-fit crosswalks.** Population-weighted best-fit is smaller
  and fine for most choropleths; area-weighted exact-fit is more accurate but
  heavier. Start best-fit; allow exact-fit per relation where it matters.
- **OA lookup budget.** The universal-building-block approach (4.4) needs an
  OA-to-everything membership table. Codes only, but there are ~230k OAs; confirm
  the compressed size is acceptable before committing to it, else fall back to
  per-relation crosswalks (constituency->LAD, vintage->vintage) computed at build.
- **Intensive quantities.** `apportion` is only valid for extensive values.
  Datasets carrying rates/medians must declare a numerator + denominator so we
  apportion those, not the ratio. Reflect this in `DatasetManifest`.
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
