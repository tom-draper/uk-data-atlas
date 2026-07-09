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
| **Gazetteer** | code / name / level / vintage / hierarchy / bbox / areaM2 | small at coarse levels, large at OA + crosswalks | precomputed artifact, **sharded** (see 3.1) |
| **Geometry** | boundary polygons | large (MBs per level per year) | lazy-loaded by `(level, year)` key, unchanged from today |
| **Postcodes** | ~1.7M postcode -> area | ~1GB (ONSPD) | out of the browser: server-side, or district-level only, or centroid index |

The gazetteer *references* geometry by key; it never embeds it. Postcodes are a
separate subsystem the gazetteer links to at district granularity at most.

### 3.1 Sharding and the size budget

"Loaded once, small" is the load-bearing claim of this whole design and must be
proven, not assumed. Coarse levels are genuinely small, but the crosswalks are
not obviously so: an OA-level table (~200k OAs times their targets) can dwarf the
rest. If the artifact is one eager blob, startup could end up *worse* than today,
which would defeat the point.

So the gazetteer is **sharded and lazy-loaded, not one blob**:

- **Eager core:** region / county / localAuthority / constituency entries plus
  named composites. Small, needed for the location list and most datasets.
- **On-demand shards:** ward / LSOA / dataZone / SOA / OA entries and their
  crosswalks, fetched by `(level, vintage)` exactly like geometry, only when a
  dataset or query at that level is active.
- **Hard budget with fallback:** each shard has a stated size ceiling. If the OA
  crosswalk exceeds it, fall back to per-relation crosswalks (constituency->LAD,
  vintage->vintage) computed at build instead of the universal OA table (4.4).

Pinning this budget is a prerequisite for Phase 1; the efficiency argument is
only true if the sharded core is materially smaller than the geometry we parse
client-side today to derive the same facts.

### 3.2 Phase 0 measurements (decisive)

Measured from real UK boundaries (`scripts/gazetteer-phase0.ts`), gzipped since
that is what ships:

| Artifact | Ships? | Size |
|----------|--------|------|
| Eager core: 361 LADs + 650 constituencies, with `areaM2` + bbox | yes | **37 KB** |
| Constituency->LAD crosswalk (area-weighted via LSOA) | yes | **5 KB** |
| LSOA building-block table (34,753 rows) | no, build input | 446 KB, extrapolates to **~2.9 MB** at OA (~230k) |

Findings:

- **Shipped artifacts are trivial.** The eager core is tens of KB; a per-relation
  crosswalk is single-digit KB. Adding wards keeps the core comfortably under a
  few hundred KB.
- **Only the building-block table is large, and it never ships.** At OA scale it
  is ~2.9 MB, too heavy to send to the browser, but it is only needed at *build*
  time to derive weights (4.4). So the resolution is decided: **precompute
  per-relation weighted crosswalks at build; keep the OA/LSOA + population table
  build-time-only.** The "universal OA table at runtime" idea in 4.4 is dropped;
  the per-relation approach is the default, not a fallback.
- **The pipeline is validated.** 227 of 574 constituencies span more than one LAD
  (the many-to-many case is real, not theoretical), every crosswalk's weights sum
  to 1.0 within tolerance (0 violations, the 6.1 invariant holds), and 34,738 of
  34,753 LSOAs assigned cleanly.

Net: the size budget is met with margin and the weight derivation works on real
data, so Phase 1 is unblocked.

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
  areaM2: number;            // intrinsic geometry, per vintage (see 4.5)
  refPopulation?: number;    // canonical baseline for crosswalk weighting (4.5)
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

**Weights are usually derived, not read.** Most ONS lookups are *assignments*
("this OA belongs to that LAD"), not fractions. Real apportionment weights are
computed at build time from the building blocks:

```
weight(source -> target) = sum over OAs in (source ∩ target) of OA population
                           / sum over OAs in source of OA population
```

(swap OA population for OA area for exact-fit). This makes an **OA-level
population table a hard dependency of the whole conversion feature**, not an
optional nicety. If we choose not to ship that dependency, `apportion` degrades
to membership-only (overlap > 0, no fractions) and we drop the apportionment
accuracy claim. The design does not get weighted conversion "for free" from
published lookups.

**The general form (build-time, not runtime).** Conceptually every conversion is
the same operation over a universal building block: decompose the source to
Output Areas (the atom all standard geographies are best-fit aggregated from),
re-aggregate up to the target level/vintage, weighting by OA population. But
Phase 0 (3.2) measured the OA building-block table at ~2.9 MB gz, too heavy to
ship. So this decomposition happens **at build time only**: we run it once per
needed relation and emit a small per-relation crosswalk (5 KB gz for
constituency->LAD), which is what the browser loads. The OA/LSOA table and its
populations stay build inputs and never ship. This also replaces the runtime
`buildConstituencyWardMappings` (ward-centroid-in-polygon) with an exact,
precomputed crosswalk.

### 4.5 Attributes and derived metrics

Area, population, and density look similar but have three different natures, and
conflating them is the trap. They map onto the same "separate by size and
volatility" principle as the three layers in section 3.

| Value | Nature | Where it lives |
|-------|--------|----------------|
| Area m² | intrinsic geometry, per vintage | **in** the gazetteer (`areaM2`) |
| Population | volatile dataset, per year | stays a dataset, **referenced** via API |
| Density | derived | **computed** `pop / area`, stored nowhere |

- **Area** is a property of the boundary itself, changing only with vintage, so
  it belongs on the entry as `areaM2`. Today it is recomputed client-side from
  polygon rings (`polygonAreaSqKm` in `statsCalculator`); precomputing it at
  build time retires that path and supplies the denominator for area-weighted
  crosswalks (4.4).
- **Population** is dataset-sourced and time-varying; the population dataset stays
  its source of truth. The gazetteer *references* it (`population(code, year)`),
  and embeds only a single `refPopulation` baseline used as the weighting
  denominator for best-fit crosswalks. Composite locations ("Greater Manchester")
  derive their population by summing members (`membersOf`), never storing a
  per-composite figure.
- **Density is never stored.** It is `population / area`, and storing it invites
  drift from its inputs. Expose it as `density(code, popYear)`.

**Intensive-quantity rule (same as 4.4).** Density is intensive: for composites
and cross-vintage conversion, sum the numerator and denominator separately, then
divide, e.g. `GM density = sum(member populations) / sum(member areaM2)`, never
the mean of member densities. Population and area must share a vintage (or be
apportioned through a crosswalk) or the ratio is wrong; vintage-keying gives us
that for free.

### 4.6 Name matching and disambiguation

Names collide, so `nameIndex` maps `name -> codes[]` and `resolveName` /
`matchColumn` return candidates, never a single code. "Newcastle" (upon Tyne vs.
under Lyme), "St Albans" (city / district / constituency), and dozens of
duplicate ward names ("Castle", "Broadfield") are the norm, and resolving a
name-keyed dataset is exactly the ingestion pain this project exists to remove.
Disambiguation is a defined pipeline, not a guess:

1. **Level hint** from the dataset manifest narrows candidates to one level.
2. **Parent context**, if the dataset carries a coarser column (ward + its LAD),
   filters by hierarchy.
3. **Confidence scoring** over the whole column, the percentage match `areaBank`
   already does, picks the best-fitting `(level, vintage)`.
4. **Surface, don't guess.** An ambiguous name with no level hint is a
   first-class, reported outcome (unresolved rows listed), never silently
   assigned to the first candidate.

### 4.7 Point-to-area is a separate capability

Crosswalks convert *area to area*. They do **not** answer *coordinate to
containing area*, which is a different operation, and one we already need: the
road-safety points want "which LAD is this collision in?", and `codeMapper` does
runtime point-in-polygon for hover. This reverse-geocoding is called out
explicitly so it doesn't get quietly assumed into "conversions" and then be
missing.

Options: keep it a runtime concern (point-in-polygon against loaded geometry, as
today), or have the gazetteer own a coarse **spatial index** (e.g. a grid or
bbox tree over area centroids/bounds) for fast point -> area at a chosen level.
Decision deferred, but the capability is named and owned.

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
2. Read boundary GeoJSON once to compute per-code bounding boxes and `areaM2` in
   the same pass.
3. Derive crosswalk weights from OA population/area (4.4).
4. Emit **sharded** output (3.1) under `data/gazetteer/` (and the `public/`
   mirror):
   - `gazetteer.core.json`: eager coarse levels + `nameIndex` + `namedLocations`
     (replaces `LOCATIONS`), stamped with a `version`.
   - `gazetteer.<level>.<vintage>.json`: on-demand entry shards.
   - `crosswalk.<from>-<to>.json`: on-demand weighted crosswalks.

Precompute once at build, not per browser session. This is the efficiency win.

### 6.1 Validation (build-time invariants)

Bad ONS joins fail silently otherwise, so the build asserts a fixed set of
invariants and fails on violation:

- Every `parents` / crosswalk target code resolves to an entry.
- Crosswalk weights per source sum to 1.0 within ε.
- `membersOf(named)` equals today's `LOCATIONS` exactly (regression guard).
- `areaM2` rolls up parent-to-children within tolerance.
- No orphan codes; no duplicate `(code, vintage)`.
- **Every dataset manifest's `(level, vintage)` exists in the shipped gazetteer**,
  and its `minGazetteerVersion` is satisfied (see 6.2).

This suite is small and is the primary defence against silent geographic errors;
it is also the Phase 2 "must agree with current outputs" check made concrete.

### 6.2 Versioning

The artifact is regenerated over time (new ONS vintages, size trims), so a
dropped vintage could break a pinned dataset silently. The `core` artifact
carries a monotonic `version`; each `DatasetManifest` declares a
`minGazetteerVersion`; the validation suite (6.1) fails the build if any manifest
references a `(level, vintage)` the current gazetteer no longer contains.

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

  // Attributes / derived metrics (see 4.5).
  areaM2(code: string): number;                // intrinsic, from the entry
  population(code: string, year: number): number | undefined; // joins the dataset
  density(code: string, popYear: number): number | undefined; // pop / area, derived
  // Composite/aggregate variants sum numerator and denominator separately.

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
  minGazetteerVersion: number;   // compatibility floor (6.2)
  join: { by: "code"; column: string } | { by: "name"; column: string };
  levelHint?: Level;             // disambiguates name joins (4.6)
  // Extensive values apportion directly; intensive ones (rates, medians) must
  // declare numerator + denominator so we apportion those, not the ratio (4.5).
  valueColumns: Array<
    | { column: string; kind: "extensive" }
    | { column: string; kind: "intensive"; numerator: string; denominator: string }
  >;
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
- Population density stops recomputing polygon area in the browser
  (`polygonAreaSqKm`): `areaM2` is precomputed and `density()` derives from it,
  correct for composites via the intensive-quantity rule (4.5).

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
- **API load lifecycle.** With a sharded artifact (3.1) and `population()`
  joining a separately-loaded dataset, the API can't be fully synchronous. Decide
  the shape: a hook returning `{ ready, gazetteer }`, sync-after-ready for loaded
  shards, and async (or "undefined until loaded") for on-demand ones.
- **Named-composite curation.** "Greater Manchester" (combined authority),
  "Cheshire" (ceremonial county), London-borough grouping, these are partly
  editorial. Source from ONS combined-authority / ceremonial-county lookups where
  they exist; hand-list the rest and be explicit that set is curated.
- **Display vs. match names.** Preferred display label vs. the alias set used for
  matching, plus bilingual (Welsh) names. `name` + `aliases` covers matching;
  decide whether a separate `displayName` (and locale) is needed.

## 12. Phased rollout

0. **Prerequisites (DONE, see 3.2).** Measured real artifact sizes and validated
   weight derivation via `scripts/gazetteer-phase0.ts`. Outcome: eager core 37 KB
   gz, per-relation crosswalks single-digit KB, building-block table stays
   build-time-only (~2.9 MB at OA). Decision locked in: precompute per-relation
   crosswalks; do not ship the OA table. Budget met, pipeline validated.
1. Compile the **sharded** artifact (core + level/vintage + crosswalk shards)
   from ONS lookups, with bboxes and `areaM2` computed from geometry in the same
   pass; run the 6.1 validation suite; ship it, unused.
2. Add `lib/data/gazetteer.ts` + hook (with the load lifecycle from §11);
   validate against current `LOCATIONS` / `areaBank` / `codeMapper` outputs (they
   must agree, this is 6.1's regression guard).
3. Migrate `LOCATIONS` consumers to `membersOf`/`boundsOf`.
4. Migrate `areaBank` (custom upload matching) to `matchColumn`.
5. Migrate `codeMapper` consumers to `ancestors`/`descendants`/`mapToVintage`.
6. Introduce `DatasetManifest`; convert one existing dataset as the reference.
7. Delete superseded modules.
8. Postcodes: separate track, district-level first.
