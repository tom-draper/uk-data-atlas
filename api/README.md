# UK Data Atlas API proposal

## Decision in brief

Build a public, versioned **data-and-geography API**, not an API that merely
serves the files currently used by the website. Its distinctive promise should
be:

> Ask for a documented public measure, a place, and a geography; receive data
> that is joined to an explicit boundary release, with the source, repair,
> transformation, coverage, and uncertainty visible in the response.

The hard-won asset is not a collection of CSVs. It is the maintained link
between source records, area identities, boundary vintages, crosswalks, and
human place names. A caller should not need to discover separately that a
Great Britain boundary file excludes Northern Ireland, that a ward release did
not include its LAD code, or that a dataset's codes belong to a different
boundary year.

The Atlas should be the source of a **reproducible answer**, not an opaque
source of apparently authoritative numbers.

This document proposes a public API at `https://api.ukdataatlas.com/v1`. It is
an implementation proposal, not a promise that every listed endpoint is ready.
The present `data/precompiled` files and browser-facing TopoJSON are internal
build products; their shape and filenames must remain free to change.

## Capability checklist

This is the practical product checklist. Status means the public API behaviour,
not merely that a website asset or source file happens to exist. A feature is
only **available** when its endpoint, contract and provenance are published.

| Status        | Meaning                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Available     | Implemented in the read-only v1 API today                                                            |
| Next          | Can be built from the API's current boundary and identity foundation                                 |
| Data required | Technically feasible, but needs a versioned authoritative source before it can be published honestly |
| Later         | Valuable, but deliberately outside the early public API                                              |

### Available now

- [x] Discover supported geographies and their boundary releases.
- [x] Inspect a boundary release's coverage, publisher, licence and metadata.
- [x] Retrieve an area identity when its geography, release and official code
      are known. Names and supplied Welsh aliases are returned where available.
- [x] Inspect the immutable Atlas release manifest, allowing a caller to cite
      the exact set of compiled artifacts behind a response.
- [x] List published crosswalks, inspect their method and validation, and page
      through their mappings.
- [x] Translate a 2010 Westminster constituency code to its 2024 successor
      mapping through the published official lookup.
- [x] Translate a May 2025 ward to its May 2025 local authority through a
      clean-containment crosswalk.

### Geography and place intelligence — next

- [ ] Search by official code, exact name, alias and name prefix. A bare code
      must return all plausible geography/release identities rather than guessing.
- [ ] List areas for a geography/release with pagination and filters.
- [ ] Resolve a canonical area page with validity, aliases, extent, provenance
      and links to geometry and relationships.
- [ ] Return parent and child areas: ward → local authority, local authority →
      wards, constituency → wards, and other documented containment relationships.
- [ ] Return reverse crosswalk lookups without forcing clients to download an
      entire mapping.
- [ ] Publish a directional relationship graph: within, contains, overlaps,
      predecessor, successor, split-from, merged-from and equivalent-to, each with
      method, quality and provenance.
- [ ] Explain historical code changes rather than pretending every old area has
      a single modern replacement.
- [ ] Return explicit absence states: abolished, unsupported geography, partial
      coverage, or no sufficiently trustworthy conversion.
- [ ] Publish compiler-discovered relationship candidates only after endpoint
      validation and an explicit decision to promote them to crosswalks.

### Named locations — next

- [ ] Search named places such as Greater Manchester, Devon and London.
- [ ] Publish versioned named-location definitions with membership, provenance
      and clear semantics: combined authority, ceremonial county, historic county
      or editorial grouping.
- [ ] List all wards, local authorities or constituencies in a named location.
      The response must state whether membership means fully contained, intersecting
      or weighted overlap.
- [ ] Return a named location's boundary, bounding box and optional union
      geometry.
- [ ] Compare location definitions and membership across releases.

### Boundaries and spatial queries — next

- [ ] Retrieve versioned area geometry as GeoJSON, with reproducible
      simplification tiers and geometry provenance.
- [ ] Retrieve boundary JSON for a collection, for example all wards in a
      constituency or local authority.
- [ ] Return bounding boxes, centroids and land area in m², hectares and km²,
      calculated with a documented projection and method.
- [ ] Point lookup: longitude/latitude → containing supported areas for a
      selected boundary release.
- [ ] Compare two boundary releases to identify recodes, membership changes and
      geometry changes.
- [ ] Deliver vector tiles and cached exports for map-scale workloads.

### Statistics and measures — data required

- [ ] Catalogue datasets and measures with units, period, coverage, licence,
      source lineage, revision status, suppression and comparability notes.
- [ ] Return population estimates for a supported ward, local authority,
      constituency, country or named location.
- [ ] Return population density only when the population date/geography and the
      documented land-area denominator are compatible.
- [ ] Return time series, rankings, comparisons and uncertainty intervals.
- [ ] Return life expectancy by total, male and female where the source
      publishes those series.
- [ ] Return house-price, deprivation, election and other curated measures with
      their own aggregation rules.
- [ ] Export data as JSON, CSV, NDJSON and Parquet.
- [ ] Aggregate additive measures over parent areas or named locations; reject
      invalid operations such as summing medians or averaging ranks.
- [ ] Convert measures across releases only with an explicit, appropriate
      crosswalk: official, exact, area-weighted or population-weighted.

### Postcodes, homes and addresses — data required, later

- [ ] Postcode → ward, local authority, constituency and country lookup, with
      an explicit postcode release and containment method.
- [ ] Count active postcodes within an area.
- [ ] Return postcode-sector, district and area statistics.
- [ ] Return a clearly defined count of households, dwellings, addresses or
      homes. These are different measures and must never be silently substituted.
- [ ] Provide postcode and address history where a source permits it.

### Reliability and product capabilities — next

- [ ] Every data response links to source, transformation, geography match and
      Atlas release provenance.
- [ ] Coverage report for every geography/release/measure combination.
- [ ] Machine-readable change log, release notifications and deprecation
      policy.
- [ ] Cached bulk exports and reproducible query snapshots.
- [ ] Operational API keys, fair rate limits and managed services only when
      they add service value rather than restricting openly licensed data.

### Examples this checklist is intended to answer

- Given a ward code, identify its name and documented parent local authority,
  constituency and country for a chosen release.
- Given “Greater Manchester”, return the relevant named-location definition
  and its constituencies under a stated membership rule.
- Given a historical ward code, show its predecessor/successor timeline and
  flag splits or mergers instead of inventing a one-to-one match.
- Given an area identity or named location, return its geometry, land area,
  population, density or other measure only when compatible source data exists.
- Given a constituency, return a versioned count of active postcodes, homes or
  households only after the exact measure, source date and spatial containment
  method are declared.

### Product posture

The initial goal is a useful, open and sustainable public product;
commercialisation is deliberately deferred. The Atlas should earn trust through
accurate geography handling, transparent provenance and stable public releases
before considering how to monetise it.

Any future paid offering must add operational value rather than restrict access
to openly licensed Atlas artifacts. Examples might include higher service
limits, managed exports, release-change notifications, support, private data
integration or managed deployments. This proposal therefore treats API keys as
an operational control, not an early paywall.

## The user problem

Today, making a UK population-density map can require all of the following:

1. Find compatible boundary releases for England, Wales, Scotland, and
   Northern Ireland.
2. Find population tables for those nations, often at different dates and
   geography types.
3. Establish whether the codes in each table identify the geometries being
   drawn, and recover from renamed, split, merged, or missing areas.
4. Calculate area with a suitable projection, use a consistent denominator,
   and avoid falsely implying national comparability where it does not exist.
5. Repeat the same work for each new map or analysis.

The Atlas has already addressed parts of this: it keeps source material and
metadata, compiles consistent WGS84 boundary assets, records releases and
property keys, infers some ward-to-LAD membership, preserves cross-year code
mappings, produces weighted constituency/LAD overlaps, and curates named
locations such as Greater Manchester and Devon. The API should expose those
decisions as first-class, inspectable products.

## Principles and non-goals

### Principles

- **Identity before geometry.** A code on its own is not enough. Geography
  type, boundary release, and code form an area identity.
- **No silent conversion.** Every geographic conversion reports its method,
  weights, source and target releases, and quality. A caller must opt into a
  best-fit result where it is not an exact correspondence.
- **Provenance travels with data.** Records link to original publishers,
  licences, retrieval dates, input hashes, transformations, and the Atlas
  release that produced them.
- **Raw, harmonised, and derived are separate.** A cleaned source value is not
  the same thing as a value re-expressed on another boundary, and neither is
  the same thing as a density or rate calculated by the API.
- **Coverage is data.** England-only, GB-only, UK, partial, suppressed and
  unknown must be machine-readable, never inferred from an absent record.
- **Open standards at the edge.** JSON for discovery, GeoJSON and vector tiles
  for spatial use, CSV/NDJSON/Parquet for tabular analysis, and OpenAPI for the
  contract. Do not make users learn the Atlas's internal TypeScript model.
- **Immutable releases, helpful aliases.** `latest` is convenient but mutable;
  every response also carries a pinned release identifier that can be cited and
  reproduced.

### Non-goals for the first public release

- Replacing the original statistical publishers or claiming their update
  cadence.
- Promising that every measure is comparable across all four nations.
- Performing arbitrary GIS analysis, geocoding, or universal postcode lookup.
- Producing a single "correct" historical equivalent for every changed area.
- Exposing unlicensed inputs just because a transformed result exists.
- Treating an inferred relationship as equal in authority to a published
  lookup.

## What makes the API valuable

The public contract should offer five connected capabilities.

| Capability | What a caller gets | Why it avoids repeat work |
| --- | --- | --- |
| Dataset catalogue | Measures, units, periods, coverage, licences and source lineage | Finds usable data before downloading it |
| Canonical areas | Stable identifiers, aliases, parents, releases, bounds and geometry references | Removes name/code ambiguity |
| Boundary releases | Valid geometry for a specified geography and vintage | Prevents mismatching a 2019 table to 2024 polygons by accident |
| Crosswalks | Published, inferred, area-weighted or population-weighted mappings | Makes conversions explicit and reusable |
| Named locations | Versioned area sets for places such as Greater Manchester, Devon or London | Makes common real-world scopes portable and inspectable |

The boundary utilities are the differentiator. Open data portals already host
many individual tables. Far fewer products let someone request a dataset on a
chosen, documented geography and tell them exactly what changed on the way.

## Domain model

### Canonical references

Every addressable area has an Atlas identifier:

```
{geography}/{boundary-release}/{source-code}

ward/2024-12-uk-bgc/E05013820
local-authority/2025-05-uk-bgc-v2/E08000003
constituency/2024-07-uk-bgc/E14001262
```

`source-code` remains visible and searchable, but it is not the public primary
key. This avoids ambiguity between types and vintages and keeps a future path
for non-ONS identifiers. An area response includes its official name, aliases,
code namespace, release, nation/extent, parent relations, bounding box, and a
link to geometry.

Named locations are a different resource. They are editorial, versioned sets
of canonical areas, not invented boundary types:

```
location/greater-manchester/2026-09
location/devon/2026-09
```

Each has a definition (`member areas`, their releases, and selection rule),
provenance, and explicit semantics such as `combined-authority`,
`ceremonial-county`, `historic-county`, or `editorial-grouping`. “Devon” is not
unambiguous without this.

### Geography intelligence: codes, names, history and relationships

This deserves equal billing with geometry. A user with a code from an old CSV
should be able to ask four straightforward questions without knowing which ONS
lookup, release, or boundary file to find:

1. **What is this?** Return its official name, type, release, extent, aliases,
   geometry reference, status and provenance.
2. **What did it become / where did it come from?** Follow code changes across
   releases, making a recode, split, merger, abolition or boundary redraw
   explicit.
3. **What areas contain it or does it contain?** Return clean hierarchy where
   it exists, such as an LAD's wards, and weighted overlap where it does not.
4. **How does it relate to another geography?** Translate between types and
   releases with the relationship and its evidential quality stated.

An area record therefore needs a relationship graph rather than a single
`parentCode` column:

```ts
type AreaRelation = {
  relation:
    | "contains" | "within"
    | "predecessor" | "successor"
    | "recode-of" | "split-from" | "merged-from"
    | "overlaps" | "equivalent-to";
  target: string;              // canonical Atlas area id
  validFrom?: string;
  validTo?: string;
  method: "official-lookup" | "clean-containment" | "same-geometry-recode"
    | "area-overlap" | "population-overlap" | "inferred";
  weight?: number;
  quality: "exact" | "best-fit" | "inferred";
  provenance: string;
};
```

The graph must distinguish **history** from **similarity**. A 1:1 recode may
have a safe successor. A ward split into three does not have one successor; it
has three successor relations, and a query asking for an `identity` answer must
fail rather than nominate the largest fragment. Similarly, an LAD may contain
wards exactly while a constituency overlaps LADs only approximately; both are
relationships, but they do not deserve the same label.

### API-owned geography compiler and completeness

The website's gazetteer is a useful client-side optimisation, not the API's
canonical geography source. It is intentionally shaped around the boundary
vintages, code mappings and crosswalks that the map currently needs. The API
must instead compile its own complete, release-aware geography products from
raw boundary releases and authoritative correspondence sources. It may reuse
source material from the website, but must not inherit its limited data model
or deployment lifecycle.

The compiler produces five separately versioned products:

1. **Areas** — every imported area identity, its names and aliases, validity,
   extent, geometry reference and provenance.
2. **Relationships** — directional containment, history and equivalence facts
   between exact source and target identities.
3. **Crosswalks** — directional weighted mappings, including their method,
   denominator, coverage and validation facts.
4. **Change events** — human-readable recodes, splits, mergers, abolitions and
   boundary changes linked to supporting evidence.
5. **Coverage report** — machine-readable statements of what is official,
   derived, partial or not available for each geography/release pair.

“Complete” must mean that the API can give an honest answer for every supported
request, not that it fabricates a one-to-one conversion for every historical
change. When no authoritative or defensible derived relationship exists, the
API returns `conversion_not_available` with the coverage reason. It must never
calculate geometry repair, polygon overlap or inferred parentage during a
request; expensive work belongs in the compiler and its outputs are immutable
release artifacts.

Useful additions beyond code translation are:

- code validation and historical code aliases, including the reason a supplied
  code cannot be resolved;
- official and alternate names (including Welsh names where supplied), with
  name-match explanations and ambiguity preserved;
- predecessor/successor timelines and change events, so a caller can explain
  an abolished area rather than merely receive a replacement code;
- reverse relationships (`ward -> LAD`, `LAD -> wards`, `LAD ->
  constituencies`, `constituency -> LADs`) without having to download all
  geometry;
- coordinate lookup (`lng`, `lat` -> containing areas in selected releases),
  useful for joining a point dataset or validating a geocode;
- area comparison: names, codes, geometry/bounds and membership differences
  between releases; and
- an explicit absence result: a geography can be unavailable, not applicable
  in a nation, abolished, or present but not mapped with enough confidence.

### Dataset and measure identity

A dataset describes an imported source. A measure is the independently usable
series or field within it:

```
dataset/population-uk@2026.09.0
measure/population-estimate
measure/population-density
```

Measures must declare:

- geography and boundary release of the source rows;
- time semantics (`point`, `annual`, `quarterly`, `rolling-period`), period and
  publication date;
- unit, decimal precision and whether the value is a count, rate, ratio,
  rank, median, index, category, or uncertainty interval;
- aggregation semantics: `extensive`, `intensive-with-numerator-denominator`,
  `non-aggregatable`, or `categorical`;
- coverage, known exclusions, suppression rules, and comparability notes;
- source and Atlas transformation lineage.

This prevents a damaging API behaviour: summing percentages, averaging medians,
or pretending that ranks can be converted between boundaries. The API may
aggregate a count; it may derive a rate only when it has a suitable numerator
and denominator; it should reject or return `not-supported` for the rest.

### Conversion is a named method, not a boolean

Crosswalks are directional and versioned resources:

```
crosswalk/ward/2020-12-uk-bgc/to/local-authority/2024-05-uk-bgc
```

Each relation includes a `method` and `quality`:

| Method | Meaning | Appropriate use |
| --- | --- | --- |
| `official-lookup` | Publisher supplied an explicit correspondence | Preferred whenever available |
| `same-geometry-recode` | 1:1 code/name change with unchanged geometry | Safe identity migration |
| `clean-containment` | A published parent code or verified nesting relation | Membership and exact roll-up |
| `area-overlap` | Geometry intersection, weighted by area | Land-area quantities; not people by default |
| `population-overlap` | Fine-grained population building blocks apportioned across targets | Counts whose distribution follows resident population |
| `inferred` | Carefully documented heuristic, for example recovered ward-to-LAD membership | Discovery/matching; requires a warning |

The response must always state whether weights cover all source area, whether
they sum to one, the weighting denominator/date, topology/geometry inputs, and
the expected error or limitations. A conversion from ward to LAD is not the
same kind of claim as a 2024 constituency to 2019 constituency approximation.

## Proposed endpoint surface

All endpoints are under `/v1`. Collection endpoints paginate with opaque
`cursor` values and return `Link` headers. Read endpoints accept `Accept` or
`format=` where appropriate. `latest` is allowed only in discovery endpoints;
responses resolve it to an immutable `atlasRelease`.

### 1. Discovery and catalogue

```
GET /v1
GET /v1/releases
GET /v1/datasets
GET /v1/datasets/{dataset-id}
GET /v1/measures
GET /v1/measures/{measure-id}
GET /v1/geographies
GET /v1/boundary-releases
GET /v1/locations
```

Example:

```http
GET /v1/measures/population-estimate
```

```json
{
  "id": "population-estimate",
  "label": "Usual resident population estimate",
  "valueKind": "count",
  "aggregation": { "kind": "extensive", "operation": "sum" },
  "periods": ["2022"],
  "sourceGeography": {
    "type": "ward",
    "boundaryRelease": "2020-12-uk-bgc"
  },
  "coverage": { "kind": "partial", "includes": ["England", "Wales", "Scotland", "Northern Ireland"] },
  "datasets": ["population-uk@2026.09.0"],
  "links": {
    "data": "/v1/data/population-estimate",
    "provenance": "/v1/provenance/datasets/population-uk@2026.09.0"
  }
}
```

The example coverage is illustrative; the production catalogue must only make
the claim supported by the actual input data.

### 2. Find places and inspect geography

```
GET /v1/areas/{area-id}
GET /v1/areas:resolve?q=manchester&type=local-authority&release=2025-05-uk-bgc-v2
GET /v1/areas:resolve?code=E07000026
GET /v1/areas/{area-id}/ancestors
GET /v1/areas/{area-id}/descendants?type=ward
GET /v1/areas/{area-id}/relations?type=constituency
GET /v1/areas/{area-id}/history
GET /v1/areas:contains?lng=-2.2426&lat=53.4808&types=ward,local-authority,constituency
GET /v1/areas/{area-id}/geometry?format=geojson&simplification=standard
GET /v1/boundaries/{type}/{release}/features?bbox=-2.7,53.3,-1.9,53.8
GET /v1/boundaries/{type}/{release}/tiles/{z}/{x}/{y}.mvt
```

Name resolution is deliberately ambiguity-preserving: a search for
`Manchester` can return Manchester LAD, Greater Manchester named location,
Manchester constituency, historical records, and a confidence/alias reason.
The API must never silently choose one.

Geometry needs two delivery forms:

- **Vector tiles** for interactive maps and large releases. This is the default
  map integration, with CDN cache headers and a bounded property set.
- **GeoJSON** for a single feature, a small filtered collection, download, or
  reproducible analysis. Large nationwide GeoJSON returns an asynchronous
  export link rather than exhausting a request.

`simplification` selects named, documented tiers (`standard`, `high`, `full`),
not a raw tolerance whose output is hard to reproduce. Every geometry response
includes CRS, release, generalisation and a content hash.

`/history` presents an area-change timeline rather than an unqualified “new
code”. For example, it can say that an old district was abolished, list its
official successors and distinguish a same-geometry recode from a split. The
response has an `identityResult` only when the relationship is one-to-one and
exact; otherwise it supplies candidate areas and relationship metadata.

`/areas:contains` is a deliberately bounded point-in-polygon convenience
endpoint. It accepts a coordinate and selected types/releases, returns all
matching areas with boundary versions, and is rate-limited. It is not a
replacement for a bulk geocoder or spatial-analysis service.

### 3. Named locations

```
GET /v1/locations/greater-manchester
GET /v1/locations/greater-manchester/members?type=local-authority
GET /v1/locations/greater-manchester/geometry?mode=union
```

```json
{
  "id": "greater-manchester@2026-09",
  "label": "Greater Manchester",
  "kind": "combined-authority",
  "definition": {
    "selection": "explicit-members",
    "members": [
      "local-authority/2025-05-uk-bgc-v2/E08000001"
    ]
  },
  "provenance": {
    "kind": "official-lookup",
    "source": "…",
    "retrievedAt": "2026-09-01"
  },
  "atlasRelease": "2026.09.0"
}
```

Do not create a union polygon at query time for every request. Serve a cached,
versioned union where it is valuable, or return the member geometries. A union
can obscure gaps and overlaps; its response must retain the member list.

### 4. Crosswalks and code translation

```
GET /v1/crosswalks
GET /v1/crosswalks/{crosswalk-id}
GET /v1/crosswalks/{crosswalk-id}/records?source=E05001234
POST /v1/translate
```

`POST /translate` is for small interactive translations, rather than forcing
callers to discover an opaque crosswalk identifier first:

```json
{
  "source": {
    "type": "constituency",
    "release": "2024-07-uk-bgc",
    "codes": ["E14001262"]
  },
  "target": { "type": "local-authority", "release": "2025-05-uk-bgc-v2" },
  "purpose": "membership",
  "methodPreference": ["official-lookup", "population-overlap", "area-overlap"]
}
```

```json
{
  "results": [{
    "source": "E14001262",
    "targets": [
      { "code": "E08000003", "weight": 0.71 },
      { "code": "E08000004", "weight": 0.29 }
    ],
    "crosswalk": {
      "id": "constituency-2024-to-lad-2025-population-v1",
      "method": "population-overlap",
      "coverage": 1,
      "quality": "best-fit"
    }
  }]
}
```

The API needs separate `purpose` values:

- `membership`: return all intersecting/mapped target areas; weights are useful
  metadata, not an instruction to apportion values.
- `identity`: allow only `official-lookup` or `same-geometry-recode`; otherwise
  return no single answer.
- `apportion`: return weights and require the caller to acknowledge the chosen
  method, or use the data endpoint's conversion option.

Bulk crosswalk records should be downloadable as Parquet/CSV/NDJSON with the
metadata manifest alongside them. They should not be scraped from paginated
JSON.

Translation must also cover changes **within the same area type over time**.
For example, a caller should be able to translate a 2019 ward code to the 2024
ward release, or ask whether a code is still current:

```json
{
  "source": {
    "type": "ward",
    "release": "2019-12-gb-bgc",
    "codes": ["E05001234"]
  },
  "target": { "type": "ward", "release": "2024-12-uk-bgc" },
  "purpose": "identity",
  "methodPreference": ["official-lookup", "same-geometry-recode"]
}
```

If the old ward was simply recoded, the response has one exact target. If it
was split or redrawn, the `identity` request returns `conversion_required` with
the available successor/crosswalk options; it does not pretend that an
area-weighted target is the same area. The same endpoint translates types:

```json
{
  "source": {
    "type": "local-authority",
    "release": "2025-05-uk-bgc-v2",
    "codes": ["E08000003"]
  },
  "target": { "type": "ward", "release": "2024-12-uk-bgc" },
  "purpose": "membership",
  "methodPreference": ["clean-containment", "inferred"]
}
```

That returns the ward members plus, per member, whether the relation came from
a published parent code, a separately maintained lookup, or an inference.
Membership is naturally reversible: asking for an LAD's wards or a ward's LAD
should use the same relationship records and yield the same evidence.

### 5. Retrieve data

The core query endpoint is deliberately constrained:

```
GET /v1/data/{measure-id}
  ?period=2022
  &area=location/greater-manchester@2026-09
  &geography=ward/2024-12-uk-bgc
  &conversion=population-overlap
  &include=area,provenance,quality
  &format=geojson
```

It answers, in order:

1. Which measure and period?
2. Which scope: one area, a named location, a bounding box, or the full source
   coverage?
3. Which output geography/release?
4. Is conversion required, and which declared method is acceptable?
5. Which representation should be returned?

Default output is compact JSON rows. `format=geojson` joins a value to the
requested geometry; `format=csv`, `ndjson`, and `parquet` are exports. Use
asynchronous export jobs for results that exceed a documented row or byte
limit:

```
POST /v1/exports
GET  /v1/exports/{job-id}
```

For a compatible source query, a row looks like:

```json
{
  "area": "ward/2020-12-uk-bgc/E05001234",
  "period": "2022",
  "value": 12450,
  "status": "observed",
  "quality": {
    "geography": "source-exact",
    "conversion": null,
    "suppression": null
  }
}
```

For an output generated through a crosswalk, it becomes explicitly different:

```json
{
  "area": "ward/2024-12-uk-bgc/E05009999",
  "period": "2022",
  "value": 12108.4,
  "status": "derived",
  "quality": {
    "geography": "best-fit",
    "conversion": "ward-2020-to-ward-2024-population-v1",
    "sourceCoverage": 0.997,
    "rounding": "unrounded-derived-value"
  }
}
```

Do not round converted count values into a false claim that fractional people
were observed. Return a raw derived value and clearly document recommended
presentation rounding.

### 6. Server-side aggregation and derived measures

Allow it only under explicit rules:

```
GET /v1/data/population-estimate?area=location/devon@2026-09&aggregate=sum
GET /v1/data/population-density?area=location/devon@2026-09&period=2022
```

For density, the service calculates `sum(population) / union-area`, retaining
the source population period and boundary release of the denominator. It must
not average ward densities. For a rate, it must sum numerators and denominators
then divide. For medians, ranks, categorical winners, and statistical measures
without valid aggregation semantics, return `422 aggregation_not_supported`
with the reason and any valid alternatives.

This guardrail is more valuable than offering a superficially flexible query
language that manufactures invalid figures.

### 7. Provenance, releases and validation

```
GET /v1/provenance/datasets/{dataset-release}
GET /v1/provenance/boundaries/{type}/{release}
GET /v1/provenance/crosswalks/{crosswalk-id}
GET /v1/validation/{resource-id}
GET /v1/releases/{atlas-release}/manifest
```

The release manifest is the reproducibility anchor. It contains all input and
output hashes, licences, build software revision, validation summary, and
stable URLs. Responses also carry:

```http
ETag: "sha256:…"
X-Atlas-Release: 2026.09.0
X-Data-Status: observed
Link: </v1/provenance/datasets/population-uk@2026.09.0>; rel="provenance"
```

`/validation` should publish both passing invariants and known exceptions:
unmatched source records, missing geometry, crosswalk coverage, row counts,
weight sums, duplicate codes, and differences from a prior release. It is not
enough for the team to see this only in CI.

## Response envelope and errors

Every JSON response uses a small common envelope:

```json
{
  "apiVersion": "v1",
  "atlasRelease": "2026.09.0",
  "data": [],
  "meta": {
    "licences": [],
    "provenance": [],
    "nextCursor": null
  }
}
```

Use RFC 9457 Problem Details for errors. Important machine-readable codes:

- `ambiguous_area` — more than one area matches a code or name;
- `unsupported_geography` — requested release/type is not available;
- `conversion_required` — source and requested geography differ;
- `conversion_not_available` — no defensible crosswalk exists;
- `conversion_not_authorised` — caller requested a non-approved method;
- `aggregation_not_supported` — measure semantics make the operation invalid;
- `partial_coverage` — result is possible only with missing/suppressed areas;
- `licence_restricted` — original licence prevents the requested redistribution.

Partial coverage is normally a `200` response with an explicit quality flag;
it should not look like success with a mysteriously short row set.

## Architecture

The public service should be built from immutable, independently testable
artifacts rather than doing spatial repair or crosswalk generation on requests.

```text
publisher files + ONS/OS boundary releases + curated place definitions
                         |
                         v
             import adapters and source manifests
                         |
                         v
  normalised observation store + boundary release registry + area registry
                         |                         |
                         |                         +--> geometry compiler / tiles
                         v
      crosswalk builder + validation + provenance ledger
                         |
                         v
      immutable Atlas release manifest and signed content hashes
                         |
          +--------------+---------------+
          |                              |
          v                              v
 object storage/CDN (Parquet,       query API (catalogue,
 GeoJSON, tiles, manifests)         lookup, small joins, exports)
```

### Build-time data products

1. **Source manifest** — retain source URL, licence, retrieval date, raw input
   hash, adapter version and source-specific caveats. The existing dataset
   manifest is a useful start.
2. **Boundary registry** — formalise the current boundary catalogue as a
   serialised product with code/name/parent property keys, CRS, extent,
   generalisation, source metadata and hash.
3. **Area registry** — API-owned canonical areas, aliases, clean parentage,
   historical relations and named locations. Build it independently of the
   website gazetteer, while reusing compatible raw inputs and preserving their
   provenance.
4. **Crosswalk registry** — versioned directional mappings with method,
   weights, denominator, coverage and validation facts. Keep the existing
   constituency/LAD overlap artifact as the first example, but do not represent
   all mappings as a simple code-to-code dictionary.
5. **Observation store** — typed records keyed by `measure`, `period`, and
   canonical source area. Store raw imported values separately from harmonised
   and derived results.
6. **Release manifest** — an immutable manifest links exactly the versions of
   all five products that shipped together.

### Serving components

- Static catalogues, manifests, crosswalk downloads, boundaries and vector
  tiles belong on object storage behind a CDN; they are cacheable and cheap.
- A stateless API service handles discovery, small row queries, resolution,
  policy checks and signed export URLs.
- A columnar query engine or object-store query layer serves filtered data;
  start with partitioned Parquet by dataset/measure/period/geography rather
  than a large operational database.
- An asynchronous worker creates joins, unions and bulk extracts beyond safe
  request limits.
- A spatial database/index is justified for point-in-polygon and complex bbox
  work, but should not be introduced merely to serve precomputed tiles.

This can begin within the existing Next application for a small beta, but the
API contract, release build and storage layout should be framework-independent.
The map site's deployment lifecycle must not be the only way to publish an API
release.

## Data quality policy

The API needs a product policy as much as it needs endpoints.

### Quality labels

Use a controlled vocabulary, not prose alone:

| Field | Example values |
| --- | --- |
| `recordStatus` | `observed`, `cleaned`, `derived`, `suppressed`, `missing` |
| `geographyMatch` | `source-exact`, `official-lookup`, `same-geometry-recode`, `best-fit`, `inferred` |
| `coverage` | fraction plus list of missing/suppressed areas |
| `comparability` | `within-release`, `cross-release-qualified`, `not-comparable` |
| `confidence` | `high`, `medium`, `low`, with a linked explanation—not a fake statistical probability |

### Required release gates

A data or boundary release does not publish unless it passes or explicitly
waives checks for:

- source hash and licence recorded;
- unique canonical source-area identity;
- known unmatched, duplicate and suppressed records accounted for;
- referenced boundary release and feature count available;
- crosswalk source/target codes resolve; weight sums and coverage are checked;
- extensive conversion preserves totals within a stated tolerance;
- rates and densities use declared numerators/denominators;
- geometry validity and topology checks appropriate to the source;
- public examples and API schema contract tests;
- differences from the prior release reviewed by a person.

The validation result, including waivers, is published with the resource.

## Authentication, quotas and licensing

Start with anonymous read access for catalogue, metadata, modest map queries,
and openly licensed small downloads. Introduce API keys when they are needed
for abuse prevention, higher-cost operations or user-facing service features,
without making open data needlessly hard to use.

Large exports, high-volume tiles and expensive conversion requests should need
an API key and documented quotas. Do not gate a resource merely because it is
popular; cache and publish bulk files where a licence permits it.

Licensing is a real constraint, not footer text. The metadata must preserve
licence terms per source, derive the most restrictive applicable condition for
a multi-source output, emit an attribution block, and block redistribution when
the source terms require it. Legal review is required before branding outputs
as an open API or promising a licence for transformed data.

## Critical risks and weaknesses

This is potentially very useful, but it can fail in predictable ways.

| Risk / weakness | Why it matters | Mitigation |
| --- | --- | --- |
| False authority | A clean API response can make estimated or inferred results appear official | Prominent quality/provenance fields, separate observed and derived endpoints, no silent fallback |
| Geographic change is not reversible | Splits/mergers cannot always be converted exactly | Directional crosswalks, method choice, coverage/error disclosure, reject invalid requests |
| UK-wide comparability is uneven | National statistics use different definitions, periods and small-area systems | Treat coverage and comparability as measure metadata; launch with a small honest UK-wide catalogue |
| Editorial places are contestable | “Devon”, “London”, and regions have multiple legitimate meanings | Version named locations, state their kind and membership, support alternatives rather than hiding the choice |
| Maintenance burden | Boundary releases, source updates and repairs require ongoing stewardship | Automate intake/validation, assign dataset owners, publish a deprecation policy, keep releases immutable |
| Geometry cost | GeoJSON and runtime unions can be huge and slow | Tiles/CDN, named simplification tiers, asynchronous exports, precomputed common unions |
| Licence incompatibility | Public-source data is not automatically freely redistributable in all forms | Per-resource licence policy and legal review before exposure |
| API scope creep | "One-stop shop" can become an unmaintainable general GIS platform | Start with registry/crosswalk/data delivery; decline arbitrary spatial analysis initially |
| Incomplete repairs | Some inferred ward mappings may be wrong or only partially covered | Publish confidence and evidence, accept corrections, distinguish inferred mappings from official ones |
| Breaking reproducibility | `latest` can change an analysis underneath a user | Immutable release URLs, ETags, manifests, changelog and deprecation windows |

The most important criticism: the Atlas must not sell “all UK public data in a
single consistent schema” before it can uphold that claim. Its honest advantage
is a growing, transparent catalogue with exceptionally good geography handling.
Depth and traceability are more credible than breadth.

## Recommended delivery plan

### Phase 0 — make the contract testable

Before public endpoints, define JSON Schema/OpenAPI types for area identity,
boundary release, dataset/measure, provenance, quality and crosswalk. Build an
API-owned geography inventory that states which area releases, historical
relations and conversion methods are actually available. Publish an internal
`atlas-release` manifest and add compiler validation for identity uniqueness,
relationship targets, weight sums and coverage.

**Exit criterion:** one immutable local release can be inspected without
reading repository source code.

### Phase 1 — publish geography first

Publish `geographies`, `boundary-releases`, `areas:resolve`, area metadata,
named locations, geometry links and the initial crosswalk catalogue. Do this
even before a rich data query API: these utilities are the most distinctive and
easiest to validate independently.

Initial products may reuse the present boundary catalogue, curated locations,
inferred ward/LAD mappings and constituency/LAD overlap work as inputs. The
API compiler must give each an explicit release identity and evidence label;
do not upgrade the latter two's status in transit to the API.

**Exit criterion:** an external user can locate an area, obtain an exact
boundary release, inspect membership, and download a documented crosswalk.

### Phase 2 — a small, high-quality data beta

Choose three to five measures with clear ownership and complementary uses:

- population count and population density;
- a local-authority UK-wide measure with clean source metadata;
- one small-area deprivation measure where coverage limits are explicit;
- a constituency measure that demonstrates crosswalk disclosure.

Serve source-exact data and simple named-location aggregation first. Add
Parquet/CSV downloads and attribution. Avoid universal on-the-fly geographic
conversion at this stage.

**Exit criterion:** a user can reproduce a documented population-density map
for a named location from one request sequence, with cited inputs.

### Phase 3 — controlled conversion and exports

Add crosswalk-aware output geography, only for measures whose aggregation
semantics have been declared and tested. Introduce asynchronous GeoJSON/Parquet
exports, operational API keys and quotas where needed, release changelog and
status monitoring.

**Exit criterion:** conversions preserve extensive totals within documented
tolerance and return honest quality metadata in every format.

### Phase 4 — scale coverage, not endpoint complexity

Add datasets through repeatable adapter/manifest templates. Prioritise the
coverage gaps that unlock genuinely UK-wide workflows: nation-compatible
population baselines, more complete small-area geography, and official or
well-evidenced change crosswalks. Add postcodes or point lookups only after
licensing, update cadence and privacy implications are settled.

## Where to focus first

1. **Release and provenance model.** This is foundational. Without a pinned
   release, hashes, licence lineage and changelog, a public API only makes the
   existing work easier to misuse.
2. **Boundary and crosswalk inventory.** Turn every current repair,
   translation, inferred relationship and overlap into a versioned, typed
   registry with an evidence level. This is the unique product.
3. **Measure semantics.** Record what can be summed, recomputed, converted or
   only displayed on its source geography. This protects users from plausible
   but wrong outputs.
4. **A deliberately narrow beta.** One excellent end-to-end population example
   is more persuasive than forty undocumented CSV endpoints.
5. **Validation and public exceptions.** Invest in tests and a visible quality
   report before clever query capabilities. Boundary errors are expensive and
   hard for downstream users to spot.
6. **Licensing and stewardship.** Confirm redistribution rights, attribution,
   update responsibility and deprecation policy before inviting dependency on
   the service.

## Concrete next repository work

The first implementation tickets should be small and separable:

1. Define `api/openapi.yaml` and JSON examples for the Phase 1 resources.
2. Build an API-owned geography inventory that serialises every available
   boundary release and reports missing historical relations and conversions.
3. Create versioned area, relationship and change-event artifacts keyed by
   geography, boundary release and official code; do not expose browser URLs,
   website TypeScript models or code-only identities as the contract.
4. Extend crosswalk artifacts with direction, releases, method, weighting
   basis, coverage, quality and provenance metadata; validate targets and
   weight sums before publication.
5. Create a build-time `atlas-release.json` that references the API's dataset,
   geography, location and crosswalk artifacts by hash.
6. Add schemas and validation tests for geography coverage, conversion absence
   and measure aggregation semantics.
7. Build read-only Phase 1 route handlers backed by static artifacts, then
   host/cache those artifacts independently from the UI bundle.
8. Publish one tutorial that builds a population-density map and cites the
   exact Atlas release.

This sequence turns the current, valuable internal geography knowledge into a
public foundation without prematurely committing to an expensive general-purpose
data platform.

## Initial standalone implementation

The first build artifact is an API-safe boundary-release registry generated
directly from `../data/boundaries/**/meta.json`. It deliberately does not import
the website's boundary catalogue or expose its browser asset URLs.

Run it from this directory:

```sh
pnpm build
pnpm test
pnpm start
```

`pnpm start` runs an independent Node HTTP server at
`http://127.0.0.1:3001/v1`. Its initial read-only endpoints are:

- `GET /v1`
- `GET /v1/geographies`
- `GET /v1/geography-inventory`
- `GET /v1/boundary-releases`
- `GET /v1/boundary-releases/{type}/{release}`
- `GET /v1/areas/{type}/{release}/{code}`
- `GET /v1/crosswalks`
- `GET /v1/crosswalks/{crosswalk-id}`
- `GET /v1/crosswalks/{crosswalk-id}/records`
- `GET /v1/atlas-release`

The build scans every `../data/**/meta.json`, so a newly added dataset becomes
visible to the source inventory on the next build without changing API code.
Boundary releases also feed `public/geography-inventory.json`, which reports
the input formats and whether area identity and conversion compilers are
available. GeoJSON releases with one unambiguous code/name property pair also
produce release-specific area artifacts for exact identity lookup. Exceptional
releases with target and parent fields use explicit API-owned property adapters
in `config/area-property-adapters.json`; unsupported formats remain visible as
gaps rather than being guessed. The current release metadata and inventories
remain independent of the Next.js application.

Where an API release is a deterministic subset of a higher-coverage raw
GeoJSON source, `config/area-source-adapters.json` declares the source and
selection rule. The build writes the selected GeoJSON under
`public/boundaries/` and records its provenance and content hash in
`public/derived-boundaries.json`. For example, Welsh 2011 LSOAs are selected
from the raw England-and-Wales GeoJSON by official code prefix; no generated
TopoJSON is read by this API build.

For canonical identities only, a declared Shapefile source can also be read
through its companion dBase (`.dbf`) attributes. This avoids using generated
topologies for identity lookup while deliberately leaving geometry conversion
to a future, separately validated compiler.

The first crosswalk build is a published, many-to-many constituency lookup
from the source's `2010` label to the July 2024 release. Its records are
marked `official-lookup` and `publisher-supplied`, but deliberately have
`weighting.status: not-provided`: they may support relationship discovery, not
value apportionment or an implied one-to-one identity conversion. Published
crosswalks also feed `public/geography-inventory.json`, which reports each
boundary release's known relationships (direction, method, quality and
weighting) or an explicit gap when no crosswalk references it yet.

The second crosswalk build is a different method: each ward's `clean-
containment` membership in its local authority, read from the published
parent code already present on the same 2025-05 ward boundary release (every
target local authority code resolves to a compiled area on the matching
release). Unlike the constituency lookup, no weighting concept applies to a
clean hierarchical membership, so its `weighting.status` is `not-applicable`
rather than `not-provided`: the difference distinguishes a fact that was
never a proportional split from one whose split was simply not published.
The crosswalk adapter format carries `method`, `quality` and `weighting` per
adapter rather than assuming every crosswalk shares one method, so further
sources can declare `area-overlap` or `population-overlap` without changing
the compiler.

Before publication, the crosswalk compiler validates every referenced code
against the compiled area artifact for that endpoint and fails on a missing
code. When the repository does not hold an endpoint's historical release, it
records that endpoint as `not-available` instead of implying verification;
the 2010 constituency side of the published lookup is the current example.

The build's final step writes `public/atlas-release.json`, an immutable
manifest that references every other build-time artifact (the boundary
registry, derived boundaries, area inventory, crosswalk inventory, geography
inventory and source inventory) by its content hash, plus a single `releaseId`
hash of that set. Rebuilding without changing any input produces the same
`releaseId`; changing any one artifact changes it. This is a first, minimal
step toward the release and provenance model described above, not the full
versioned release history it will eventually anchor.
