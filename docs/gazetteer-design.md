# Gazetteer: the website's location registry

Status: **in use** (revised 2026-09-27). The website reads named locations,
area extents and the constituency/LAD crosswalk from the gazetteer. The other
location lookups it proposed to absorb have since become precompiled artifacts
of their own (section 3). This revision records what was built, what the
original design got right, and what is still worth doing (section 9).

## 1. Scope: the website, not the API

The gazetteer is a **browser-side projection** of UK geography, shaped around
the boundary releases, code mappings and crosswalks the map needs. It is not
the canonical geography source. That role belongs to the API's own geography
compiler (`api/README.md`, "API-owned geography compiler and completeness",
served by `GeographyResolver` in `api/src/geographyResolver.ts`), which compiles
complete, release-aware areas, relationships, crosswalks, place definitions,
spatial indexes, change events and coverage reports from the raw releases.

The two meet in one place today: `api/scripts/build-named-locations.ts` reads
the curated named locations from this project's `gazetteer.core.json`. Section
9.5 argues that dependency should eventually point the other way.

## 2. The original problem, and how it was resolved

Location knowledge was spread across three overlapping modules, each rebuilt in
the browser from megabytes of boundary geometry on every load:

- `LOCATIONS` (`lib/data/locations.ts`): named area to LAD codes and a bounding
  box.
- `areaBank` (`lib/data/areaBank.ts`): per `(level, year)` code sets and
  `name -> code` maps for matching uploaded CSV columns.
- `codeMapper` (`lib/data/boundaries/codeMapper.ts`): ward/LAD nesting,
  constituency/ward membership and cross-year code equivalence.

The runtime cost is gone, but not by folding everything into one registry as
first planned. Each lookup is now **precompiled at build time** into its own
artifact and the old modules read those artifacts:

| Concern                        | Before                           | Now                                                 |
| ------------------------------ | -------------------------------- | --------------------------------------------------- |
| Named locations, extents       | `LOCATIONS` at runtime           | gazetteer core (`membersOf`, `boundsOf`)            |
| Upload column matching         | `buildAreaBank` from geometry    | `gazetteer.matchindex.json` into `areaBank`         |
| Ward/LAD, cross-year codes     | derived from geometry in browser | `boundary-mappings.json` into `codeMapper`          |
| LSOA to LAD                    | named-location boxes             | `lsoa-lad-mappings-<year>.json`                     |
| Constituency to LAD membership | ward centroid point-in-polygon   | `constituency-lad-overlaps.json` crosswalk          |
| How a family scopes a location | per-consumer type switches       | `BOUNDARY_CAPABILITIES` (`boundaries/capabilities`) |

`LOCATIONS` survives only as the build-time curated source for the gazetteer
loader; no runtime code imports it. `areaBank` and `codeMapper` survive as thin
readers over precompiled data, which is why migrating them into the `Gazetteer`
class (old Phases 4 and 5) is no longer worth doing for its own sake.

Two runtime geometry paths remain: `deriveBoundaryMappings`
(`boundaries/mappingSeeder.ts`), a fallback for a CDN revision without
`boundary-mappings.json`, and `polygonAreaSqKm` in `boundaries/derived.ts` for
population density (section 9.4).

## 3. Artifacts

All live in `public/data/datasets/`. Sizes as of 2026-09-27.

| Artifact                         | Built by                          | Loaded                                  | Size (raw / gz) |
| -------------------------------- | --------------------------------- | --------------------------------------- | --------------- |
| `gazetteer.core.json`            | `precompile-data.mts`             | **bundled** (`gazetteer/static.ts`)     | — / 53 KB       |
| `constituency-lad-overlaps.json` | `scripts/gazetteer-crosswalks.ts` | on demand, constituency location filter | 305 KB / 44 KB  |
| `gazetteer.matchindex.json`      | `precompile-data.mts`             | on demand, when the upload panel opens  | 4.5 MB / 923 KB |
| `boundary-mappings.json`         | `precompile-data.mts`             | every `/atlas` load; workers on demand  | 2.0 MB / 355 KB |
| `lsoa-lad-mappings-<year>.json`  | `precompile-data.mts`             | on demand, LSOA location filter         | small           |

**Core contents.** 361 LADs (2025) plus 45 superseded 2016 and 2 2024 LADs that
named locations still reference, 650 constituencies (2024), the 9 English
regions, 162 named locations and 936 indexed names. `version` is
`GAZETTEER_VERSION` (currently 1).

**Crosswalk.** Constituency to 2025 LAD, one table per served constituency
release (eight, 2016-12 to 2024-07), covering all 650 constituencies. Weights
are **residents**-weighted over UK-wide building blocks, except in Northern
Ireland, where they are area-weighted (section 9.6); the file's `weighting`
field says which. The app reads only membership from it today; the weights
matter once values are apportioned (9.8).

**Year masks.** The match index and the cross-year parts of the boundary
mappings store each code, name or target once with a bit mask of the vintages
it holds in (bit `i` is `years[i]`), instead of repeating near-identical lists
per vintage. Parsers expand them back to the per-year shape callers use. This
cut the match index from 3.1 MB to 906 KB gz and the mappings from 643 KB to
287 KB gz (355 KB since constituency membership covers every ward release,
9.3). The mappings file is `version: 3`; an older file is rejected and the
seeder falls back to deriving mappings from geometry.

## 4. Design principles that held

These parts of the original design proved right and still guide changes.

- **Separate layers by size and volatility.** Registry, geometry and postcodes
  stay apart. The gazetteer references geometry by `(level, year)` and never
  embeds it; full postcodes never ship to the browser (the API serves them).
- **Bundle the eager core; fetch the rest.** The core is needed synchronously at
  map mount and in non-React modules, so it is imported, not fetched. Anything
  larger is fetched only when the feature that needs it is used.
- **Membership and apportionment are different questions.** Non-nesting
  relations (constituency/LAD) and boundary reviews are many-to-many and live in
  weighted crosswalks. `parents` only encodes clean nesting.
- **Derive weights at build time; never ship the building block.** Phase 0
  measured an OA-level table at about 2.9 MB gz. Per-relation crosswalks are
  tens of KB. The building block is a build input only.
- **Apportion only extensive values.** Rates, medians and densities apportion
  numerator and denominator separately, then divide; never the ratio.
- **Area, population and density have different natures.** Area is intrinsic
  per vintage and belongs on the entry (`areaM2`); population is a dataset,
  referenced; density is derived and stored nowhere.
- **Surface ambiguity, don't guess.** Names collide ("Castle", "Newcastle",
  "St Albans"). Name resolution returns candidates, and an unresolved name is a
  reported outcome. `Gazetteer.resolveName` does this, and so does upload
  matching (section 9.1).
- **Point-to-area is its own capability.** Crosswalks convert area to area.
  Coordinate to containing area is separate; the API's spatial indexes own it.
- **Validate at build.** `gazetteer/validate.ts` fails the build on unknown
  parents, dangling name-index codes or named locations that disagree with
  `LOCATIONS`, and reports curation debt as warnings.

### 4.1 Lesson: multi-vintage member lists are load-bearing

`LOCATIONS` lists region members across several LAD vintages on purpose.
`"North West"` carries both the six abolished Cumbria districts
(`E07000026-31`) and the two unitaries that replaced them (`E06000063/64`),
because pre-2023 wards carry the old district codes and 2023+ wards the new
ones, and wards are filtered by parent LAD. Only one ward vintage is active per
dataset, so the live app never double-counts. The bug was in the gazetteer,
which summed region area across all vintages (20,911 against about
14,100 km²); area now rolls up over the current LAD vintage only. The dual codes
looked like debt but were load-bearing: verify before "fixing" source data.

## 5. Data model as built

```ts
// lib/data/gazetteer/types.ts
type Level =
	| "region"
	| "county"
	| "localAuthority"
	| "constituency"
	| "ward"
	| "lsoa"
	| "dataZone"
	| "superOutputArea";

interface GazetteerEntry {
	code: string;
	name: string;
	level: Level;
	vintage: number;
	areaM2: number;
	bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
	parents: string[]; // clean-nesting parents only
}

interface GazetteerCore {
	version: number;
	byCode: Record<string, GazetteerEntry>;
	nameIndex: Record<string, string[]>; // lowercased name -> codes
	namedLocations: Record<string, { memberCodes: string[]; bbox: Bbox }>;
}

type Crosswalk = Record<string, Array<{ code: string; weight: number }>>;
```

Only `region`, `localAuthority` and `constituency` entries exist. The other
levels are declared but unpopulated; section 9.7 recommends against filling
them. Proposed fields that were never needed (`children`, `aliases`,
`refPopulation`, `geometryRef`, `successors`) have been left out.

## 6. Runtime API as built

`Gazetteer` (`lib/data/gazetteer/gazetteer.ts`), available as the bundled
singleton `gazetteer` from `lib/data/gazetteer/static.ts`:

| Method                                         | Answers                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `get(code)`, `areaM2(code)`, `bboxOf(code)`    | one entry and its intrinsic attributes   |
| `resolveName(name, level?)`                    | every candidate for a name               |
| `namedLocations()`, `namedLocation(name)`      | the curated composites                   |
| `membersOf(name)`, `boundsOf(name)`            | a composite's LAD codes and extent       |
| `ancestors(code)`, `descendants(code, level?)` | the clean-nesting hierarchy              |
| `overlaps(code, targetLevel)`                  | crosswalk membership with weights        |
| `apportion(values, fromLevel, targetLevel)`    | extensive values re-aggregated by weight |

Proposed but not built, and no longer planned in the gazetteer: `matchColumn`
(upload matching reads the match index directly), `mapToVintage` (served by
`codeMapper.getCodeForYear` over `boundary-mappings.json`), and
`population` / `density` (section 9.4).

## 7. Datasets and location scoping

The proposed `DatasetManifest` was largely realised under other names:

- `DatasetDefinition` and its `DatasetIngestionContract`
  (`lib/data/catalog/types.ts`) declare each dataset's geography, source and
  payload layout, and `DatasetLocationScope` covers datasets keyed by another
  geography (`kind: "mapped"`).
- `BOUNDARY_CAPABILITIES` declares how each boundary family reduces to a named
  location: `direct-membership` (LAD), `parent-map` (ward and LSOA via LAD),
  `crosswalk` (constituency), `bbox` (data zone, SOA) or `none`.
  `datasetLocationFilter.ts` and the boundary worker read it instead of
  switching on type names.

Not realised: declaring whether a value is extensive or intensive, with
numerator and denominator for the latter. That is the one manifest field
`apportion` needs before it can be used on real datasets (section 9.8).

## 8. Phase 0 measurements (historical)

Measured from real UK boundaries with `scripts/gazetteer-phase0.ts` before
anything shipped. They settled the build-time crosswalk decision:

| Artifact                                             | Ships?          | Size (gz)                     |
| ---------------------------------------------------- | --------------- | ----------------------------- |
| Core: 361 LADs + 650 constituencies, `areaM2` + bbox | yes             | 37 KB                         |
| Constituency to LAD crosswalk (one release)          | yes             | 5 KB                          |
| LSOA building-block table (34,753 rows)              | no, build input | 446 KB; ~2.9 MB at OA (~230k) |

227 of 574 constituencies spanned more than one LAD, every crosswalk's weights
summed to 1 within tolerance, and 34,738 of 34,753 LSOAs assigned cleanly.

## 9. What is left, in priority order

### 9.1 Same-named areas on upload (done for wards; parishes remain)

Uploads keyed by area name are joined through `gazetteer.matchindex.json`
(`lib/data/custom/import.ts`). The index used to keep one code per name per
vintage, so a shared name silently landed on whichever area was built last:

| Geography (vintage) | Shared names | Areas behind them |
| ------------------- | ------------ | ----------------- |
| ward (2026)         | 274          | 752 (9%)          |
| parish (2026)       | 575          | 1,443 (14%)       |
| LAD, constituency   | 0            | 0                 |

Fixed on 2026-09-27:

- The index keeps every code for a name, and the parent authority of every
  code behind a shared name (ward parents from the release, falling back to
  `wardToLad`; 2,098 wards, 10 KB gz).
- A row whose name is shared is **left off the map**, never guessed, and the
  upload form says which names and how many rows before it is applied.
- An optional local authority column, picked or guessed from its header and
  given as a code or a name from any vintage, settles a shared name when
  exactly one of its wards sits in that authority.
- When several vintages match a column equally, the newest is chosen; before,
  a column of current ward names was read as 2011 wards.

**Remaining:** parish releases publish no parent, so shared parish names are
reported but cannot yet be settled. They need a parish -> LAD source: the ONS
parish lookup, fetched like other lookups, or containment against LAD geometry
at build, as `lsoa-lad-mappings` already does.

### 9.2 Build every lookup in one place (done)

The match index used to be built by a standalone script and went stale that
way: 22 catalogue releases (LSOA 2021, LAD 2026 among them) were unmatchable
until 2026-09-27. It is now built by `precompile-data.mts`
(`lib/data/gazetteer/matchIndex.ts`), straight after the boundary mappings it
takes ward parents from.

The constituency/LAD crosswalk stays a separate script
(`scripts/gazetteer-crosswalks.ts`) because it is expensive and changes only
with boundaries. `tests/data/compiledBoundaryAssets.test.ts` fails if either
artifact drifts from the catalogue: the match index must cover every served
vintage, and the crosswalk must have a table for every served constituency
release and target the served 2025 LAD release. (Every served release has a
table; the catalogue's 2010 and 2015 constituency years map onto them.)

### 9.3 Constituency/ward membership (done)

Charts sum a ward dataset into the constituency a reader selects, on the
dataset's own ward release. Membership used to exist for the latest ward
release only, placing each ward by the average of its outline's vertices, so:

- every ward dataset (local elections 2016-2025, house prices 2021, population 2023) showed "No data available" for any constituency;
- even for the latest release, about 180 wards fell in no constituency (their
  vertex average lay outside every polygon) and about 1% were misplaced.

Fixed on 2026-09-27. Membership is built for every ward release, against one
release of each constituency code set (2010 and 2024), and each ward goes to
the constituency holding most of it, sampled on an 8x8 grid. A ward that
straddles a boundary is counted once, so ward values sum to constituency
totals. Against the ONS ward/constituency lookups it agrees on 99.94% (2024
and 2025 wards) and 99.99% (2022 wards) of wards ONS places in a single
constituency, and places every ward.

The ONS lookups were used to measure, not as the source: they are published
for only some ward releases (none for 2011, 2015, 2021 or 2026), and list a
straddling ward under every constituency it touches, which would double-count.

### 9.4 Density from precompiled area (not worth doing)

The premise was wrong. Charts already read `areaSqKm` from each release's
properties sidecar, which `scripts/compile-boundaries.mts` computes from the
finished topology, and composite density already sums populations and areas
separately (`helpers/populationDensity.ts`). Only the map's density layer
measures rings in the browser, for the one release it draws: 30-100 ms once,
cached, agreeing with the sidecar to 0.00005%. Shipping the value in the
TopoJSON would add about 8 KB per ward file to every map download to save
that, so it stays as is.

### 9.5 Reverse the dependency on the API

The API's named locations are compiled from this project's
`gazetteer.core.json`, whose composites come from the hand-curated
`lib/data/locations.ts` (about 1,500 lines). The API already models sourced,
versioned place definitions. The sturdier direction is for the API to own place
definitions (from ONS combined-authority and ceremonial-county lookups where
they exist, explicitly curated where they don't) and for the gazetteer core to
be built from the API's output. Open question: do that, or keep `LOCATIONS` as
the source for both and document why.

### 9.6 Population-weighted, UK-wide crosswalk (done)

Fixed on 2026-09-27. The constituency/LAD crosswalk was area-weighted over 2011
LSOAs, which cover England and Wales only, so:

- Scottish and Northern Irish constituencies were absent, and a constituency
  dataset filtered to any of the 27 named locations there (Glasgow, Edinburgh,
  Belfast, the Highlands, ...) drew nothing;
- its point-in-polygon test ignored holes, so Warwick and Leamington, which
  Kenilworth and Southam surrounds, got no building blocks and was absent too;
- a rural authority with most of a constituency's land but few of its
  residents took most of its weight.

The building blocks now cover the UK, each nation weighted by the best measure
in `data/`: Census 2021 usual residents by 2021 LSOA (England and Wales), SIMD
2020 total population by 2011 data zone (Scotland), and area by 2011 SOA
(Northern Ireland, which has no small-area population source here yet; adding
one is a data change, not a code one). The file records this in `weighting`.
Membership in England and Wales is unchanged apart from Warwick and
Leamington; 143 of the 2024 weights moved by more than 20 points, as with
Dagenham and Rainham, where Havering's share falls from 66% to 39%.

### 9.7 Not worth doing any more

- **Ward, LSOA, data-zone and SOA entry shards.** The match index and boundary
  mappings already cover what the browser needs at those levels.
- **Folding `areaBank` and `codeMapper` into `Gazetteer`.** They read
  precompiled data now; moving them would be churn without a runtime gain.
- **Nations and a county tier as gazetteer regions**, unless a feature needs
  them. Nations are already named locations and are filtered by code prefix.
- **Postcodes in the browser.** The API serves postcode lookup
  (`api/src/postcodeAreas.ts`).

### 9.8 Extensive and intensive values (already owned by the API)

Nothing to add here. The API's data catalogue already declares how every
measure it serves may be combined (`aggregation.kind` in
`api/src/dataCatalog.ts`): of 228 measures, 180 extensive, 31 intensive with
their weighting denominator, 15 non-aggregatable (medians, ranks, deciles) and
2 categorical, and its conversion routes refuse anything but extensive. A second
classification on the website's `DatasetDefinition` would be a second source
of truth to drift. `Gazetteer.apportion` has no callers; its comment now says it
is only valid for measures the API classifies as extensive.

### 9.9 Smaller items

- Drop the `deriveBoundaryMappings` geometry fallback once every deployed
  revision serves version 2 mappings; it is the last runtime rebuild of lookups
  from geometry.
- `LOCATIONS` still produces validation warnings for members that predate the
  served LAD releases. Recode or retire them.
- `Level` declares levels the core never holds. Narrow it when 9.7 is settled,
  so the type says what the artifact contains.
