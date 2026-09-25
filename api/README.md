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
The present `public/data/datasets` files and browser-facing TopoJSON are internal
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
- [x] Search area identities by official code, name or supplied alias; exact
      code matches return every matching geography/release identity.
- [x] List compiled area identities with geography/release filters and stable
      cursor pagination.
- [x] Translate a 2010–2024 Westminster constituency code to its 2024
      successor mapping through the published official lookup.
- [x] Translate wards in the supported December 2016 and 2022–26 releases, and
      parishes in the April 2019 and May 2026 releases, to their verified
      parent local authorities through clean-containment crosswalks.
- [x] Translate April 2026 sub-integrated-care-board locations to their
      integrated care boards through verified clean containment.
- [x] Apportion July 2024 Westminster constituencies across May 2024 local
      authorities by area overlap, with per-source weights, overlap areas,
      coverage and the sliver rule published alongside each record.
- [x] Navigate each published relationship in both directions, including ward
      → local authority and local authority → ward.
- [x] Ask for a focused area history. It lists published predecessor/successor
      relationships and other releases carrying the same code, while explicitly
      warning that shared code does not prove unchanged geometry.
- [x] Retrieve published clean-containment parents and children directly, such
      as a ward's local authority or an LAD's wards.
- [x] Translate a code through a published directional crosswalk with an
      explicit purpose: official historical identity, clean membership, or
      area-overlap apportionment. Unsupported conversions return an error.
- [x] Search and inspect all 162 curated named locations. Their definitions
      are versioned in the Atlas release and explicitly labelled editorial
      groupings rather than silently presented as official geographies.
- [x] Resolve a named location's direct member codes in one specified
      geography/release, reporting unresolved legacy codes rather than applying
      an implicit historical conversion. Each unresolved code is classified
      against the compiled releases of its geography — superseded, not yet
      current, absent from the requested release, or unknown — so a caller can
      tell an abolished district from a recode it has yet to adopt. Of the 162
      curated locations, 26 are incomplete against the May 2023 local authority
      release.
- [x] Find every area containing a WGS84 point in one specified geography and
      release. Points on exterior or hole rings are included and labelled
      `boundary`, so shared-border ambiguity remains visible to callers.

### Geography and place intelligence — next

- [ ] Resolve a canonical area page with validity, aliases, extent, provenance
      and links to geometry and relationships.
- [x] Resolve a place name to every place it could mean through
      `GET /v1/places?q=`, each candidate saying what kind of place it is and
      none chosen. Names match with case, accents, punctuation and the
      ampersand set aside and aliases included, so "Ynys Mon" finds the Isle of
      Anglesey; an administrative title is set aside too, so "Bristol" finds
      the authority published as "Bristol, City of". Names that merely begin
      with the query follow equal ones. A place held in several releases comes
      back once. Of some 89,000 places, "Manchester" is six geographies and a
      curated location, and "Newport" thirteen codes. The build compiles
      every place and name into `public/place-index.json`, sorted for binary
      search, so a request does no indexing. The index records the area
      inventory and named locations it was built from and a fingerprint of the
      name-normalisation rules; the API refuses to start on one that differs
      from any of them.
- [x] Answer a measure for a place given by name through
      `GET /v1/data/{measure-id}/value?place=`, so "what is the population of
      the North West?" is one request. Each place the name could mean is put to
      the route that already serves it, series for an area and aggregate for a
      curated location or country, so the value and every refusal are that
      route's, and `via` names the call giving the answer directly. The place
      is chosen by what the measure can answer, not by guessing what was meant:
      exact matches first, answers on the same ground counted once with the
      publisher's observation kept, and the period defaulting to the latest
      published, said so. A name giving more than one answer is a 409 whose
      choices each carry their value, as "Newport" does for the Welsh authority
      and its namesake wards; a name the measure answers for no candidate is a
      422 saying why for each.
- [x] Expand parent/child coverage from official ONS lookups, downloaded
      reproducibly by `scripts/fetch-ons-lookup.ts` from the sources listed in
      `config/ons-lookups.json`: LSOA 2021 and MSOA 2021 → LAD (May 2023),
      LAD → county and unitary authority and LAD → combined authority
      (December 2025 releases), and ITL3 → ITL2 → ITL1 (2021). Every code on
      both sides must resolve in its compiled release and every source must
      have exactly one parent, or the build fails. LAD → ITL3 is deliberately
      not published: Highland, North Ayrshire and Argyll and Bute are split
      between ITL3 areas, so it is not containment.
- [ ] Publish constituency → ward and LSOA 2021 → MSOA 2021 where an
      authoritative or carefully qualified mapping exists. ONS publishes ward
      → constituency only as a best fit, and LSOA → MSOA only for England.
- [x] Cross-check published clean-containment lookups against geometry by
      testing every child's vertices against its declared parent. This is a
      build-time validation gate, not a way to derive a relationship; missing
      geometry is recorded as unavailable rather than guessed from shape.
- [x] Add purpose-aware reverse translation rather than requiring a caller to
      reverse a directional crosswalk themselves. Results state `forward` or
      `reverse`, preserve the original crosswalk provenance, and normalise
      reverse area-overlap weights against the queried target.
- [ ] Publish a directional relationship graph: within, contains, overlaps,
      predecessor, successor, split-from, merged-from and equivalent-to, each with
      method, quality and provenance.
- [x] Add official LAD historical change lookups, December 2022 → May 2023 and
      December 2024 → May 2025, and the 2011 → 2021 LSOA changes, where 865
      2011 LSOAs have more than one successor. An official lookup declared as
      membership, such as LAD → region, is related as within/contains rather
      than as succession.
- [ ] Add official ward historical change lookups. Do not promote name-based
      matching to a public equivalence claim, nor a shared code on its own.
- [x] Publish derived `same-code-continuity` identity between consecutive
      releases of one geography, where no piece of the difference between a
      shared code's two geometries is wider than generalisation slivers.
      Shared codes whose extent moved are listed as `changedExtent`, not
      published, so a conversion needing one of them still refuses.
- [x] Find and explain declared multi-step relationship paths, such as current
      ward → local authority → country or region. Every step's crosswalk,
      direction and method is returned.
- [x] Discover multi-step paths at build time under explicit composition
      rules, marked `origin: discovered` and never trusted beyond `derived`.
      A published crosswalk or a reviewed declaration between the same
      releases for the same purpose always takes precedence, and coverage is
      measured end to end, so a long chain states what it loses.
- [ ] Complete the standard small-area hierarchies with explicit national
      coverage: OA → LSOA → MSOA → LAD where applicable, Scottish data zone
      and Northern Irish super output area equivalents.
- [x] Report an area's capability/availability matrix: supported geometry,
      parent/child relations, crosswalks, named-location membership, datasets
      and measures for its exact release. The API reports explicit unavailable
      and not-published states, and never upgrades code-set compatibility into
      a geometry-equivalence claim.
- [x] Answer every capability question in one vocabulary, set out in the
      [capability contract](#capability-contract): an area's geometry,
      relationships, named locations and each measure, a measure's coverage
      of a named boundary release, and whether a relationship path is
      published. A measure with no partition on a release but a working
      conversion onto it names the conversion, with a ready link, rather
      than being left out. Contract tests hold the OpenAPI enum to the code
      and walk live answers across nations and geographies.
- [x] Advertise `GET /v1/relationship-paths` in the API index and OpenAPI
      document. It was served but undiscoverable.
- [x] Return an area-specific citation bundle through
      `GET /v1/areas/{geography}/{release}/{code}/citation`: the immutable Atlas
      release, the area identity artifact's hash, the boundary release's
      publisher, licence and metadata hash, geometry provenance, validation
      results and an attribution block. A named `measure` is cited through
      the observation artifacts, with their hashes, that hold this area's
      value, and only those datasets are credited; a named `crosswalk` must
      map the area. Either is refused if it supplies nothing for the area.
      Per-area geometry hashes are reported as not yet published.
- [x] Resolve the boundary release for a requested date through
      `GET /v1/boundary-releases:resolve?geography=&date=&country=`, returning
      the exact release selected rather than a mutable `latest` alias: the
      latest dated on or before the date that covers the country, with the
      releases either side. Releases are month snapshots, so this is the
      latest snapshot, not a claim about what was legally in force, and a date
      in the release's own month is flagged. Northern Ireland wards in
      December 2019 resolve to the 2018 UK release, passing over the GB-only
      2019 one; a Wales-only subset is set aside for the release it was
      derived from; and data zones, published clipped and unclipped in the
      same month, are a 409 listing both rather than a guess.
- [ ] Find published conversion paths between two area identities and rank
      them by source authority and exactness. Multi-step composition, declared
      or discovered, is published without hiding intermediate mappings; the
      ranking between several paths for one pair is still to do.
- [x] Compile named-location projections, so a request such as Greater
      Manchester → wards or North Wales → constituencies is an indexed read of
      a published result, not a runtime graph walk or polygon calculation.
      Every location is projected through every crosswalk into local
      authorities, and through every crosswalk out of them, and each result
      keeps its path, membership meaning, reach and coverage.
- [x] Return explicit absence states. Every area route answers an unresolved
      identity with a `code` and `absence`: an unpublished geography or
      release, identities not compiled, or a code that is `superseded`,
      `not-yet-current` or absent from the release, with the releases that do
      hold it. Abolition is not claimed, because code membership cannot tell
      it from a recode. A country or region aggregate states its coverage
      against each matching boundary release: `complete`, `partial` with
      `code: partial_coverage` and the missing areas, or `not-assessed`. A
      refused conversion carries `code: conversion_not_available` and whether
      the crosswalk starts elsewhere, leaves source areas unmapped or splits
      them with no weight.
- [x] Publish compiler-discovered relationship candidates only after endpoint
      validation and an explicit decision to promote them to crosswalks.
      A candidate is promoted by declaring a crosswalk adapter for it, and the
      validation gate `candidates-reviewed` fails the build while an eligible
      candidate has neither a published crosswalk nor a recorded waiver. Of
      the 13 candidates, 12 are published and one is waived with its reason.

### Named locations — next

- [ ] Add sourced semantic classifications where available: combined authority,
      ceremonial county or historic county. Definitions currently remain
      transparently labelled `editorial-grouping`.
- [x] List all wards, local authorities or constituencies in a named location,
      through `GET /v1/locations/{id}/members?geography=&release=&via=`. A
      location is curated as local authority codes, so any other geography is
      reached through a published crosswalk the caller names; asking without
      `via` returns the crosswalks published for that geography and release
      rather than choosing one. Through the May 2023 ward crosswalk, North
      Wales resolves to 232 wards, Greater Manchester to 215 and the North
      West to 829.

      The response states what membership means, because it depends on the
      crosswalk. `fully-contained` through a clean-containment crosswalk, where
      the publisher places each area wholly inside one parent, so nothing is
      counted in part. `weighted-overlap` through an area-overlap crosswalk,
      where an area straddling the edge carries the share lying inside and is
      marked partial: Merseyside's constituencies include Southport at 0.312
      and Widnes and Halewood at 0.466, both of which reach into Lancashire and
      Cheshire. Shares in two members of the same location add, so an area
      split between them is whole rather than partial. Each member names the
      authority it was found through, and its `relation`: `within`, or
      `partly-within` where only its weight lies inside.


      `reach` names any of the location's authorities the crosswalk places no
      area under, so Glasgow's LSOAs come back empty with its authority listed
      as unreached, rather than as an empty answer that looks complete.

- [x] Find the regions, counties, combined authorities or countries a named
      location lies in through
      `GET /v1/locations/{id}/parents?geography=&release=&via=`. Each parent is
      `covers` or `intersects`: by count through a containment or membership
      lookup, and by area through an overlap crosswalk, where 0.99 of the
      parent's area counts as cover. Greater Manchester covers its combined
      authority and lies within it; it meets the North West, of whose area it
      is 9%. `locationWithin` names the one parent holding every member, and
      members a lookup places in no parent, such as London's boroughs against
      combined authorities, are listed as `unplaced`.
- [ ] Return a named location's boundary, bounding box and optional union
      geometry.
- [ ] Compare location definitions and membership across releases.
- [ ] Return explicit alternatives for ambiguous real-world names, for example
      ceremonial, historic and administrative definitions of Devon.

### Boundaries and spatial queries — next

- [x] Retrieve versioned area geometry as GeoJSON, with reproducible
      simplification tiers and geometry provenance. `GET .../geometry?tier=`
      takes `full`, `high` (10 m), `medium` (100 m) or `low` (1000 m), a tier
      being the side of the smallest square of detail kept. The rule is
      Visvalingam-Whyatt, measured in the same EPSG:6933 equal-area projection
      as everything else here so a tier means the same thing in Cornwall and
      Shetland, and a part or hole below the threshold is dropped whole rather
      than left as a triangle. In the May 2023 release, Highland goes from
      45,124 vertices to 955 at `low`, for 0.018% of its area. The response reports vertex and part
      counts before and after, and carries the method with it. Two caveats
      travel in that block: a tier bounds the size of feature dropped rather
      than how far a vertex may move, and each area is generalised alone, so
      above `full` neighbours drawn together may disagree along a shared
      border.
- [x] Retrieve boundary JSON for a collection, for example all wards in a
      local authority, through
      `GET /v1/areas/{geography}/{release}/{code}/children/geometry`. One
      FeatureCollection of every area a published crosswalk names as contained
      by this one, each member carrying the crosswalk that places it there, so
      membership stays a published claim rather than a point-in-polygon sweep
      run at request time. Takes the same `tier`, which is what makes it usable
      at scale: in May 2023, Birmingham's 69 wards are 3,423 vertices at
      `full` and 314 at `low`. A member published as a relationship but with no servable geometry
      is listed in `withoutGeometry` with its reason rather than passed over,
      so `members` against `withGeometry` tells a partial collection from a
      complete one. An area with no published containment relationship is a
      404, not an empty collection.
- [x] Return a bounding box, centroid, label point, area and perimeter for one
      area through `GET /v1/areas/{geography}/{release}/{code}/geometry/metadata`,
      without transferring its coordinates. Area is ellipsoidal, through the
      EPSG:6933 equal-area projection, in m², hectares and km²; perimeter
      follows the ellipsoid's radii of curvature, in m and km. The centroid is
      the centre of area, which a crescent or a split island can place outside
      itself, so a label point guaranteed to lie inside is returned beside it
      and says which rule produced it. The method travels in the response.
      This measures the boundary as the release publishes it, at its own
      generalisation and with enclosed inland water included, so it is
      deliberately not offered as land area: the ONS Standard Area Measurement
      remains the published land-area statistic and the denominator
      `population-density` divides by. Measured against it, Birmingham and the
      Isle of Wight agree to about a part in a thousand, while Highland is 2%
      larger, which is its lochs.
- [ ] Expand point lookup beyond its current single geography/release scope,
      with documented request limits and an efficient multi-geography strategy.
- [x] Find nearby areas for a coordinate outside a boundary through
      `GET /v1/areas:near`, ranking up to ten areas per geography within 50 km
      by ground distance to their published geometry. The answer is labelled
      `relation: distance` and never states containment; an area at zero
      metres has the point on or inside it, but only `areas:contains` says so.
- [x] Look a coordinate up in up to four geographies at once through
      `GET /v1/areas:contains`, each release pinned as
      `release={geography}/{release}` or chosen for `date` as the latest dated
      on or before it. Every geography gets its own status: `matched`,
      `no-match` within a covered country, `outside-coverage` for an uncovered
      country or a point outside every UK country boundary, or an ambiguous or
      missing release for the date. Each result carries coordinate precision
      (written decimals, or a stated `accuracy`), the boundary's
      generalisation, the transformation's accuracy, their sum as
      `positionalToleranceM`, and a `nearBoundary` flag on any match whose edge
      lies within it, beside the geometry's source file, hash and CRS.
      `GET /v1/areas:containsBatch` answers the same for up to 100 points,
      reading each release once for the whole batch.
- [x] Accept WGS 84, British National Grid and Irish Grid coordinates at the
      point endpoints, including ordinary Ordnance Survey grid references such
      as `TQ 30000 80000`; retain the declared input, named transformation and
      conservative combined coordinate/transformation uncertainty.
- [ ] Keep terrain elevation as a separately versioned raster lookup, with its
      vertical datum, resolution and uncertainty; elevation is not part of
      administrative-area containment.
- [x] Serve point, nearest-area and box lookup through a compact per-release
      spatial candidate index before exact geometry tests. A release costs 60
      to 400 MB of heap once read, so only two are held at a time, and a lookup
      across more geographies than that re-reads the others on every request.
- [x] Retrieve the areas that intersect a bounded bbox for a chosen release,
      through `GET /v1/areas:intersects?bbox=west,south,east,north`. Each match
      reports whether it lies `within` the box or merely `overlaps` it, both
      tested against the box exactly rather than against the area's own
      bounding box, so a crescent reaching into the query with nothing but its
      bounding box is excluded, as is a box sitting in a lake. Identities come
      back by default with their bounding boxes, and `tier` opts into the
      coordinates, generalised as on the geometry route. Results are capped by
      `limit`, 200 by default and 1000 at most, with `matched`, `returned` and
      `truncated` saying whether the cap bit; the cap is on results rather than
      on the box, since a national box is a fair analysis question and it is
      the geometry that costs, not the extent. Verified against the point
      lookup: a tiny box around a point returns what `areas:contains` returns
      for it, in all four nations.
- [x] List an area's genuine neighbours, including shared-border length and an
      explicit choice to exclude point-only touches, through
      `GET /v1/areas/{geography}/{release}/{code}/neighbours`. Adjacency comes
      from shared vertices rather than a distance threshold: adjacent areas in
      one release are drawn from the same vertices, so a common border is the
      same coordinates on both sides and matches exactly, and its length is
      summed over those edges with the ellipsoidal lengths already used for
      perimeter. Nobody picks a tolerance. `touches=edge` is the default and
      `touches=any` adds areas meeting at a corner, which `border.pointOnlyTouches`
      counts either way so their exclusion is visible. Corners are real: none
      occur between local authorities, while about 3% of ward adjacencies are
      one. The response also totals perimeter against shared border, which
      names the coastline. In the May 2023 release, Birmingham shares 100% of
      its perimeter over seven neighbours, Belfast 94% with 4.1 km left on the lough, Highland 7% with
      4,445 km of coast, and the Isle of Wight has no neighbours at all.
- [ ] Compare two boundary releases to identify recodes, membership changes and
      geometry changes.
- [x] Report the overlap between two specified areas through
      `GET /v1/areas/{geography}/{release}/{code}/overlap?with=`, across geographies
      and releases: the shared area, each area's share, and a relation judged
      by the same sliver and coverage thresholds the area-overlap crosswalks
      are compiled with, so the two cannot disagree. Aldershot is 31.6% in
      Hart, exactly as the published crosswalk says, and two neighbouring
      authorities from different releases meet as `boundary-only`: fifteen
      slivers, the widest 18.7 m. A pair near the sliver threshold is
      `indeterminate` rather than guessed, and any published relationship
      between the two is listed beside the measurement.
- [ ] Complete the geometry metadata above with the properties it does not yet
      carry: a per-area geometry hash, validity checks and a generalisation
      tier. Source CRS, transformation, area and perimeter method, centroid, a
      guaranteed-inside label point, and the source file with its SHA-256 are
      already served.
- [x] Deliver vector tiles and cached exports for map-scale workloads. One
      boundary release is published as a PMTiles archive with its TileJSON and
      per-tile `.mvt` reads, compiled from shared arcs so neighbours cannot
      disagree, and every whole-partition export and lookup table is an
      immutable, cacheable download under a pinned release.
- [x] Publish bulk, versioned CSV and NDJSON downloads for area identities,
      aliases, hierarchy relations, named-location membership and crosswalks
      through `GET /v1/lookups`, so no one needs thousands of API calls to
      reproduce a lookup. Hierarchy is the clean-containment crosswalks, one
      row per child and parent. Lookups are not offered as Parquet yet;
      map resource features and join tables are.
- [ ] Support bounded custom-polygon overlap queries (for example “which wards
      overlap this drawn area?”), with area shares and method/provenance. Keep
      this asynchronous and rate-limited; it is not a general GIS service.

### Data ingestion and geography matching — next

- [x] Validate batches of supplied codes or names through
      `GET /v1/areas:validate?geography=&release=&value=`, up to 500 at a time
      against one exact release. A code is `valid`, or `superseded`,
      `not-yet-current`, held only by another geography, unknown or malformed;
      a name matches exactly, through an alias or without a title such as
      "City of", and is otherwise `ambiguous` with every candidate or
      `unmatched` with the releases where it does match. Trimming, re-casing
      and repeats are reported rather than hidden. Against the May 2025 local
      authorities, "Bristol" finds "Bristol, City of", "Ynys Mon" finds the
      Isle of Anglesey, and Allerdale's code is superseded, its name matching
      five older releases.
- [ ] Accept a column of supplied codes or place names and return an auditable
      match report: candidate geography/release, exact/alias/fuzzy match method,
      ambiguity, unmatched values and recommended next action.
- [ ] Detect mixed or stale code systems in the same input and propose only
      published conversion paths; never silently normalise them.
- [ ] Provide a downloadable match result and a reproducible matching manifest,
      so a user can join their own dataset without redoing the Atlas's repair
      and code-resolution work.
- [ ] Add optional user-confirmed matching rules for repeated imports, kept
      separate from the public canonical aliases until reviewed.

### Statistics and measures — data required

- [x] Catalogue compiled datasets with their source inputs, hashes, licences,
      temporal coverage and record counts through `GET /v1/datasets`; publish
      the first measure definitions through `GET /v1/measures`.
- [x] Return source-exact population estimates through
      `GET /v1/data/population-estimate`: 2022 Ward 2023 codes in England and
      Wales, plus 2011–2024 Local Authority 2023 codes across all four UK
      nations. A caller can opt into a code-compatible geometry release for a
      map join; the route still has no implicit release selection, conversion
      or aggregation.
- [x] Include a compact provenance chain with every population response: the
      immutable Atlas release, measure and dataset links, observation artifact
      hash, source geography, caller-selected code match (if any), and an
      explicit no-transformation statement.
- [x] Return source-exact metered energy consumption through
      `GET /v1/data/electricity-consumption` and
      `GET /v1/data/gas-consumption`, each also split into `-domestic` and
      `-non-domestic`: 2015-2024 Local Authority 2025 codes in Great Britain,
      in GWh. These are settlement-reconciled meter readings rather than a
      model, so a total adds up over areas exactly and the two segments equal
      the whole in every published area and period. Northern Ireland runs
      separate energy markets and is declared absent rather than served as a
      gap. Consumption per meter is not published: it is a ratio, and neither
      sums nor averages over a group of authorities. The publisher's 2012 to
      2014 years are on an older local authority vintage and 2005 to 2011
      predate GSS codes, so neither resolves against a compiled release and
      neither is offered. The Isles of Scilly, Orkney and Shetland have no
      mains gas grid, which the publisher records as zero in every year but
      2023, where the cells are blank; a blank is not a measurement, so those
      three are absent for that period and named in the coverage note rather
      than filled in with the zero the other years show.
- [x] Return source-exact regional economic output through
      `GET /v1/data/gdp` and `GET /v1/data/gva`: 1998-2023 gross domestic
      product at current market prices and balanced gross value added at
      current basic prices, in £ million, across all four UK nations on each
      of the three International Territorial Level tiers. The publisher
      restates the whole series on current codes, so all three partitions are
      on the January 2025 vintage, compiled here as three new boundary
      releases: the 2025 revision renumbers much of the 2021 tier, moving Tees
      Valley from TLC1 to TLC3, and only 31 of 46 ITL2 codes and 122 of 182
      ITL3 codes are shared, so the series is deliberately not offered on the
      2021 releases. The tiers nest, so each is its own partition and areas
      may be summed within one tier but never across them. Output per head is
      not served: it is a ratio, and the publisher's population basis for it
      is not the one this API serves.
- [x] Return source-exact greenhouse gas emissions through
      `GET /v1/data/ghg-emissions`: 2005-2024 Local Authority 2025 codes across
      all four UK nations, as net territorial emissions in kt CO2e. Emissions
      per resident are not served: a ratio cannot be summed over areas. The same code-compatible geometry join,
      provenance chain and tabular export as the population measure apply.
- [x] Return total jobs through `GET /v1/data/total-jobs`: 2011-2024 Local
      Authority 2023 codes, counted at the workplace and rounded by ONS to the
      nearest thousand. Great Britain is published for every year and Northern
      Ireland for 2020 to 2022 only. The build checks that any absence is a
      whole nation, so a missing British district fails it, and Northern
      Ireland's missing years are absent records, never zero. Jobs density is
      not served: it is a ratio needing the working-age population as a weight.
- [x] Return population estimates for a supported ward, local authority,
      constituency, country or named location. Ward and local authority come
      from their source partitions, country and named location from
      `/aggregate`, and constituency from ONS's own mid-2021 and mid-2022
      estimates for the 575 July 2024 constituencies in England and Wales,
      served as a third partition of `population-estimate`. They are not ward
      estimates added up: wards do not nest within these constituencies, and
      ONS's ward-to-constituency lookup splits some wards between them without
      weights, so no exact conversion exists.
- [x] Return population density through `GET /v1/data/population-density`:
      2011-2024 Local Authority 2023 codes across all four UK nations, as
      people per square kilometre. The denominator is the ONS Standard Area
      Measurement land area, which excludes inland water; the larger extent of
      the realm is published alongside it but deliberately not used. The two
      code sets are verified identical when the catalogue is compiled, and a
      missing or zero denominator fails the build rather than publishing a
      figure. Values are marked `derived`, not `observed`, and the measure
      names both input datasets so attribution covers the denominator too.
- [x] Return source-exact time series for one published area code and source
      partition through `GET /v1/data/{measure-id}/series`. With an explicit,
      reviewed `analysisGeography`, the same route returns only clearly marked
      derived values regrouped onto that frame; unsupported pairs answer
      `not-comparable` rather than selecting a substitute. Every form reports
      the observation artifact and all periods in its provenance.
- [x] Rank a source-exact measure partition through
      `GET /v1/data/{measure-id}/rankings`, using documented competition ranks
      for ties and refusing release selection, conversion and aggregation.
- [x] Compare two source-exact areas through
      `GET /v1/data/{measure-id}/compare`, with explicitly named baseline and
      comparison sides, a directed same-unit difference, and no relative
      difference for ratio measures.
- [x] Rank areas by change between two periods through
      `GET /v1/data/{measure-id}/change`, absolutely or as a proportion of the
      start, with `areaCode` returning one area and its place among the rest.
      Between 2011 and 2022 the City of London grew 56.7% and Tower Hamlets
      26.9%, while Kensington and Chelsea lost 11,915 people; Redcar and
      Cleveland cut emissions 93.8% from 2005 to 2024, the Teesside steelworks
      having closed. Change is measured inside one source partition, whose
      periods the publisher restates on a single set of codes, so an area code
      names the same ground at both ends; pairing partitions on different codes
      is not offered. A rank, decile or category is refused, since a move in a
      position is not change in the area, as are a single-period partition and
      rolling windows that share years. Relative change is refused for a ratio,
      matching compare, and currency is nominal. Where intervals are published,
      each record says whether the start and end intervals overlap: no male
      life expectancy fell between 2001-2003 and 2020-2022, and the smallest
      gains, such as Ceredigion's 0.65 years, sit within overlapping intervals.
- [x] Sum an extensive measure, or take the weighted mean of an intensive one
      that names its weight, over a curated named location through
      `GET /v1/data/{measure-id}/aggregate`. Members are matched by code in one
      requested source partition. A location lists every code it has been
      made of, so a code of another vintage, whose successor or predecessor
      the partition holds instead, is passed over, as is a legacy code naming
      no compiled area; both are listed in
      `aggregation.memberCodesNotInPartition`. Any other missing member is
      refused with `code: partial_coverage` rather than summed as a partial
      total, and a location none of whose codes is in the partition is refused
      with its reason. The response marks the value as derived and supplies
      its membership evidence; non-aggregatable measures and all conversions
      are rejected.
- [x] Return uncertainty intervals where the source publication supports them.
      A measure whose publisher reports intervals declares `uncertainty` (kind
      and level), and each of its records carries `confidenceInterval` with the
      published bounds. Intervals are never computed here. Life expectancy is
      the first: ONS's 95% confidence interval on every estimate. Tabular
      exports carry `lowerBound` and `upperBound`, empty where none is published.
- [x] Return life expectancy at birth through `GET /v1/data/life-expectancy-male`
      and `GET /v1/data/life-expectancy-female`: 340 local areas in England,
      Wales and Northern Ireland, for every three-year period from 2001 to 2003
      to 2020 to 2022, each with its 95% confidence interval. ONS restates the
      whole series on December 2021 codes. It publishes male and female series
      but no persons total, so none is offered, and it does not publish the four
      authorities created in April 2023, so they are not served. Declared
      `non-aggregatable`: a combined population's life expectancy is not an
      average of its areas'.
- [x] Return median house price paid through `GET /v1/data/house-price-median`:
      ward-level, England and Wales, 1995-2022, each period the year ending
      December. The final edition's year ending March 2023 is not comparable
      and is not published. Values sit under the ward codes the publisher used,
      mostly December 2020 codes; Salford's twenty wards, which the website
      remaps onto their redrawn 2021 codes, are restored to the codes they were
      published against. Declared `non-aggregatable`: a median of medians is not
      the median of the underlying sales, and aggregation and conversion both
      refuse with that reason.
- [x] Return the English Index of Multiple Deprivation 2019 through
      `GET /v1/data/imd-rank` and `GET /v1/data/imd-decile`: 32,844 LSOAs on
      2011 codes. Both are declared `non-aggregatable` (a rank records an order,
      and a decile is a band of ranks, so neither can be averaged), and each
      states that it is a position within England alone and cannot be compared
      with the other three nations' indices. The 26 tied ranks in the published
      file are served as published. The composite score is not published as a
      measure.
- [x] Return the Northern Ireland Multiple Deprivation Measure 2017 through
      `GET /v1/data/nimdm-rank`: 890 super output areas under their NISRA codes,
      which match the 2011 release exactly. NISRA publishes ranks but not
      deciles for these areas, so no decile measure is offered.
- [x] Return the Welsh Index of Multiple Deprivation 2019 through
      `GET /v1/data/wimd-rank` and `GET /v1/data/wimd-decile`: 1,909 LSOAs on
      2011 codes, taken from the Welsh Government's published ranks and
      deciles. Ranks are not recomputed from the published scores, which are
      rounded to one decimal place.
- [x] Return the Scottish Index of Multiple Deprivation 2020v2 through
      `GET /v1/data/simd-rank` and `GET /v1/data/simd-decile`: 6,976 data zones
      on 2011 codes, taken from the Scottish Government's published data zone
      lookup, which matches both compiled data zone releases exactly.
- [x] Return source-exact general- and local-election vote counts, party vote
      counts and turnout through `GET /v1/data/{measure-id}`. Election periods
      remain on the source boundary vintage; vote counts may be summed within
      one election, while turnout is a percentage that requires electorate
      weighting to combine and is not yet aggregated by the API. General
      election party shares are explicit percentages of valid ballots and
      aggregate with that published denominator. Local election votes count
      each party's highest-polling candidate in a ward, and their total,
      `local-election-effective-votes`, remains a count: multi-member ballots
      make it unsuitable as a ballot-share denominator. Winning party is returned as a categorical
      observation, not a numeric score. The local archive's 2016–2019 files do
      not publish turnout, so those years are absent from that measure rather
      than represented as zero.
- [x] Export any published measure's source-exact pages as JSON, CSV or NDJSON,
      retaining row-level release, source, unit and geography provenance
      outside the API. A
      tabular page that is not the last carries its successor in a `Link`
      header with `rel="next"`.
- [ ] Export large datasets as Parquet, with an immutable export manifest and
      documented schema/versioning policy.
- [x] Return source-exact mobile coverage through
      `GET /v1/data/mobile-4g-coverage` and `GET /v1/data/mobile-5g-coverage`:
      2025 Local Authority 2024 codes across all four UK nations, as the share
      of premises reached by all four mobile network operators. The other four
      published metrics are not measures: the at-least-one-operator variants
      are nearly saturated, and the landmass variants use a denominator the
      declared premises weight does not apply to.
- [x] Return source-exact Census 2021 travel to work and car availability
      through `GET /v1/data/travel-to-work-{mode}` and
      `GET /v1/data/car-availability-{band}`: Local Authority April 2023 codes
      for England and Wales. Published as counts, not shares, because a count of
      people or households adds over areas; each breakdown publishes its own
      `-total` denominator so a caller can derive a share and knows its
      universe. The four authorities created in April 2023 postdate the census
      and are compiled by summing their predecessors, which is exact for a
      count; the districts they replaced are dropped, and the build refuses a
      partition that is not exactly the April 2023 code set, so no resident is
      counted twice.
- [x] Return Census 2021 highest qualification and ethnic group through
      `GET /v1/data/qualification-{level}` and
      `GET /v1/data/ethnicity-{group}`, on the same April 2023 England and
      Wales authorities and under the same double-counting check. Qualification
      covers usual residents aged 16 and over, with its own `-total`; the
      nineteen ethnic groups are exhaustive, so they sum to the resident
      population without a separate total, give or take the few residents
      ONS perturbation moves between tables.
- [ ] Return Census 2021 small-area tables on 2021 LSOAs and MSOAs for England
      and Wales (compiled by `pnpm --dir api build`; not yet in a published
      release): usual residents (TS001, `usual-residents-*`), age in five-year
      bands (TS007A, `age-*`), household composition (TS003,
      `household-composition-*`), tenure (TS054, `tenure-*`), economic
      activity (TS066, `economic-activity-*`) and general health (TS037,
      `general-health-*`), and ethnic group (TS021) as LSOA and MSOA
      partitions of the existing `ethnicity-*` measures. Only leaf categories
      are served, with a `-total` where the table has one, and the build
      refuses a file whose categories do not sum exactly to its total. Each
      table is stored once per geography as a shared table artifact (15 MB for
      all fourteen, against about 190 MB as one artifact per measure), read
      once and expanded per measure only when asked for; each measure still
      exports the whole table it lives in. LSOAs nest in MSOAs through the
      official exact-fit lookup
      `lsoa-2021-12-ew-bgc-v5-to-msoa-2021-12-ew-bgc-v3-official-lookup`, so a
      small-area count converts or aggregates up exactly. The 2011 to 2021
      LSOA lookup keeps ONS's change indicator on each pair as `change`:
      `unchanged`, `split`, `merged` or `complex`, checked against the
      lookup's own shape.
- [x] Return Ofcom's July 2025 fixed broadband availability through
      `GET /v1/data/broadband-{superfast,ultrafast,full-fibre,gigabit}-availability`:
      shares of premises for every authority in all four nations. A share is
      declared intensive and weighted by premises, so it is not summed or
      averaged flat over areas. Single-period indicators like this are checked
      against the authority code set they claim at build, and any authority
      without a value is named in the coverage note.
- [x] Return the April 2026 claimant count through
      `GET /v1/data/claimant-count` and `GET /v1/data/claimant-count-16-to-24`:
      counts for every authority in all four nations, on the April 2023 code
      set after the districts replaced that April are checked and dropped.
      Claimants are not unemployment, and the published rates are not served,
      because a rate needs the working-age population as a weight.
- [x] Return households and children in temporary accommodation at the end of
      January to March 2026 through `GET /v1/data/temporary-accommodation-*`:
      counts for English authorities on 2025 codes. The twelve authorities
      that submitted no return are named rather than summed as zero, so an
      England total over the 284 that did is flagged partial.
- [x] Return 2025 provisional median gross pay by place of residence through
      `GET /v1/data/median-annual-pay` and `GET /v1/data/median-hourly-pay`,
      from ASHE Table 8 for English authorities. Region and county totals in
      the same table are left out, the two estimates the publisher suppressed
      are named, and a median is refused for aggregation.
- [x] Return police recorded crime for the year to March 2026 through
      `GET /v1/data/crime-{offence}`: 23 offence counts for every community
      safety partnership in England and Wales, the geography Table C2 is
      published for, matching the December 2023 partnership boundaries code
      for code. It is not served by local authority, because some
      partnerships span several authorities. Partnership counts exclude fraud
      and offences unassigned to any partnership, so they do not sum to force
      or national totals.
- [x] Return final annual reported road collisions for 2024 and 2025
      through `GET /v1/data/road-collisions` and its fatal, serious and slight
      subsets, in separate local-authority partitions on their published 2024
      and 2025 code vintages, and in a common December 2021 LSOA partition for
      England and Wales; Scotland has no LSOAs.
      Each collision is counted in the authority and LSOA the Department for
      Transport assigns it to in the published record, not by placing its
      coordinates in a boundary, so the counts are exact tallies of the source
      rows and the three severities add up to the total in every area. An LSOA
      with no collision records has no value rather than zero. Collisions
      assigned to Heathrow Airport are counted in no authority. Serious and slight
      counts are as the police recorded them; the Department for Transport's
      adjusted severities, and casualty counts, are not served.
- [x] Return ONS's final model-based unemployment estimates through
      `GET /v1/data/unemployment-rate` and `GET /v1/data/unemployment-level`,
      with their 95% confidence intervals, from April 1996 to March 1997 to
      2021 for Great Britain. The workbook estimates both the districts and
      the authorities that replaced them in 2020 and 2021, so they are served
      as two partitions, April 2019 over every period and April 2021 over the
      years both are estimated, and no resident is counted twice. Rates for
      the April 2023 authorities, which the model never estimated, are not
      served.
- [x] Return Defra's modelled 2024 background air pollution for every UK local
      authority: `GET /v1/data/{no2,pm10,pm25}-background-mean`, the mean of
      the PCM model's 1x1 km cells within each authority, served as derived
      with `air-quality-grid-cells` as their weight, so a country or region
      aggregate is the exact area mean; and `GET /v1/data/pm25-population-weighted`
      with its anthropogenic part, Defra's own table as published. Wales's
      background NO2 averages 2.48 µg/m³ across its area.
- [x] Declare whether each measure's values may be combined over areas, and on
      what terms: extensive values add, intensive values are a ratio that needs
      a named weight, and non-aggregatable values such as medians, ranks and
      deciles cannot be combined at all, with the statistic named. Extensive
      measures aggregate by sum; an intensive measure aggregates only when it
      names a published weight measure. Conversion remains extensive-only.
- [x] Sum an extensive measure over a curated named location or a country
      through `GET /v1/data/{measure-id}/aggregate`. Country membership follows
      the GSS code prefix, which the coding scheme assigns by country, so it is
      definitional rather than a geometric comparison. A location with a missing
      member its vintage does not explain, a country the partition does not
      reach, and a measure that neither adds nor names a usable weight are all
      rejected rather than summed.
- [x] Aggregate an extensive or explicitly weighted measure onto any published
      membership target through `GET /v1/data/{measure-id}/aggregate`, with
      `targetCode`, a code-set-compatible source release and the crosswalk that
      establishes the membership. The target's geography is the crosswalk's, so
      a combined authority, a county and unitary authority, an English region
      and an integrated care board are each summed the same way, and a measure
      published on local authorities reaches all of them without new data.
      Only a crosswalk that establishes membership qualifies: clean containment
      and complete one-to-one area overlap are membership by construction, an
      official lookup only where it declares that purpose, and an identity
      lookup never, because it relates two vintages of one area rather than the
      parts of a larger one. `aggregation.membership` names which claim the
      total rests on. A split or partial overlap is refused rather than used as
      an implicit conversion, and a target the crosswalk never mentions is a
      404 rather than a sum of nothing. `regionCode` remains the original
      spelling for a region and is answered beside `target`.
- [x] Check a measure against itself across two geographies, through
      `GET /v1/measures/{measure-id}/reconciliation`. Adding the finer
      partition up through a published crosswalk should reproduce the coarser
      one; both figures are the publisher's, so a difference is evidence about
      the crosswalk, the vintage or the data, and nothing is corrected. An
      area whose finer parts are not all published is `incomplete`, which is a
      gap rather than a disagreement.
- [x] Answer a measure's coverage of one release country by country, through
      `GET /v1/measures/{measure-id}/coverage-plan`, so a gap in one nation is
      read before a ranking is, not after. Each country is `source-exact`,
      `converted`, `partial` or `missing`, counted from the areas a source or
      conversion carries rather than from declared coverage, and a missing
      country says whether only the route onto the release is absent.
- [x] Convert an extensive measure across releases through
      `GET /v1/data/{measure-id}/convert`, using only the crosswalk the caller
      names. The response repeats that crosswalk's method, quality, weighting
      and content hash, and reports whether the result was an exact regrouping
      (every source wholly inside one target, partition total unchanged) or an
      area-weighted or population-weighted estimate. An intensive measure is
      refused, as is a source code the crosswalk does not carry or a split
      source with no published weight. Population weighting is offered for 2024
      constituencies in England and Wales, through
      `constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-population-overlap`.
- [x] Convert through a published relationship path with `path` in place of
      `crosswalk`. Values are carried through every step in its declared
      direction, weights multiply along the path, and the whole path is
      refused if any step would drop a value or split one without a weight.
      The response lists each step's crosswalk and direction.
      `GET /v1/measures/{measure-id}/reconciliation` takes `path` the same
      way, adding the finer partition up through every step, and lists a
      path only between releases the partitions are verified to join and
      only where it reconciles the latest shared period.
- [x] Aggregate onto a membership target through a published path with
      `path` in place of `crosswalk`, such as wards into a region through
      their local authorities. Every step must run forward and declare
      membership, or be same-code continuity; a source is summed only if every
      step carries it wholly into one area ending at the target, and any
      source that reaches the target another way refuses the sum.

### Postcodes, homes and addresses — data required, later

- [x] Postcode → local authority, ward, constituency, or any other compiled
      geography and release, through `GET /v1/postcodes/{postcode}`. Postcodes
      are compiled from the ONS Postcode Directory (August 2026, 2.67 million
      live and terminated postcodes) into one shard per postcode area, read on
      first use. A postcode's centroid is placed by the same point lookup as
      `areas:contains`, so every answer names its directory edition, boundary
      release, the centroid's positional quality and whether it lies near a
      boundary. Against the directory's own assignments for a sample of 6,612
      postcodes, 19,831 of 19,836 local authority, ward and constituency
      placements agree, and the five that differ are all flagged
      `nearBoundary`. Northern Ireland postcodes are licensed by Land and
      Property Services for internal business use only, so they are refused
      with 451 rather than served.
- [ ] Count active postcodes within an area.
- [ ] Return postcode-sector, district and area statistics.
- [ ] Return a clearly defined count of households, dwellings, addresses or
      homes. These are different measures and must never be silently substituted.
- [ ] Provide postcode and address history where a source permits it.

### Reliability and product capabilities — next

- [x] Publish code-set compatibility candidates between an implemented
      measure's source geography and compiled boundary releases through
      `GET /v1/measures/{measure-id}/compatibility`. This is evidence for
      selecting a conversion path, not proof that candidate geometries are
      identical or a licence to select one automatically.
- [x] Every implemented data response links to source, transformation,
      geography match and Atlas release provenance.
- [x] Publish source and boundary code coverage for each implemented measure
      partition through `GET /v1/measures/{measure-id}/coverage`. Geography
      and release integrity remains available from `GET /v1/validation`; a
      code-coverage result is explicitly not a claim of equal geometry.
- [x] Gate every measure and source partition in the validation report. Each
      observation artifact must reproduce its hash, hold codes that one
      compiled boundary release of its declared year resolves, cover exactly
      the nations its catalogue entry declares, and carry values its measure
      allows. A declared total, such as recorded crime or households by car
      availability, must equal the sum of its components in every area and
      period. The first build found 95 exceptions. Fixing the local election
      loader cleared 17: 2023 ward codes inferred from other years' names, and
      party votes that did not add up to 2021 to 2025 totals. The exceptions
      that remain are published with their reasons, 47 waived checks in the
      current report, such as 2016 to 2019 ward election codes from outside
      their year's release.
- [ ] Machine-readable change log, release notifications and deprecation
      policy. `GET /v1/atlas-releases/compare` is already a machine-readable
      change log between any two releases, and the
      [operations contract](#operations-contract) sets out the deprecation
      policy and the test that enforces it. There are no release notifications
      yet.
- [x] Compare two Atlas releases, identifying changed datasets, boundary
      releases, crosswalks, validation exceptions and named-location definitions.
      `GET /v1/atlas-releases/compare` lists the artifacts added, removed and
      changed by content hash, and inside them the datasets, measures,
      boundary releases, area identities, geometry sources, crosswalks,
      validation exceptions, named locations, exports and lookups added,
      removed and changed, by fingerprints each release records. It names a
      changed resource, not the field that changed.
- [x] Generate a ready-to-use attribution and licence block for selected
      resources through `GET /v1/attribution`, suitable for a map, report or
      bulk download. A measure is attributed through its source datasets; a
      crosswalk is compiled here rather than obtained, so the boundary releases
      at its endpoints are attributed instead and the crosswalk records them.
      Licence names are reproduced as the publisher states them and are not
      interpreted, because one source already carries two across its date
      range.
- [ ] Cached bulk exports and reproducible query snapshots. Whole source
      partitions and lookup tables are already immutable, cacheable downloads
      through `GET /v1/exports` and `GET /v1/lookups`; a query's results
      cannot yet be snapshotted.
- [x] Fair rate limits: a token bucket per client, IPv6 clients by /64,
      announced on every response with the IETF draft `RateLimit-Policy` and
      `RateLimit` headers and refused with `429` and `Retry-After`. The
      defaults allow a burst of 600 requests, earned back at 10 a second,
      which a map drawing a view does not reach. Behind a proxy the client is
      read from `X-Forwarded-For` only as far as the declared proxy hops.
- [ ] Operational API keys and managed services, only when they add service
      value rather than restricting openly licensed data. There are no keys:
      nothing served needs one, and the rate limit is what keeps one client
      from starving the others.
- [x] Lock the v1 contract against breaking change. `contract/v1-surface.json`
      records every operation, parameter and limit, status, media type and
      response property path in `openapi.yaml`, and a test refuses a change
      that removes or narrows any of them, or a deprecation without dates.
      Growth must be locked with `pnpm contract:surface`, so each addition is
      reviewed as a promise.
- [x] Operate the server: `/healthz`, `/readyz` and Prometheus `/metrics`,
      one JSON log line per request labelled by operation template with a
      request id, a logged `500` with a `requestId` rather than a crashed
      process, bounded URL length and client timeouts, a configurable geometry
      cache that reports its reads, loads and evictions, and a drain on
      `SIGTERM`.
- [x] Gate a deployment with `pnpm smoke <base-url>`: sixteen checks of the
      contract rather than of one release's contents, from readiness and the
      OpenAPI description to conditional requests, pinning, problem details,
      rate limit headers and metrics. `tests/smoke.test.ts` holds the suite to
      passing in full against the compiled catalogues.
- [ ] Publish an export manifest for every asynchronous or bulk download with
      its schema, query, row count, content hashes, provenance and Atlas release.
      `GET /v1/exports` already records each whole-partition download's
      measure, dataset, periods, source geography, content hash, size, record
      counts, record schema and the datasets to attribute, under the Atlas
      release its envelope names. There are no asynchronous exports or query
      snapshots yet.
- [x] Report a measure/geography/release quality matrix before large queries
      through `GET /v1/measures/{measure-id}/quality`: observed and derived
      record counts for every period, code coverage against each compatible
      boundary release, and the source's coverage note naming any area with
      no value. Suppressed values are named in that note rather than counted
      separately, because the source partitions do not publish them as
      records.

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

The initial goal is a useful, open and sustainable public product. The Atlas
should earn trust through accurate geography handling, transparent provenance
and stable public releases before asking users to depend on it for decisions.
The commercial product is not access to a collection of openly licensed files:
ONS, Nomis and the publishers remain the source for those. It is the managed,
production-ready layer which keeps a customer's geography-safe workflow
correct as data, boundaries, definitions and crosswalks change.

The first commercial phase keeps this API read-only. That retains the useful
properties of static artifacts and `GET` requests: public cacheability, simple
reproducibility, small operational and privacy surface, and an API that users
can safely call from a build or analysis. API keys may control documented
operational entitlements such as throughput, tile delivery, export size,
freshness targets and support, but are not an early paywall on OGL data.

The near-term paid promise is therefore:

> A versioned UK geography and data service which reliably resolves,
> converts, delivers and explains the data behind the places a customer cares
> about, and tells them what has changed.

"Projects" are a later product layer, not an initial API resource. A customer
can retain a portable Atlas project manifest in its own repository, application
or data warehouse: canonical areas and groups, selected measures, a pinned
Atlas release and any customer-side assumptions. Atlas responses should accept
or emit enough information to reproduce that manifest, without the API storing
private customer data or exposing write endpoints. A future dashboard may
store, schedule and collaborate on manifests once the read-only service has
shown which workflows deserve that added state.

### Commercial read-only roadmap

These are product capabilities, not a reason to add endpoints indiscriminately.
Each should make a recurring decision or production workflow safer, cheaper or
faster. The initial target users are organisations that repeatedly assess or
report on places: location-intelligence and planning consultancies, public
sector analytics teams, and property or infrastructure analysts. Pick one
before building an opinionated vertical profile. The detailed capability
sections below are a backlog, not a build order; the delivery plan later in
this document is authoritative.

#### Initial customers and product boundary

The API itself is the product for data engineers, GIS teams and other software
builders. A non-technical end user is unlikely to pay for a measure catalogue
or a raw crosswalk: they pay for a defensible answer about a place. A thin
Atlas application, report template or customer integration should therefore
turn the same read-only resources into this sequence:

```text
place, postcode or canonical area
              |
              v
chosen profile and explicit peer group
              |
              v
trend, comparison, map, quality and caveats
              |
              v
shareable, cited, release-pinned evidence snapshot
```

- [ ] Start commercial discovery with planning, policy, location-intelligence
      and public-affairs consultancies. The existing local-authority, ward and
      constituency data, alongside deprivation, elections, environment,
      connectivity, labour and population measures, already supports recurring
      area evidence work for them.
- [ ] Serve GIS and data-product companies as the infrastructure audience:
      they need stable identifiers, tiles, crosswalks, columnar downloads,
      change feeds and a support/reliability contract rather than a dashboard.
- [ ] Treat public-sector analytics teams as a strong but slower procurement
      audience: their needs include benchmarking, citations, accessibility,
      reproducible reports and clear national-comparability caveats.
- [ ] Treat property, planning and infrastructure intelligence as a later,
      potentially higher-value vertical. It requires more precise place entry,
      custom areas and additional property, planning, flood and transport data
      before it is credible as a primary proposition.
- [ ] Keep a useful free tier for researchers, journalists and civic users.
      Their scrutiny, examples and citations strengthen the public trust the
      paid operational service depends on.

#### Three golden paths

The first commercial beta serves three related jobs, in this order. A proposed
capability must make at least one of them more correct, faster, cheaper or
easier to defend; otherwise it remains deferred.

| Path             | Primary user          | Promise                                                                                                               |
| ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Correct map      | GIS/product engineer  | Render release-pinned UK boundaries and values without a code/geometry mismatch, with attribution.                    |
| Defensible trend | Analyst or consultant | Compare a small set of measures through time on an explicit analysis geography, with conversions and caveats visible. |
| Reliable sync    | Data engineer         | Ingest release-pinned data into an existing stack and reprocess only meaningful changes.                              |

A non-technical briefing interface may later compose these paths, but it is not
the first API product. Reverse selection, peer groups, signals, custom areas
and a broad profile catalogue do not enter the beta until a user of one of the
three paths demonstrates the need.

#### API UX and contract clarity

The API should feel like a small number of jobs, not a catalogue of subtly
different geography routes. `api/openapi.yaml` is the binding description of
the implemented v1 HTTP contract. This README is the product proposal,
roadmap and explanation of the resource model. A literal URI in this document
that differs from OpenAPI is conceptual or superseded; it is not an endpoint a
client should copy into production.

Keep v1 paths stable rather than renaming routes for tidiness. Make the mental
model explicit instead:

| Term                        | Meaning                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **Area**                    | One official, versioned identity: `{geography}/{release}/{code}`.                     |
| **Place**                   | An ambiguous name-resolution result from `/places`; it is never silently chosen.      |
| **Curated area collection** | An editorial grouping served by `/locations`, not a generic geographic `location`.    |
| **Source geography**        | The geography and code vintage on the publisher's observation.                        |
| **Geometry release**        | The caller-selected boundary release used only to join compatible geometry for a map. |
| **Observation period**      | The time period the measure describes.                                                |
| **Atlas release**           | The immutable published Atlas artifact set that produced the response.                |

The route selector in the documentation should begin with the user’s job:

| I need to…                                                           | Start here                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| resolve a name or inspect possible meanings                          | `/places`                                                          |
| inspect one exact official identity                                  | `/areas/{geography}/{release}/{code}`                              |
| get its geometry, relationships or citation                          | the corresponding area subresource                                 |
| draw a whole release as a map, or load its features into a warehouse | `/map-resources/{geography}/{release}` and its `features`          |
| render values or download source-exact observations                  | `/data/{measure}`                                                  |
| see a trend, ranking, comparison or change                           | `/series`, `/rankings`, `/compare` or `/change` under that measure |
| translate an identifier through a published crosswalk                | `/translations`                                                    |
| convert values under a declared measure/method rule                  | `/data/{measure}/convert`                                          |
| validate a supplied code/name or discover releases                   | `/areas:validate`, `/geographies`, `/boundary-releases`            |
| cite, attribute or inspect the published release                     | area citation, `/attribution`, `/atlas-releases` and `/validation` |

`/data/{measure}/value?place=` is a deliberately narrow convenience for a
place-name question. It resolves a name and dispatches to an existing
source-exact, series or aggregate result; it is not the primary way to fetch a
single observation. Keep that behaviour and label it “by place” in the docs.
A friendlier alias can be considered only in a future version, without making
v1 clients migrate.

Three related operations must never be conflated: `/translations` maps an
identifier through a published crosswalk; `/data/{measure}/convert` transforms
values only where the measure permits the declared method; the optional
`release` on a data request selects a code-compatible **geometry release** for
a map join and does not transform observations. Every data tutorial should
show the source geography, geometry release when present, observation period
and resulting `atlasRelease` together.

Implementation and documentation tasks:

- [x] Make OpenAPI the tested route inventory: generate or verify root links,
      route examples and the short endpoint list from one source, and fail a
      contract test when an implemented route, OpenAPI operation or public
      example disagrees. `tests/openapi.test.ts` checks the OpenAPI paths are
      exactly the routes the index advertises, and `tests/contract.test.ts`
      runs against the compiled catalogues: every advertised route must be
      served, the README endpoint list must name every advertised route and
      nothing else, and every concrete README example must return 200. Every
      OpenAPI response example names the request that produces it in
      `x-example-request` and must match that live response in structure,
      identifiers and text; counts and hashes are compared by type, since
      they change with every data build. Each problem code's schema example
      must be its example request's live response. The document is parsed
      strictly, so a repeated key fails the build.
- [x] Group every OpenAPI operation under task-oriented tags: **Start here**,
      **Map**, **Trend**, **Sync**, **Geography**, **Data catalogue** and
      **Governance**. Give each operation a plain-language summary, its
      success shape and its most likely refusal. Every operation carries
      exactly one of these tags and an `x-likely-refusal` giving the status,
      the stable `code` where there is one, when it happens and a request
      that produces it. `tests/contract.test.ts` sends each request and
      checks the status and code. A refusal no request can cause, a catalogue
      not built or a pinned release rebuilt, is named only where the
      operation takes no input a client could get wrong.
- [x] Publish a glossary, endpoint chooser and three copy-paste quick starts
      (correct map, defensible trend, reliable sync) which use only current
      OpenAPI routes. Treat them as executable contract tests. They are
      published in the OpenAPI description as `x-glossary`,
      `x-endpoint-chooser` and `x-quick-starts`, and rendered with every
      operation at `GET /v1/docs`. `tests/docsPage.test.ts` sends every quick
      start request and checks it answers as the guide says, deliberate
      refusals included, and holds the two tables above to the published ones.
- [x] Document the four clocks/identities above beside every data endpoint and
      response example. Do not rename v1 parameters; decide clearer names such
      as `observationPeriod`, `sourceGeography`, `geometryRelease` and
      `atlasRelease` only when designing a versioned successor. The OpenAPI
      description states them once, and the shared `SourceGeography`,
      `SourceBoundaryYear`, `SourcePeriod` and geometry `release` parameters
      carry that wording into every data route. No v1 parameter was renamed.
- [x] Define typed RFC 9457 problem schemas and examples for each advertised
      `code`, including machine-readable alternatives where useful. SDK users
      must be able to branch on a stable field rather than prose or unknown
      extensions. `src/problemCodes.ts` declares each code's statuses, the
      extension members it always carries, the alternatives it may offer and
      a request that produces it; a route cannot emit an undeclared code
      without failing the type check. Each code has an OpenAPI schema with a
      real example, and a contract test sends every example request and checks
      the response and the schema against the declaration.
- [x] State representation and pagination rules once: supported `format=` and
      `Accept` combinations, JSON `meta.nextCursor`, tabular `Link` headers,
      content type, caching and conditional request behaviour. Test every
      published representation rather than documenting aspirational headers.
      The OpenAPI description states them once, and `Accept` is documented as
      not negotiated because no route reads it. `tests/contract.test.ts`
      serves every representation the document declares for observations and
      lookups, checks the `Link` header on a tabular page, and pages all six
      cursor routes, including refusing a cursor the API did not issue.
- [ ] Preserve the existing colon convention and explain it: `:action` is a
      collection-wide selection or spatial action (`areas:contains`,
      `areas:validate`, `boundary-releases:resolve`); nested paths are resources
      or analyses of one identified resource. Do not add near-duplicate routes
      merely to make names sound more symmetrical.

#### Trust, currency and change intelligence

- [ ] Publish a machine-readable change feed, including the datasets, periods,
      values, definitions, boundary releases, crosswalks, named locations and
      validation results affected by an Atlas release. A changed artifact hash
      alone does not tell a customer whether its analysis changed.
      `GET /v1/atlas-releases/compare` now names the datasets, measures,
      boundary releases, crosswalks, named locations, validation exceptions,
      exports and lookups that changed between two releases; `detail=fields`
      identifies changed metadata fields in those published resource entries.
      Periods and values are not yet compared, and there is no feed to
      subscribe to.
- [ ] Expand release comparison from added/removed/changed artifacts to
      semantic diffs, with affected area and record counts where possible.
      Comparison now reaches resource level, naming each resource added,
      removed or changed by its recorded fingerprint. `detail=fields` names
      the changed metadata fields in a changed resource when both retained
      artifacts are available; it does not yet count affected areas or records
      or infer any row-level revision.
- [x] Serve an archived Atlas release or an equivalent immutable release-pinned
      download path, so an analysis can be reproduced as the Atlas published it
      at a stated time rather than merely inspecting its old manifest. Before a
      build replaces the current release, it snapshots every artifact the
      manifest declares and verifies its byte hash. `GET
/v1/atlas-releases/{release-id}/artifacts?artifact={artifact-id}` then
      returns the retained exact bytes with immutable cache semantics.
- [ ] State a source's publisher release date, Atlas ingestion date, expected
      refresh cadence and freshness status beside the measure metadata.
- [ ] Monitor upstream sources for a changed file, schema, URL, licence or
      expected publication date before a consumer discovers the difference.
      Publish whether an Atlas resource is current, revised, delayed, or
      awaiting review; the monitoring machinery itself remains internal.
- [ ] Give each validation exception a severity, affected resources, owner and
      remediation status, so a consumer can tell a qualified result from a
      blocking quality concern.
- [ ] Sign each Atlas release attestation, identifying the published manifest,
      build software revision and inputs. Hashes establish change detection;
      an attestation establishes who published the reproducible release.
- [ ] Version response schemas and publish compatibility diffs for added,
      removed or changed fields, units, enums and semantics. An integration
      customer must not discover a breaking contract change in production.
- [ ] Maintain a public correction register. The API remains read-only, while
      an editorial process records accepted correction reports, disputed
      mappings, resolutions and their effect on published resources.
- [ ] Publish a deprecation policy, availability and freshness targets, and a
      status endpoint before offering a paid reliability commitment.
- [x] Add conditional request support and clear cache semantics. Every `200`
      response carries a strong `ETag`, the SHA-256 of its bytes, with
      `Cache-Control: public, max-age=300, must-revalidate`; `If-None-Match`
      returns `304`, `HEAD` is served, and errors are `no-store`. No
      `Last-Modified` is sent, because a release records no build time and a
      guessed date would be a weaker validator than the `ETag`. Quota headers
      arrive with quotas, under the API-key work in Phase 3.

Candidate read-only routes:

```text
GET /v1/changes?since={release-or-timestamp}
GET /v1/atlas-releases/{release-id}/changes
GET /v1/atlas-releases/{release-id}/availability
GET /v1/atlas-releases/{release-id}/attestation
GET /v1/api-versions/{version}/changes
GET /v1/measures/{measure-id}/freshness
GET /v1/corrections
GET /v1/status
```

#### Geography-safe workflow primitives

- [ ] Extend batch area validation to diagnose mixed or stale code systems,
      duplicate values and ambiguous names, and to recommend only published
      conversion paths. It must remain a diagnosis, not silently rewrite a
      customer's data.
- [ ] Find and rank declared conversion paths between two exact area identities,
      exposing each intermediate release, method, coverage and quality.
- [ ] Make a small, carefully selected set of extensive measures available for
      fully validated conversion. Do not mark a measure convertible merely
      because a crosswalk exists; conservation, coverage and uncertainty rules
      must be declared and tested per measure/method pair.
- [ ] Let a caller provide a bounded list of canonical area references and
      receive a valid aggregate, comparison or profile, with every selected
      input, aggregation rule and coverage caveat echoed in the response.
- [ ] Add a read-only analysis preflight which selects no data. It states the
      source partition, conversion, aggregation rule, coverage, expected size
      and safer alternatives for a requested analysis before a caller builds a
      map, trend or data pipeline around it.
- [ ] Keep custom-geometry overlap as a design question, not a promised v1
      route. If evidence from the three golden paths justifies it, first define
      bounded input limits, caching, provenance, privacy/logging and a
      read-only computation contract. Do not put encoded geometry in a GET
      query string or turn the service into a general GIS endpoint.

Candidate read-only routes:

```text
GET /v1/areas:validate?geography={geography}&release={release}&value={value}
GET /v1/translations?sourceGeography={geography}&sourceRelease={release}&code={code}&targetGeography={geography}&targetRelease={release}&purpose={purpose}
GET /v1/areas/{geography}/{release}/{code}/conversion-paths?to={area-id}
GET /v1/data/{measure-id}/aggregate?area={area-id}&area={area-id}
GET /v1/analysis:plan?measure={measure-id}&period={period}&analysisGeography={geography}/{release}
```

#### Source evidence and explanation receipts

- [ ] Preserve a release-pinned source snapshot reference, retrieval metadata,
      original input hash and adapter version wherever the source licence
      permits it. Publisher URLs decay; a reproducible evidence trail should
      not depend on a live page remaining unchanged.
- [ ] Return a compact explanation receipt for any significant result. It must
      join the source and Atlas releases, input areas, conversion path,
      aggregation/indicator formula, quality, licence and caveats into one
      citable resource rather than leaving a consumer to reconstruct lineage
      from several endpoints.

Candidate read-only routes:

```text
GET /v1/datasets/{dataset-id}/source-snapshots
GET /v1/results/{result-id}/explain
```

#### Boundary-stable analysis geographies

This is the highest-value analytical capability. A caller should be able to
ask for a trend on an explicitly chosen analysis geography, such as current
local-authority boundaries, without pretending that a historic source row was
originally observed on that geography. The result separates source-exact and
derived observations and carries the chosen path, weights, coverage and
quality at every period.

- [x] Define an `analysis geography`: an exact geography and boundary release
      selected as the common frame for a series or comparison.
- [x] Publish reviewed source-to-analysis conversion pairs only where an
      official lookup or validated, measure-appropriate weighting method
      exists. The first pair is 2021 LSOA road-collision counts to May 2023
      local authorities through verified clean containment. A crosswalk
      suitable for land area is not automatically suitable for people, votes
      or rates.
- [x] Return `not-comparable` or separate source partitions where no defensible
      conversion exists. Never fill a gap with a same-code assumption or an
      unlabelled best fit: analysis preflight and series requests report that
      state rather than selecting an alternate source.
- [x] Test conservation of extensive values, coverage thresholds, rounding and
      uncertainty rules for each measure/crosswalk pair before publication. The
      release-pinned analysis validation artifact now runs each reviewed source
      period through its converter and fails on a missing code, split, non-numeric
      record, non-exact method or changed partition total. The first receipt
      records both final annual LSOA partitions: 27,199 2024 observations
      conserve a total of 96,759 into 318 local authorities, and 27,178 2025
      observations conserve 97,418 into the same 318 authorities.
- [x] Let a response state whether a change is observed on a common source
      geography, derived onto an analysis geography, or unavailable. Series
      responses use `derived` only after a reviewed conversion, and name the
      source, frame and crosswalk alongside it.
- [x] Let a reviewed analysis conversion name a published relationship path
      with `pathId` in `config/analysis-geographies.json` in place of
      `crosswalkId`. The build records the path's steps, validates the
      conversion as exact and conserving through every step, and series
      responses name the path and each crosswalk it runs through. Relationship
      paths now build before analysis geographies.

Candidate read-only routes:

```text
GET /v1/analysis-geographies
GET /v1/data/{measure-id}/series?area={area-id}&analysisGeography={geography}/{release}
GET /v1/data/{measure-id}/compare?baseline={area-id}&comparison={area-id}&analysisGeography={geography}/{release}
GET /v1/measures/{measure-id}/conversion-support?analysisGeography={geography}/{release}
```

#### Place discovery, comparison and briefing

The Atlas must also help a user find a place worth investigating, rather than
only answer questions about a known code. These routes are deliberately
constrained and explainable: they select over declared measures and profiles,
not an arbitrary query language or an opaque AI score.

- [ ] Support a bounded reverse query for areas meeting declared criteria, with
      stable sorting and pagination. Each result must carry the values, periods,
      geography and comparison caveats that made it match.
- [ ] Support explainable peer groups. A peer set may be neighbours, a region,
      a transparent similarity profile, or a caller-supplied canonical area
      list; it must state every input, standardisation, weight and exclusion.
- [ ] Publish a structured area brief/profile which answers: what changed,
      how the place compares with its stated peers, which values are unusual,
      whether the comparison is valid, and what source/caveat supports it.
      Rendered HTML or PDF is a representation of that structured evidence, not
      an uncitable black box.
- [ ] Add a boundary-change explorer which reports added, abolished, recoded,
      split, merged and redrawn areas, and supplies map-ready change resources.
      It must distinguish an official historical event from a geometry-derived
      comparison and never infer abolition from a missing code alone.

Candidate read-only routes:

```text
GET /v1/areas:select?geography={geography}/{release}&criterion={measure}:{operator}:{value}&sort={measure}:{direction}
GET /v1/areas/{geography}/{release}/{code}/peers?profile={profile-id}
GET /v1/areas/{geography}/{release}/{code}/brief?template={template-id}&format={json|html|pdf}
GET /v1/boundary-releases/compare?from={geography}/{release}&to={geography}/{release}
```

#### Production delivery

- [ ] Publish whole source partitions and crosswalks as immutable CSV, NDJSON,
      Parquet and GeoParquet downloads, with a schema, row count, hashes,
      licence/provenance block and Atlas release manifest. Source partitions
      are whole JSON downloads through `GET /v1/exports`, and crosswalks and
      area identities are CSV and NDJSON through `GET /v1/lookups`, each with
      its schema, row count, hashes and provenance under a pinned release.
      Boundaries are GeoParquet through a map resource's `features`; Parquet
      source partitions and lookups, and GeoParquet crosswalks, remain.
- [x] Deliver boundaries and selected measure joins as cached vector tiles or
      PMTiles. This is the correct map-scale interface; nationwide GeoJSON is
      not. One release is served as a PMTiles archive, its TileJSON and
      per-tile `.mvt` reads, with every published measure joining to it by code
      through a separate join table.
- [x] Compile topology-preserving collection/tile geometries for map delivery.
      The existing per-area simplification is appropriate for a feature query,
      but a map must not show cracks or divergent shared borders between
      neighbours. The release is decomposed into shared arcs and generalised
      one arc at a time, so two areas either share a border exactly or do not
      share it at all, at every tier.
- [ ] Provide pre-joined, release-pinned thematic resources for common mapping
      requests, rather than requiring every customer to repeat an area/value
      join.
- [ ] Publish examples and small reference clients for TypeScript, Python and
      GIS tooling. The operational product must be easier to use correctly than
      a direct publisher download.
- [ ] Provide OGC API Features and Tiles representations where the underlying
      resource fits those standards, alongside the Atlas REST contract. This
      lowers adoption friction in GIS tooling and public-sector procurement.
- [ ] Maintain reference implementations for a current-boundary time series,
      an evidence pack and a DuckDB/dbt synchronisation, so the safe path is
      also the shortest path for a consumer.
- [ ] Provide warehouse and BI integration assets: stable Parquet/GeoParquet
      URLs, a schema registry, a DuckDB catalogue, dbt source definitions and
      incremental "changed since release" recipes. For many data-engineering
      customers, the useful API is the one that fits directly into their
      existing stack.
- [ ] Add API-key plans only for operational benefits: higher documented
      limits, high-volume tiles/downloads, support and reliability targets.

Candidate read-only routes:

```text
GET /v1/exports/{export-id}?format=parquet
GET /v1/crosswalks/{crosswalk-id}/records?format=geoparquet
GET /v1/tiles/{resource-id}/{z}/{x}/{y}.mvt
GET /v1/downloads/{resource-id}.pmtiles
GET /ogc/features/collections/{collection-id}
GET /ogc/tiles/{collection-id}/{z}/{x}/{y}
```

#### Decision-ready profiles and future projects

- [ ] Define a small indicator registry for any area profile. Every indicator
      must name its source measures, formula, period, geography, freshness,
      comparability and caveats; do not market an opaque composite score.
- [ ] Publish a first-class concept and definition registry. Terms such as
      population, crime, households and broadband coverage have material
      variants; their definition, exclusions, geography and available measures
      must be discoverable instead of inferred from labels.
- [ ] Offer safe standardised indicators—such as real-terms currency,
      per-capita rates, ratios, percentiles and confidence-aware comparisons—
      only as named, tested recipes with declared denominators, deflators and
      comparability rules. Do not offer arbitrary server-side arithmetic.
- [ ] Group measures into transparent, curated topic packs such as local
      economy, housing pressure, connectivity or environmental context. A pack
      is a discoverable set of measures and presentation rules, not a claim
      that its members form one score.
- [ ] Make a profile answer the end user's practical questions: what changed,
      how the place compares with explicit peers, which values are unusual,
      whether the comparison is valid, and what evidence/caveats support it.
- [ ] Provide peer comparison only with an explicit peer definition: neighbours,
      region, similar authorities or a caller-supplied canonical area list.
- [ ] Return shareable, immutable evidence snapshots suitable for reports,
      bids and models, even when the consumer stores the project manifest.
- [ ] Publish qualified signals that draw attention to a threshold crossing,
      unusual change versus stated peers, source revision, new boundary or
      quality regression. A signal must expose its calculation and caveat; it
      is not a prediction or an opaque recommendation.
- [ ] Support Welsh/English names, locale-aware display metadata, accessible
      tabular alternatives to maps, deterministic classification/colour rules
      and plain-language caveats for public-sector and civic consumers.
- [ ] Specify a portable project-manifest schema now, but defer API-backed
      project creation, private uploads, saved matching rules, scheduled jobs,
      notifications and collaboration until customer demand justifies their
      state, authentication and privacy costs.

Candidate read-only routes:

```text
GET /v1/indicators
GET /v1/concepts/{concept-id}
GET /v1/topics
GET /v1/profiles/{profile-id}
GET /v1/areas/{geography}/{release}/{code}/profile
GET /v1/areas/{geography}/{release}/{code}/benchmarks?peer={area-id}
GET /v1/signals?area={area-id}&profile={profile-id}
GET /v1/snapshots/{snapshot-id}
```

#### Rights and location entry

- [ ] Extend attribution into a machine-readable rights assessment for a
      requested map, export, embed or commercial report. It should identify
      applicable source licences, any redistribution constraint, and ready-to-
      use attribution; it is an aid to compliance, not legal advice.
- [x] Add versioned postcode-to-geography resolution, including the postcode
      directory edition and containment method in every response.
- [x] Extend coordinate lookup to multiple explicitly selected geographies and
      add a nearest-area convenience route. Nearest must be labelled as a
      distance result, never as containment.
- [ ] Defer address/UPRN lookup, drive-time catchments, public-transport
      catchments and parcel/site intelligence until the data licences, update
      cadence and product vertical justify the greater cost and scope.

Candidate read-only routes:

```text
GET /v1/licensing:assess?measure={measure-id}&boundaryRelease={geography}/{release}&use={map|export|embed|report}
GET /v1/postcodes/{postcode}
GET /v1/areas:contains?lng={longitude}&lat={latitude}&geography={geography}&geography={geography}&date={date}
GET /v1/areas:near?lng={longitude}&lat={latitude}&release={geography}/{release}
```

#### Dataset priorities

- [ ] Add datasets when they improve a chosen recurring decision workflow, not
      merely because they enlarge the catalogue.
- [ ] Treat versioned ONS Postcode Directory mappings as the first practical
      addition for postcode-to-geography workflows. Keep a full address/UPRN
      product separate until its licensing, cost and permitted redistribution
      are understood.
- [ ] For a property, planning or infrastructure vertical, assess Land Registry
      price-paid data, EPC data, flood and planning-constraint layers, transport
      accessibility and business/labour-market indicators. Declare national
      coverage and comparability rather than implying UK-wide equivalence.
- [ ] Prefer a small number of timely feeds with a meaningful change cadence
      over a large number of static, weakly maintained datasets.

The test for a paid capability is not "can a user obtain this number from an
AI-assisted script?" It is: "does this keep a repeated decision correct and
defensible when the underlying data or geography changes?" If not, it is a
useful open API feature or acquisition tool, not the paid core.

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

| Capability        | What a caller gets                                                             | Why it avoids repeat work                                      |
| ----------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Dataset catalogue | Measures, units, periods, coverage, licences and source lineage                | Finds usable data before downloading it                        |
| Canonical areas   | Stable identifiers, aliases, parents, releases, bounds and geometry references | Removes name/code ambiguity                                    |
| Boundary releases | Valid geometry for a specified geography and vintage                           | Prevents mismatching a 2019 table to 2024 polygons by accident |
| Crosswalks        | Published, inferred, area-weighted or population-weighted mappings             | Makes conversions explicit and reusable                        |
| Named locations   | Versioned area sets for places such as Greater Manchester, Devon or London     | Makes common real-world scopes portable and inspectable        |

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
		| "contains"
		| "within"
		| "predecessor"
		| "successor"
		| "recode-of"
		| "split-from"
		| "merged-from"
		| "overlaps"
		| "equivalent-to";
	target: string; // canonical Atlas area id
	validFrom?: string;
	validTo?: string;
	method:
		| "official-lookup"
		| "clean-containment"
		| "same-geometry-recode"
		| "area-overlap"
		| "population-overlap"
		| "inferred";
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

The compiler produces eight separately versioned products:

1. **Areas** — every imported area identity, its names and aliases, validity,
   extent, geometry reference and provenance.
2. **Relationships** — directional containment, history and equivalence facts
   between exact source and target identities.
3. **Crosswalks** — directional weighted mappings, including their method,
   denominator, coverage and validation facts.
4. **Place definitions** — versioned, sourced definitions of countries,
   combined authorities, ceremonial or historic areas, and transparently
   editorial groupings. A definition is a set of anchored area identities; it
   is not silently promoted into a new official boundary type.
5. **Location projections** — materialised membership results for a place
   definition in a requested geography and boundary release, with the approved
   relationship path, membership meaning, shares and coverage.
6. **Spatial indexes** — release-specific candidate indexes for point
   containment, bbox intersection and nearest-area work. They reference
   geometry; they do not replace it or make an approximate bbox hit into a
   containment claim.
7. **Change events** — human-readable recodes, splits, mergers, abolitions and
   boundary changes linked to supporting evidence.
8. **Coverage report** — machine-readable statements of what is official,
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

### Geography Resolver: compiled core and roadmap

The **Geography Resolver** is the runtime component that answers a geography
question from published artifacts. The **Geography Compiler** creates and
validates those artifacts; the **gazetteer** is the compiled identity, name and
place data within them. The public capability remains the **Geography
Intelligence API**. These names distinguish behaviour, build process and data
without relying on an informal metaphor.

The resolver owns geography facts, not arbitrary statistical transformation. It
answers what an identity, place, coordinate or boundary relationship means;
the data layer may use a conversion only after checking that the measure is
suitable for it. In particular, weights can apportion counts and other
extensive quantities, but cannot make a rate, median or percentage safely
convertible on their own.

#### Core query model

There are three identities which must never be collapsed:

| Identity         | Example                                                    | Immutable key                                       |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Area             | Manchester LAD in a particular release                     | `geography / release / code`                        |
| Place definition | "Greater Manchester" as a combined-authority area          | `location / id / definition-revision`               |
| Relationship     | Ward wholly within an LAD; constituency overlapping an LAD | `relationship / source / target / method / release` |

A place definition is anchored to a published set of areas, usually local
authorities at first. Its projection is not a hand-maintained second list of
wards or constituencies. The compiler follows an approved relationship path,
checks it, and materialises the result under this key:

```text
location definition + target geography + target release + membership mode
  -> member areas + shares + completeness + path + provenance
```

This makes common requests direct indexed reads. It also means a target may be
honestly unavailable: the resolver must return the published paths that would be
needed, or `conversion_not_available`, rather than invent a route because two
codes happen to share a name or vintage.

Membership is deliberately more precise than a boolean:

- `direct-code-match` — the place is defined directly in the requested
  geography and release;
- `fully-contained` — every returned target area is wholly inside a member of
  the place, through a clean-containment relationship;
- `weighted-overlap` — a target touches the place with a stated share and may
  be partial;
- `intersects` — useful for discovery or mapping, but not a claim that a
  selected target belongs wholly to the place; and
- `covers` — a compiler finding saying whether a selected target set covers
  the place exactly, has gaps, or spills outside it.

This is what makes Greater Manchester → wards exact when the release publishes
clean ward-to-LAD containment, while Greater Manchester → constituencies stays
qualified. A constituency set that touches Greater Manchester can extend beyond
it; selecting it is not proof that the two boundaries are the same.

Relationships may be traversed in either direction, but their weights are not
symmetrical. A constituency → LAD share is a fraction of the constituency;
the reverse LAD → constituency result must be normalised against the LAD and
labelled as such. The compiler may compose only short, declared paths whose
methods and purposes are compatible. It must not expose an unrestricted graph
walk as a conversion feature.

#### Optimised serving model

The system is one logical geography resolver, not one eager JSON file. Build immutable,
sharded indexes suited to the query:

- canonical identity and normalised-name indexes for code/name resolution;
- forward and reverse relationship postings, plus a small catalogue of
  approved conversion paths;
- materialised place projections for published place × geography × release ×
  membership-mode combinations;
- per-release spatial candidate indexes, followed by exact geometry tests only
  for candidates; and
- separate raster indexes for terrain or other gridded environmental layers.

The release manifest pins every shard and compiler version. A response carries
the selected boundary release, definition revision, relationship/path IDs,
method, quality, coverage and artifact hashes. Expensive overlap, union,
topology and path-validation work happens during compilation; a request only
performs bounded index lookups and, for a coordinate, an exact test over the
small candidate set.

#### Roadmap

1. **Complete the identity foundation.** Compile every supported
   geography/release into canonical identities, aliases, coverage and absence
   states. Keep release selection by date explicit and nation-aware.
2. **Complete the relationship graph.** Publish clean containment, official
   history and reviewed overlap crosswalks in both directions. Add compiler
   invariants for endpoint resolution, containment cardinality, weights,
   coverage, slivers and historical continuity.
3. **Make places first-class.** Give each country, combined authority,
   ceremonial/historic area and editorial grouping a source, definition
   revision and validity interval. Materialise and validate its projections;
   publish `fully-contained`, `weighted-overlap`, `intersects` and `covers`
   semantics rather than a bare list of codes.
4. **Publish approved paths and capabilities.** Let callers discover whether a
   requested source/target/purpose is exact, available with weights, available
   only for membership, or not published. Explain every multi-step result
   without choosing a conversion path silently.
5. **Generalise coordinate intelligence.** Extend `areas:contains` to accept
   several explicitly requested geographies and a date/selected releases,
   using the compiled spatial indexes. Return all matches on a shared border,
   coordinate precision/tolerance, CRS transformation metadata and an explicit
   outside-coverage result. Add nearest-area separately, with distance but no
   containment implication; add bounded batch lookup for point datasets.
6. **Add terrain and contextual layers.** Serve elevation, slope, aspect and
   other raster-derived context through separate versioned products. Every
   elevation answer states its horizontal/vertical CRS or datum, units,
   raster resolution, interpolation method, source date and uncertainty.
   Altitude normally does not affect LAD, ward or constituency containment:
   those are two-dimensional ground footprints.
7. **Expand deliberately.** Add OA → LSOA → MSOA → LAD hierarchies and their
   Scottish/Northern Irish equivalents, then non-administrative geographies
   such as police, NHS and travel-to-work areas only with a named source,
   release cadence and qualified relationship method.

The compiler's capability report is the roadmap's guardrail. It must expose
what is available, partial, unsupported or awaiting source data for every
geography/release pair, place projection and coordinate layer. That prevents
the public API from overclaiming while still making the next useful mapping
obvious.

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

Every served measure also carries a `unitDefinition`. This is API-owned
canonical metadata alongside—not instead of—the source-facing `unit` label:
`£ million` is `GBP` with `scaleToCanonical: 1000000`, while `percent` is a
`proportion` with `scaleToCanonical: 0.01`. An explicit denominator is carried
as `per` (for example, `premises`). The API does not rewrite any source artifact
or observation value; clients can use this metadata to make compatible derived
calculations explicit and reject incompatible inputs.

For numeric observations, `GET /v1/data/{measure-id}?units=canonical` opts in
to a served calculation: values and any publisher-supplied interval bounds are
multiplied by that declared scale, and `valueRepresentation` records the exact
unit and calculation. The default remains the untouched source values; the
canonical representation currently uses JSON so a tabular download cannot be
misread.

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

| Method                  | Meaning                                                                                | Appropriate use                                             |
| ----------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `official-lookup`       | Publisher supplied an explicit correspondence                                          | Preferred whenever available                                |
| `same-geometry-recode`  | 1:1 code/name change with unchanged geometry                                           | Safe identity migration                                     |
| `same-code-continuity`  | A code shared by two releases of one geography whose extent held, verified by geometry | Identity migration between releases; derived, never assumed |
| `clean-containment`     | A published parent code or verified nesting relation                                   | Membership and exact roll-up                                |
| `geometric-containment` | Every child sits within one parent, established from the two releases' geometry        | Membership where no lookup carries the hierarchy; derived   |
| `area-overlap`          | Geometry intersection, weighted by area                                                | Land-area quantities; not people by default                 |
| `population-overlap`    | Fine-grained population building blocks apportioned across targets                     | Counts whose distribution follows resident population       |
| `inferred`              | Carefully documented heuristic, for example recovered ward-to-LAD membership           | Discovery/matching; requires a warning                      |

The response must always state whether weights cover all source area, whether
they sum to one, the weighting denominator/date, topology/geometry inputs, and
the expected error or limitations. A conversion from ward to LAD is not the
same kind of claim as a 2024 constituency to 2019 constituency approximation.

## Conceptual resource model (not the v1 route contract)

> **Contract status:** `api/openapi.yaml` is the concrete current v1 contract.
> This section preserves the proposed resource model and product semantics.
> Literal URIs here that differ from OpenAPI — for example `/v1/releases` or
> `/v1/areas/{area-id}` — are not implemented v1 routes and must not be copied
> into client code. When a roadmap capability becomes real, update OpenAPI,
> route tests and executable examples first, then reconcile this section.

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
	"label": "Population estimate",
	"valueKind": "count",
	"aggregation": { "kind": "extensive", "operation": "sum" },
	"sources": [
		{
			"datasetId": "population",
			"periods": ["2022"],
			"sourceGeography": { "type": "ward", "boundaryYear": 2023 },
			"coverage": { "kind": "partial", "includes": ["England", "Wales"] }
		},
		{
			"datasetId": "population-uk",
			"periods": ["2011", "…", "2024"],
			"sourceGeography": {
				"type": "localAuthority",
				"boundaryYear": 2023
			},
			"coverage": {
				"kind": "source-reported",
				"includes": ["England", "Wales", "Scotland", "Northern Ireland"]
			}
		}
	],
	"links": {
		"data": "/v1/data/population-estimate"
	}
}
```

Each source partition has its own code vintage and coverage. Neither the ward
nor local-authority source establishes whether a May or December 2023 geometry
should be silently selected, so the API does not make that choice. The
production catalogue must only make the claim supported by the actual input
data.

### 2. Find places and inspect geography

```
GET /v1/areas/{area-id}
GET /v1/areas:resolve?q=manchester&type=local-authority&release=2025-05-uk-bgc-v2
GET /v1/areas:resolve?code=E07000026
GET /v1/areas/{area-id}/ancestors
GET /v1/areas/{area-id}/descendants?type=ward
GET /v1/areas/{area-id}/relations?type=constituency
GET /v1/areas/{area-id}/history
GET /v1/areas:contains?lng=-2.2426&lat=53.4808&geography=ward&geography=localAuthority&geography=constituency&date=2025-06-01
GET /v1/areas/{area-id}/geometry?format=geojson&simplification=standard
GET /v1/boundaries/{geography}/{release}/features?bbox=-2.7,53.3,-1.9,53.8
GET /v1/boundaries/{geography}/{release}/tiles/{z}/{x}/{y}.mvt
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
endpoint. It accepts a coordinate and up to four geographies with pinned or
date-selected releases, and returns all matching areas with boundary versions.
`/areas:containsBatch` takes at most 100 points. Neither is a replacement for
a bulk geocoder or spatial-analysis service.

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
		"members": ["local-authority/2025-05-uk-bgc-v2/E08000001"]
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
GET /v1/translations?sourceGeography=constituency&sourceRelease=2024-07-uk-bgc&code=E14001262&targetGeography=localAuthority&targetRelease=2025-05-uk-bgc-v2&purpose=membership
```

`GET /translations` is the read-only convenience route for one interactive
translation, rather than forcing callers to discover an opaque crosswalk
identifier first. Its query supplies the source geography, release and code,
the target geography and release, and an explicit `purpose`. Bulk translation
is an immutable crosswalk download, not a request which creates server state.

```json
{
	"results": [
		{
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
		}
	]
}
```

The API needs separate `purpose` values:

- `membership`: return all intersecting/mapped target areas; weights are useful
  metadata, not an instruction to apportion values.
- `identity`: allow only `official-lookup` or `same-geometry-recode`; otherwise
  return no single answer.
- `apportion`: return weights and require the caller to acknowledge the chosen
  method, or use the data endpoint's conversion option.

`GET /v1/translations` accepts the desired source and target in either order.
Every match labels its direction relative to the published crosswalk and
retains its original provenance. For a reverse `area-overlap` result,
`sourceCoverage` is the share of the queried area represented by published
overlaps; `weight` is normalised over that coverage, while `sourceShare` and
`targetShare` are expressed in the returned direction.

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
requested geometry; `format=csv`, `ndjson`, and `parquet` are exports. The
initial public service remains read-only: results beyond a documented row or
byte limit return a release-pinned static bulk resource rather than creating an
asynchronous export job. A later authenticated product may add managed export
jobs only after the read-only API has demonstrated that the added state and
privacy surface are justified.

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
GET /v1/data/population-estimate/aggregate?period={period}&geography={source-geography}&boundaryYear={source-boundary-year}&locationId={location-id}
GET /v1/data/population-density?area=location/devon@2026-09&period=2022
```

The first route is currently safe only when every named-location member code
occurs directly in the selected source partition; it never converts codes or
returns a partial sum. For density, the service calculates `sum(population) / union-area`, retaining
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
GET /v1/provenance/boundaries/{geography}/{release}
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
- `area_not_in_release` — the release does not hold the requested area code;
  `absence` says whether the code is superseded, not yet current, or unknown;
- `conversion_required` — source and requested geography differ;
- `conversion_not_available` — no defensible crosswalk exists; `absence`
  says whether the named crosswalk starts at another geography, leaves source
  areas unmapped, or splits them with no published weight;
- `conversion_not_authorised` — caller requested a non-approved method;
- `aggregation_not_supported` — measure semantics make the operation invalid;
- `partial_coverage` — result is possible only with missing/suppressed areas;
- `licence_restricted` — original licence prevents the requested redistribution.

Partial coverage is normally a `200` response with an explicit quality flag;
it should not look like success with a mysteriously short row set.

## Capability contract

A caller asks the Atlas the same question in several places: can I have this
here? An area's capabilities, a measure's coverage of a boundary release and a
relationship path all answer it, and they answer in one vocabulary, with a
`reason` on every status but the first:

- `available`: served directly, and completely for what was asked.
- `partial`: served directly, but only for part of it, such as some periods
  or a release with areas the source gives no value for.
- `requires-conversion`: not served directly, but a published conversion path
  answers it. The answer names each conversion with its crosswalk, source
  partition and period, and a link to the convert route.
- `unsupported`: nothing the Atlas publishes answers it.
- `not-built`: this deployment has not built the artifact that would say.

A conversion is claimed only once it is known to work. The capability runs the
same conversion the convert route would, on the source partition's latest
period, and offers it only if it is accepted and, for one area, reaches that
area. A measure whose values do not add over areas is never offered one.

`unsupported` and `not-built` are kept apart deliberately. The first is a fact
about the Atlas, such as a release no crosswalk names; the second is a fact
about the deployment answering, and a fuller build may change it.

The vocabulary is `CAPABILITY_STATUSES` in `src/capability.ts`, and the
OpenAPI document declares it as `CapabilityStatus`. The contract tests require
the two to agree, and walk live capability answers for areas in all four
nations, measure coverage of several releases and relationship paths, failing
if any answer strays outside the vocabulary, omits a reason, or offers a
conversion the convert route does not serve.

## Operations contract

How the server is run, as opposed to what it answers. None of this is under
`/v1` or in `openapi.yaml`, because none of it is for a client of the API.

### Versioning and release pinning

Two things can change under a client, and each is pinned separately.

- **The contract** is pinned by the path. Within `/v1` it only grows. An
  operation, parameter, status, media type or response property is never
  removed, a parameter never becomes required, and none accepts less than it
  did. `contract/v1-surface.json` records the surface of `openapi.yaml`, and
  `tests/apiSurface.test.ts` refuses a change that breaks it. An addition must
  be locked with `pnpm contract:surface`, which itself refuses to lock a
  breaking change. The one way out is deprecation: an operation marked
  `deprecated: true` with `x-deprecated-since` and `x-sunset` dates is served
  with `Deprecation` and `Sunset` headers, and may be removed once its sunset
  has passed. A change that breaks anything else needs `/v2`.
- **The data** is pinned by the Atlas release. Every response carries an
  `Atlas-Release` header, and JSON responses name it in the envelope too. A
  path under `/v1/atlas-releases/{release-id}/` answers as the unpinned path
  does and is marked `immutable`. One server serves one release: a pinned path
  to a release it no longer serves is `410 Gone`, never answered from another.

### Endpoints

| Path       | Answers                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `/healthz` | `200` while the process is serving.                                                              |
| `/readyz`  | `200` with the release served and the geometry cache's state; `503` once the server is draining. |
| `/metrics` | Prometheus text. Behind `Authorization: Bearer` when `ATLAS_METRICS_TOKEN` is set.               |

None is cached or rate limited: a refused probe would take a healthy instance
out of service.

Metrics label a request by the OpenAPI template it reached, such as
`/v1/areas/{geography}/{release}/{code}`, and a pinned request by the same
template under `/v1/atlas-releases/{release-id}`. A path matching no template
is `unmatched`, so a scan of made-up paths cannot grow the series. Besides
request counts, durations and bytes, the server exports rate-limit refusals,
unhandled errors, process memory, event loop delay and the geometry cache's
area reads, release loads, evictions and load time. Handlers run synchronously, so event
loop delay is the first sign of a slow request: typically a geometry release
being read for the first time.

### Logs and errors

`pnpm start` writes one JSON object per line to standard output. Each request
is logged with its request id, method, operation template, path, status,
duration, bytes and any problem `code`. A request that throws is answered
`500` with a `requestId` and no internal detail, logged at `error` with its
stack, and passed to `onError`, where an error tracker can be attached; the
server keeps serving. A route answering `5xx` itself, such as a catalogue not
built, is logged at `warn`. An exception outside a request is logged and ends
the process for its supervisor to restart. A client's `X-Request-Id` is used
when it is 1 to 128 letters, digits and `._:-`, so its logs and the server's
line up.

### Limits

- **Rate limit:** a token bucket per client, see the checklist above. At most
  100,000 clients are remembered; the least recently seen is forgotten first,
  and starts again with the full bucket it would have earned anyway.
- **Request target:** longer than `ATLAS_MAX_URL_LENGTH` is `414`.
- **Slow clients:** headers must arrive within 15 seconds and the whole
  request within 30; idle keep-alive connections close after 5.
- **Geometry cache:** a count of releases, because one costs 60 to 400 MB of
  heap. A rising eviction count means the cache is too small for the traffic.
- **Shutdown:** on `SIGTERM` the server reports not ready, stops accepting
  connections, finishes what it holds, and closes whatever is left after the
  grace period.

### Configuration

Every setting is read once at start, and a malformed value stops the server
rather than falling back to the default.

| Variable                             | Default     | Meaning                                                                                      |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| `PORT`                               | `3001`      | Port to listen on.                                                                           |
| `HOST`                               | `127.0.0.1` | Address to listen on.                                                                        |
| `ATLAS_RATE_LIMIT_CAPACITY`          | `600`       | Requests a client may make at once; `0` turns limiting off.                                  |
| `ATLAS_RATE_LIMIT_REFILL_PER_SECOND` | `10`        | Requests earned back each second.                                                            |
| `ATLAS_TRUSTED_PROXY_HOPS`           | `0`         | Proxies in front of the server that append to `X-Forwarded-For`.                             |
| `ATLAS_GEOMETRY_CACHE_RELEASES`      | `3`         | Geometry releases held in memory at once.                                                    |
| `ATLAS_METRICS_TOKEN`                | unset       | Bearer token `/metrics` requires; unset, it is open.                                         |
| `ATLAS_ACCESS_LOG`                   | `on`        | Log every request, not only failures.                                                        |
| `ATLAS_MAX_URL_LENGTH`               | `4096`      | Longest request target served.                                                               |
| `ATLAS_SHUTDOWN_GRACE_SECONDS`       | `10`        | Time to finish open requests after `SIGTERM`.                                                |
| `ATLAS_TERRAIN_REMOTE_ENDPOINT`      | unset       | ArcGIS ImageServer `getSamples` endpoint for the non-persistent EA terrain preview provider. |
| `ATLAS_TERRAIN_COVERAGE_ENDPOINT`    | unset       | Optional ArcGIS FeatureServer query endpoint used to verify exact coverage before sampling.  |
| `ATLAS_TERRAIN_REMOTE_TIMEOUT_MS`    | `5000`      | Maximum time for one remote terrain request.                                                 |
| `ATLAS_TERRAIN_REMOTE_CONCURRENCY`   | `4`         | Maximum concurrent remote terrain requests.                                                  |

### Deployment smoke test

`pnpm smoke <base-url>` checks a deployed server and prints TAP, exiting
non-zero on any failure. It checks the contract rather than what one release
contains, discovering every id it needs from the server, and loads no geometry
release, so it passes unchanged from release to release and is cheap enough to
run on a schedule. It checks liveness and readiness, discovery and the
`Atlas-Release` header, that OpenAPI documents every index link, request ids,
a `304` revalidation, `HEAD`, a cross-origin preflight, problem details for
`404` and `405`, the release manifest, an immutable pinned response and a
refused unknown pin, an area and an observation, the validation report, rate
limit headers and metrics. Where a check cannot apply, such as rate limit
headers with limiting off or protected metrics without
`ATLAS_METRICS_TOKEN`, it is skipped with the reason rather than passed.

## Resolution contract

This is the contract for the layer every data route sits on: the gazetteer and
Geography Resolver that answer, once, the question each route used to answer for itself.
It was written before the code for the same reason the
[map resource contract](#map-resource-contract) was, and the same rule
applies: where this section and a route disagree, this section is what the
route should become.

The selection half is built and every route that chooses a partition uses it.
Composition across datasets is not built, and is marked so below.

### The question that was answered three different ways

A data route does the same five things in sequence: find the measure, choose
the source partition, decide whether the requested geometry is compatible,
read the observations, and refuse with something useful when it cannot. Each
route used to do all five itself, and they had drifted:

- `dataRoutes`, `dataAggregateRoutes`, `dataConversionRoutes`,
  `dataRankingRoutes` and `dataTransformRoutes` matched a source on period,
  geography and boundary year, and took the first that matched.
- `dataChangeRoutes` matched on geography and boundary year only, because
  change is measured inside one partition and the periods are checked after.
- `dataSeriesRoutes` collected every match and refused unless there was
  exactly one, and was the only route accepting a `datasetId` to
  disambiguate.
- `bulkRoutes` matched on dataset, geography, boundary year and the whole
  period set.

So "which source serves this measure here" had three different answers
depending on which route was asked. No measure exposed the difference: of the
148 published, none has two sources sharing a geography and boundary year, so
the `find` that took the first and the `filter` that refused ambiguity agreed
everywhere. It was a trap set for the measure that breaks the tie, not a fault
a caller could hit.

The resolver makes that one function with one answer, so a new route inherits
the rules instead of restating them. The strictest of the three won: more than
one match is refused with the choices, never resolved by catalogue order.

### What the resolver returns

One call, and exactly two possible answers. It is given what a caller asked
for — a measure, a period or period range, a source geography, optionally a
geometry release, optionally a named conversion — and it returns a **plan** or
a **refusal**. It never returns data: a plan says what to read and how to read
it, and the route reads it.

A **plan** names, for every value it will produce:

- the **source partition**: dataset, source geography, boundary year, period;
- the **join**, where a geometry release was asked for: the release, and the
  compatibility status it was accepted on, which is one of
  `exact-code-set` or `code-set-compatible`. A join matches codes and changes
  no value;
- the **conversion**, where one was asked for: the crosswalk, its method
  (`exact` or `area-weighted`), and what it does not cover;
- the **provenance** for the answer as a whole, and per area wherever the
  areas did not all come from the same place;
- the **quality**: the coverage of the source against the target, and any
  area the source does not carry.

A **refusal** is the more important half. It carries the stable `code` a
client branches on, and it must also carry **what would have worked**: the
periods that do exist, the boundary releases whose code sets do match, the
crosswalks that do reach the target. A refusal that only says no is a bug in
this contract. The codes are the ones already declared in
`src/problemCodes.ts` — `unsupported_geography`, `area_not_in_release`,
`conversion_not_available`, `incompatible_geometry`, `partial_coverage` and
the rest — and the resolver may not invent one outside that list.

### It reports what is possible; it does not take the liberty

The resolver knows more than the caller asked. It knows which releases the
codes would land on, which crosswalks reach the target, and which other
dataset covers the nation this one misses. **It says so, and it stops there.**

- It never chooses a geometry release on a caller's behalf.
- It never converts because a conversion happens to exist. Conversion stays
  what it is today: opt-in, asked for by name at `/data/{measure-id}/convert`,
  refused when its quality cannot be defended.
- It never substitutes one dataset for another to fill a gap.

What changes is that the possibilities become visible. A refusal names the
conversions that would work. A capability response says what this measure can
be asked for. The caller still decides, and the decision is still recorded in
the URL they sent. This keeps
[source-exact by default](#focus-rules) exactly as it stands: the resolver
makes the API better at explaining itself, not freer to guess.

### Filling a hole from another dataset

The valuable case — England from one publisher, Scotland from another — is
real, and it is not silent substitution. It is a **declared composite
measure**: a measure whose catalogue entry names its parts, the geography and
periods each part covers, and the rule for which part wins where they overlap.
Then:

- every value carries the dataset it came from, per area, not per response;
- the composite is gated in the validation report like any other measure, so
  a part that stops covering what it claims fails the build;
- `composite` is visible on the measure, so a caller who wants one publisher
  only can refuse it;
- a gap no part covers stays a gap, reported through `partial_coverage`.

A composite is a catalogue decision, made once and reviewed, not a fallback
the resolver improvises per request. Nothing here is built: it needs a
catalogue schema change and a validation check, and it should follow the
resolver rather than arrive with it.

### Built once, at build time

The resolver answers from precompiled indexes, not by searching catalogues on
each request. The build already produces most of what it needs —
`area-inventory.json`, `boundary-releases.json`, `crosswalk-inventory.json`,
`geography-inventory.json`, the relationship candidates and the per-measure
compatibility inventory. What is missing is the index that ties them together:
for every measure, the partitions it has, the releases each partition can be
drawn on, the crosswalks that leave it, and the periods available. That index
is a build artifact with a content hash, gated by the validation report, and
stale-fails the build like every other.

Two consequences worth stating plainly. A request-time answer is a lookup, so
the resolver cannot be the reason a route is slow. And the index is a single
artifact a person can read, so "what can this API answer about this measure"
stops being a question you answer by reading eight route handlers.

### What the resolver is not

It is not a query engine: it plans one measure's retrieval, not joins across
measures. It is not a geocoder; place-name resolution stays in
`placeResolver`, ambiguity-preserving, and the resolver consumes its output
rather than replacing it. It does not cache values, only plans. It does not
decide policy: which conversions are defensible and which composites exist
are catalogue and validation decisions, and the resolver enforces them rather
than forming them.

### How routes adopt it

A route asks for a plan and reads what the plan names. It does not choose a
partition, and it does not decide whether a geometry release may carry one.
It still validates its own parameters, because which of them a route requires
is part of that route's published contract and not the resolver's business,
and it still reads the observations, because the resolver plans and does not
fetch.

Each route was migrated on its own, landing with the tests it already had
passing unchanged: a plan for a request that worked before must produce the
response that was served before. Each migration was checked by serving every
measure and period against the previous commit and comparing whole responses,
so the only differences are refusals that gained the alternatives they now
carry.

**One route does not use it, and should not.** `bulkRoutes` matches an export
to the source that produced it, on the dataset and the exact period sequence
its manifest recorded. That is not "which partition serves this query", so
putting it through the resolver would mean teaching the resolver a question it
should not be asked.

An earlier draft of this section said the work was finished when no route
imported an observation artifact. That was the wrong line to draw: reading is
what routes are for, and the resolver was never meant to take it over. The
line that matters is the one above — no route decides for itself which
partition answers a request.

## Map resource contract

This is the contract that [P1 items 10 to
12](#p1--prove-the-correct-map-product) build against, written before any of
it so the tile format was decided here rather than by whichever encoder was
reached for first. It supersedes the map-shaped candidate routes sketched in
the non-binding [conceptual resource model](#2-find-places-and-inspect-geography)
and [commercial roadmap](#production-delivery); where they disagree, this
section wins.

All seven routes below are served, as is the pinned form. The flat
`features` form is GeoParquet only; GeoJSON is not built, because a whole
release at `full` detail is the nationwide GeoJSON a map should not download.

### What a map resource is

A **map resource** is one compiled boundary release, prepared for drawing. Its
identity is the boundary-release identity used everywhere else in this API,
`{geography}/{release}`, under an immutable Atlas release. Nothing else
identifies it: not a tolerance, not a zoom, not a measure.

```text
GET /v1/map-resources
GET /v1/map-resources/{geography}/{release}
GET /v1/map-resources/{geography}/{release}/tiles.json
GET /v1/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt
GET /v1/map-resources/{geography}/{release}.pmtiles
GET /v1/map-resources/{geography}/{release}/join/{measure-id}?period={period}&format={json|parquet}
GET /v1/map-resources/{geography}/{release}/features?tier={tier}&format=geoparquet
```

Each also answers under `/v1/atlas-releases/{release-id}/...`, which is the
form a production map should use; see
[Caching](#caching-and-release-pinning) below. Only the release the server
currently holds can be answered: the archive keeps release manifests, not the
data files behind them, so a release that is recorded but no longer served is
refused with `410` rather than quietly answered from the current one.

The descriptor at `/v1/map-resources/{geography}/{release}` is the only
document a client needs to read: it carries the tile and archive URLs, the
zoom range, the generalisation table, every content hash, the attribution
block and the measures that may legally be joined to it.

### Values are joined by the client, never baked into the tiles

A tile carries identity, not statistics. Every feature has exactly two
properties:

- `code` — the area code in this geometry release;
- `name` — the area's name in this release, for labels and tooltips.

and a feature `id`, a stable integer the compiler assigns per resource and
publishes in the join table. Vector-tile feature ids must be integers, and
MapLibre's `feature-state` needs one, so it is part of the contract rather
than an encoder detail: the same area keeps the same `id` for the life of the
resource.

Values arrive separately, from
`/v1/map-resources/{geography}/{release}/join/{measure-id}?period=`, as a
compact table of `id`, `code` and value under the usual envelope. The client
joins in the renderer. This is the whole point of the design:

- one tileset serves every measure, so tiles are compiled once per release;
- a corrected value invalidates a small join table, not a tile pyramid;
- the join table is the same shape whatever the measure, so a customer's
  renderer or warehouse code is written once.

**The join is by code, and never by conversion.** A join is legal only when
the measure's source geography and boundary year resolve to the codes this
geometry release publishes. Where they differ the request is refused with
`incompatible_geometry` (422), naming the measure's source geography, the
geometry release and the `/v1/measures/{measure-id}/compatibility` evidence.
The code is the one `/v1/data/{measure-id}` already returns when a caller
asks for a release that does not hold every source code; a map resource
applies the same rule to the shapes. To map a measure published on
another geography, call `/v1/data/{measure-id}/convert` first and map its
result as the resource it declares. The map layer performs no conversion; a
drawn shape must never imply a value was moved between geographies.

### Topology tiers

The generalisation already served by
`GET /v1/areas/{geography}/{release}/{code}/geometry?tier=` simplifies one
area in isolation. That is correct for a feature query and wrong for a map:
two neighbours simplified independently diverge along the border they share,
leaving visible cracks and overlaps.

A map resource is therefore compiled from a **shared-arc decomposition**. The
release's boundaries are split into arcs, each arc simplified once, and every
area rebuilt from the simplified arcs. Two areas that shared a border before
simplification share the identical coordinate sequence after it, at every
tier, by construction rather than by tolerance.

The tier names and their tolerances are the same ladder as the per-area route
(`full`, `high`, `medium`, `low`), because the thresholds are the same
metres. The compiler is not. So:

- every geometry response declares its `topology`, `per-feature` from the
  per-area route and `shared-arc` from a map resource;
- the two are not interchangeable. A shape taken from one must not be drawn
  against a shape taken from the other, and the descriptor says so.

Tiles do not take a tier. A tile pyramid generalises per zoom level, and the
descriptor publishes the zoom-to-tolerance table it used. Tiers appear only on
the flat `features` form, where the caller picks the detail it wants.

Two obligations fall on the compiler, both testable:

- **Shared edges.** For every pair of areas adjacent in the release, the arc
  they share is coordinate-identical in both features, at every published tier
  and every published zoom. This is P1 item 10's release gate.
- **No silent disappearance.** Every area in the release appears in every
  tier, as a valid, non-empty geometry. Where a tier would erase an area or
  one of its parts, the compiler keeps that part at the finest tolerance that
  survives and records it in the descriptor. A map that quietly loses the
  Isles of Scilly is a wrong map, not a generalised one.

### Attribution

A map resource carries the same attribution block that `/v1/attribution`
returns for its boundary release, and a join table adds the blocks for the
measure's source datasets. Licence names are reproduced as the publisher
states them and are not interpreted, as everywhere else.

Tiles cannot carry a licence, so the descriptor, the TileJSON `attribution`
field and the PMTiles archive metadata each carry a ready-to-paste
attribution string for a map corner. A tile URL handed to a renderer without
its TileJSON is an incomplete citation, and the descriptor says which string
to display.

### Caching and release pinning

Two URL forms, with deliberately different cache policy:

- **Pinned**, under `/v1/atlas-releases/{release-id}/map-resources/...`. The
  bytes can never change, so these are served
  `Cache-Control: public, max-age=31536000, immutable` and are never
  revalidated. A production map, a saved analysis and a PMTiles archive all
  cite this form.
- **Unpinned**, under `/v1/map-resources/...`. Answers under whichever Atlas
  release the server has loaded, and keeps the standard
  `public, max-age=300, must-revalidate` with an ETag. This form is for
  discovery: it tells a client which pinned URL to use, and the descriptor it
  returns names that URL.

Tiles carry the same strong ETag as every other response, the SHA-256 of the
bytes served, so a CDN and a client revalidate a tile exactly as they
revalidate JSON.

One exception to the rule that every failure is `application/problem+json`: a
tile inside the resource's declared zoom range that covers no area returns
`204 No Content`, cached like the resource. An empty tile is an ordinary
answer for a renderer, not an error. A tile outside the declared zoom range,
or for an unknown resource, is a `404` problem document as usual.

### Content hashes

The chain from publisher file to drawn pixel must be checkable without
trusting this API:

- the descriptor records the geometry source's `inputHash`, already held in
  the geometry source registry, so the publisher file behind the shapes is
  named;
- each compiled artifact — the tile pyramid, the PMTiles archive and each
  flat `features` representation — declares `contentHash` and `bytes`, in the
  `sha256:` form the export manifest and validation report already use;
- each tile's ETag is the hash of its own bytes;
- a join table declares the content hash of the observation artifact it was
  compiled from, which is the same hash `/v1/exports` publishes.

A client that has fetched a pinned tileset, a join table and the Atlas
release can therefore prove the three agree, which is what makes a map
citable.

### Source release and geometry release are different things

The distinction the rest of this API insists on holds here too, and a map is
where it is easiest to lose:

- the **geometry release** is `{geography}/{release}`: the shapes drawn;
- the **source geography** is the geography and boundary year the measure's
  values are published on;
- the **observation period** is the period those values describe;
- the **Atlas release** pins all three, and appears in the pinned URL.

A map resource selects geometry. It never selects, converts or reinterprets a
value. Where the first three cannot be reconciled by code, the join is
refused rather than approximated.

### Not in this contract

No custom or uploaded geometry. No server-side styling, no raster tiles, no
legend or classification service. No pre-joined thematic tilesets beyond the
join table above. No OGC API Tiles representation, which stays deferred until
a design partner needs it. No asynchronous map exports. Each would be a
separate contract, and none is required by the correct-map beta.

## Analysis contract

Phase 1 specified this contract; the first narrow Phase 2 slice now publishes
one reviewed source-to-analysis pair and its preflight. It does not generalise
conversion: a frame is available only when this contract and a checked-in
support artifact name the exact measure, source partition and crosswalk.

What this deliberately does not specify: any custom or caller-supplied
geometry, any general analysis or query endpoint, and any widening of which
conversions exist. Conversion stays what it is — declared per measure, asked
for by name, refused when its quality cannot be defended.

### An analysis geography is declared, not chosen

An **analysis geography** is an exact geography and boundary release, named as
the common frame a series or comparison is expressed on. `localAuthority` on a
2023 release is one. It is not a new kind of area and it holds no data of its
own; it is the frame a caller says they want their answer in.

The critical restriction: a caller may name only a frame the Atlas has
published as supported, and support is per measure. It is published where, and
only where, a conversion path exists whose method suits that measure's own
semantics:

- an `extensive` measure, one that sums, may be converted where the crosswalk
  carries a weight appropriate to what is being counted, or where the method
  is an `official-lookup` or `clean-containment` that needs none;
- an `intensive` measure, a rate or a mean, may be converted only alongside
  the denominator its catalogue entry names in `aggregation.weight`, because
  averaging an average is not the average;
- a `categorical` measure converts only as counts within its categories,
  never as a share;
- a `non-aggregatable` measure is never converted onto another frame. No
  weight recovers a `median`, a `rank`, a `decile` or a `life-expectancy`, and
  the catalogue already names which of them a measure is, so a refusal can say
  which one it is rather than only that it refused.

A crosswalk suitable for land area is not automatically suitable for people,
votes or rates, and this is the rule that says so. Support is therefore a
published fact per measure and frame, not a property of the crosswalk alone.

```text
available: GET /v1/analysis-geographies
available: GET /v1/measures/{measure-id}/conversion-support?analysisGeography={geography}/{release}
available: GET /v1/analysis:plan?measure={measure-id}&period={period}&analysisGeography={geography}/{release}&sourceGeography={geography}&sourceBoundaryYear={year}
```

The initial published pair is final annual 2024 and 2025 reported
road-collision counts on 2021 LSOAs, exactly regrouped through the verified
2021 LSOA → May 2023 local-authority containment lookup. Their common source
partition makes the year-on-year comparison explicit and reproducible.

### The preflight is the plan, returned instead of acted on

The [resolution contract](#resolution-contract) already has the object this
needs. The resolver answers a request with a plan or a refusal; a preflight is
that plan handed to the caller rather than to a route. It selects no data,
reads no observations and costs a lookup.

So a preflight is not a new subsystem. It is a route that resolves, and then
returns what it resolved: the source partition, the conversion that would be
applied and by which crosswalk, the aggregation rule the measure's semantics
allow, the coverage the result would have, roughly how large it would be, and
the refusal that would come back instead. When it refuses it carries the same
alternatives every resolver refusal carries, which is what "safer
alternatives" means here — they are computed, not curated.

It exists because the expensive mistakes happen before the first request. A
caller who builds a pipeline around a trend and discovers at the end that two
of its periods were never comparable has wasted the work. The preflight moves
that discovery to the start, and makes it free.

### A result says what each value is, per period

An analysis answer is not uniformly source-exact or uniformly derived. A trend
across a boundary change is usually observed on one side of it and derived on
the other, and a response that flattens that difference is the failure this
whole design exists to prevent. Every value therefore carries its **basis**:

- **observed** — published on the analysis geography itself, unconverted;
- **derived** — converted onto it by a named crosswalk, carrying that
  crosswalk, the method, the weight and the share of the source that reached
  the target;
- **not-comparable** — no defensible path exists for that period, stated as
  its own outcome rather than as a gap.

`not-comparable` is a value of the field, not an absence. A period dropped
from an array is indistinguishable from a period that was never requested,
and a caller charting the result would draw a line straight through it.

Two rules follow, and both are refusals rather than judgements the API makes:

- **A gap is never filled.** Not by a same-code assumption, not by an
  unlabelled best fit, not by the nearest release. Where coverage falls below
  what the measure's declared threshold allows, the answer is
  `partial_coverage` with the areas named.
- **Mixing bases is the caller's decision.** The API returns them
  distinguished; it does not decide that a trend of four observed points and
  one derived point is fit to publish. It gives them what they need to decide.

### The receipt

A result that cannot be re-derived is not defensible, so an analysis response
carries a compact receipt: the Atlas release, the source partitions by
artifact and content hash, the crosswalk and its own hash, the method and
weighting, and the coverage at every period. That is the same material
`sourceExactProvenance` already assembles for a source-exact response, plus
the conversion — which is the point of specifying it now rather than later.
The receipt is release-pinned, so the URL that produced it can be cited under
`/v1/atlas-releases/{release-id}/` and fetched again unchanged.

### What would have to be true before any of it is built

Phase 2 begins only after the correct-map tutorial succeeds with a design
partner, and this section does not change that. When it does begin, the order
is: publish the supported pairs, implement one conversion path end to end for
one measure and one frame, prove conservation, coverage, rounding and refusal
for that pair, and only then consider a second. The generalisation comes from
having done it twice, not from designing for it once.

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
- A future asynchronous worker may create joins, unions and bulk extracts
  beyond safe request limits, but it is deliberately outside the first
  read-only API phase.
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

| Field            | Example values                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `recordStatus`   | `observed`, `cleaned`, `derived`, `suppressed`, `missing`                             |
| `geographyMatch` | `source-exact`, `official-lookup`, `same-geometry-recode`, `best-fit`, `inferred`     |
| `coverage`       | fraction plus list of missing/suppressed areas                                        |
| `comparability`  | `within-release`, `cross-release-qualified`, `not-comparable`                         |
| `confidence`     | `high`, `medium`, `low`, with a linked explanation—not a fake statistical probability |

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

| Risk / weakness                     | Why it matters                                                                | Mitigation                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| False authority                     | A clean API response can make estimated or inferred results appear official   | Prominent quality/provenance fields, separate observed and derived endpoints, no silent fallback             |
| Geographic change is not reversible | Splits/mergers cannot always be converted exactly                             | Directional crosswalks, method choice, coverage/error disclosure, reject invalid requests                    |
| UK-wide comparability is uneven     | National statistics use different definitions, periods and small-area systems | Treat coverage and comparability as measure metadata; launch with a small honest UK-wide catalogue           |
| Editorial places are contestable    | “Devon”, “London”, and regions have multiple legitimate meanings              | Version named locations, state their kind and membership, support alternatives rather than hiding the choice |
| Maintenance burden                  | Boundary releases, source updates and repairs require ongoing stewardship     | Automate intake/validation, assign dataset owners, publish a deprecation policy, keep releases immutable     |
| Geometry cost                       | GeoJSON and runtime unions can be huge and slow                               | Tiles/CDN, named simplification tiers, asynchronous exports, precomputed common unions                       |
| Licence incompatibility             | Public-source data is not automatically freely redistributable in all forms   | Per-resource licence policy and legal review before exposure                                                 |
| API scope creep                     | "One-stop shop" can become an unmaintainable general GIS platform             | Start with registry/crosswalk/data delivery; decline arbitrary spatial analysis initially                    |
| Incomplete repairs                  | Some inferred ward mappings may be wrong or only partially covered            | Publish confidence and evidence, accept corrections, distinguish inferred mappings from official ones        |
| Breaking reproducibility            | `latest` can change an analysis underneath a user                             | Immutable release URLs, ETags, manifests, changelog and deprecation windows                                  |

The most important criticism: the Atlas must not sell “all UK public data in a
single consistent schema” before it can uphold that claim. Its honest advantage
is a growing, transparent catalogue with exceptionally good geography handling.
Depth and traceability are more credible than breadth.

## Recommended delivery plan

The API already has a substantial geography, provenance and source-exact data
foundation. Do not restart that work or add every capability in the commercial
backlog. Build the following phases in order, and do not begin the next phase
until its exit criterion is met with external users.

### Phase 0 — choose and instrument the beta

Select a primary early audience: technical analysts at planning, policy,
location-intelligence or public-affairs consultancies, alongside one GIS/data-
product builder. These are design partners, not a claim that every public-
sector or property workflow is already supported.

- [ ] Write one reference scenario for each golden path: a correct map, a
      defensible trend and a reliable warehouse sync.
- [ ] Name the one or two measures and one analysis geography used in the trend
      scenario. Population is the natural starting point; choose a second only
      when its source and conversion evidence is equally strong.
- [x] Reconcile the OpenAPI description, examples and capability checklist with
      the current implementation so `available`, `next` and `later` are factual
      product states. Each checkbox was checked against the routes, and the
      figures quoted in the items were rerun against the compiled catalogues;
      those that differ between boundary releases now name the release they
      were measured on. A few, such as the share of ward adjacencies that are
      corners, were not rerun. OpenAPI examples are held to their live
      responses by `tests/contract.test.ts`, and the P0 tickets below record
      how far each has got.
- [ ] Measure time-to-first-correct-map, time-to-defensible-trend and time-to-
      release-pinned-sync in the reference clients. These are the activation
      metrics, not raw request count or catalogue size.

**Exit criterion:** two design partners can describe a recurring workflow that
the Atlas would remove or materially reduce, and the team can name the exact
beta result that proves it.

### Phase 1 — correct-map beta

Make the existing boundary and measure foundation easy to use safely for a map.
This is the shortest route to a useful external integration and validates the
Atlas's core geography value without private state or universal conversion.

- [x] Publish release-pinned, topology-preserving boundary tiles/PMTiles and
      the associated attribution and licence metadata. One release is
      published, as a PMTiles archive with its TileJSON and a descriptor
      carrying the licence, and every one of them answers under a pinned,
      immutable URL as well.
- [x] Publish a small set of map-ready, source-exact value resources for the
      chosen measures, rather than trying to tile every measure at once. Every
      published measure joins to a map resource by code through its join
      table, so one tileset draws any of them and none is tiled separately.
- [x] Provide GeoParquet/Parquet and a compact map join contract for the same
      resources, so a customer may use its own renderer or warehouse. Every
      tier of a map resource, `full` included, is published as GeoParquet 1.1
      through `GET /v1/map-resources/{geography}/{release}/features?tier=`,
      compiled from the same shared-arc tiers as the tiles and carrying their
      ids, with a `bbox` covering column and each file's hash and size in the
      descriptor. A join table is served as Parquet with `format=parquet`, its
      envelope carried in the file's metadata. The files are written by
      `src/parquet.ts`, which has no dependency, and read back in tests by a
      reader written from the Parquet specification; pyarrow reads them too.
- [x] Supply one MapLibre/TypeScript reference implementation showing place
      resolution, explicit release choice, values, tiles and citation.
      `examples/correct-map-render.ts`, run as a golden path on every build.
- [x] Add cache validators and immutable resource URLs before adding API-key
      tiers; public correctness and inexpensive delivery come first. Every
      response carries a strong `ETag`, and anything asked for under
      `/v1/atlas-releases/{release-id}/` is served `immutable` and never needs
      revalidating. A request that arrived pinned keeps its links pinned, so a
      renderer configured from a pinned TileJSON fetches pinned tiles too.

**Exit criterion:** an external engineer can build a cited UK map from the
reference guide without downloading publisher files, guessing a release or
repairing a boundary join.

### Phase 2 — defensible-trend beta

Make one historical claim safe. The target is not universal geography
conversion; it is a small, transparent demonstration that the Atlas can retain
comparability when geography changes.

- [x] Define the analysis-geography and analysis-preflight contracts. The
      API publishes reviewed support and returns a plan for the selected
      measure, source partition, period and exact target frame; an unsupported
      period is `not-comparable` rather than silently omitted.
- [x] Implement and validate one source-to-analysis conversion path for the
      selected measure/geography pair, including coverage, conservation,
      rounding and refusal behaviour. `road-collisions` is regrouped from
      2021 LSOAs to the May 2023 local-authority release through an official,
      one-parent containment lookup. It is exact rather than rounded: the
      build verifies all 20,623 source records become 317 targets while the
      total remains 46,649; any other period or source/frame pair is refused
      or reported not-comparable.
- [x] Return source-exact, derived and not-comparable observations distinctly.
      `/v1/data/{measure-id}/series` remains source-exact unless its explicit
      `analysisGeography` is reviewed; a reviewed result carries
      `basis: derived`, while unsupported support returns a successful,
      explicit `not-comparable` result instead of omitted values.
- [x] Add a compact explanation receipt and release-pinned source evidence for
      this result. `GET /v1/analysis-geography-validation` returns the exact
      source artifact and crosswalk hashes, record counts and conserved totals
      for each reviewed period, all inside the Atlas release envelope.
- [x] Supply an analyst reference implementation that creates one trend and
      one comparison, including a deliberately refused example.
      `examples/defensible-trend.ts` preflights the 2024–2025 conversion,
      compares the derived local-authority values, retains their validation
      receipt and shows an unsupported period as `not-comparable`.

**Exit criterion:** an analyst can reproduce and defend a historical conclusion
on the chosen analysis geography, and can see why the API refuses an unsafe
alternative.

### Phase 3 — reliable-sync beta

Turn the useful resources into production data infrastructure. This is the
first plausible paid operational tier: service value comes from dependable
delivery, change management and support, never from withholding OGL data.

- [x] Serve archived resources through an immutable release-pinned download
      path, so a past result remains retrievable. Each build first snapshots
      the prior release's manifest-declared artifacts and verifies their hashes;
      a sync client retrieves one through `GET
/v1/atlas-releases/{release-id}/artifacts?artifact={artifact-id}`.
- [x] Publish a public correction register for API-owned repairs, derived
      calculations and normalisations. `GET /v1/corrections` records the exact
      scope, source-versus-served behaviour, evidence and review state without
      rewriting source artifacts; `?measure=` filters the register for a
      measure. The initial record documents opt-in canonical unit values.
- [ ] Publish freshness states and schema compatibility changes for the beta
      resources. Release comparison now has an opt-in `detail=fields` mode for
      changed resource metadata; freshness and compatibility policy remain to
      be published.
- [ ] Provide stable Parquet/GeoParquet downloads and one DuckDB or dbt
      synchronisation reference that ingests only affected resources.
- [ ] Add documented API-key quotas, cache/conditional request behaviour and
      support/freshness targets for high-volume or managed use.

**Exit criterion:** a data engineer can pin an Atlas release, refresh only
meaningful changes, and explain exactly why a downstream table changed.

### Phase 4 — choose one decision layer from evidence

Only after the three infrastructure paths have real users should the Atlas add
a human-facing decision layer. Choose one, based on observed demand:

- a structured area brief for consultancy evidence work; or
- a constrained reverse-area selection/peer-comparison workflow for location
  research; or
- a property/planning workflow after postcode, licensing and site-level data
  are sufficiently mature.

Use the existing profile, indicator, concept, topic and signal ideas only as
the backlog for this chosen layer. Do not build all of them as a generic
dashboard.

**Exit criterion:** a customer uses the selected decision layer repeatedly in a
real report, shortlist or internal workflow and can identify a paid outcome it
improves.

### Deferred until a phase creates demand

The following remain valuable ideas, but are explicitly out of the initial
commercial beta: API-backed projects and private uploads; custom polygons and
general spatial analysis; broad postcode/address/UPRN services; drive-time or
transport catchments; arbitrary query languages or server-side arithmetic;
opaque scores, forecasts or AI recommendations; a property/infrastructure
vertical; all-measure conversion; asynchronous managed exports; and wholesale
dataset expansion. OGC representations, extensive profile catalogues and
signals are also deferred unless a Phase 1–3 design partner needs them.

## Focus rules

1. **Correctness before breadth.** One source, conversion or map resource that
   travels with complete evidence is more valuable than ten weakly documented
   additions.
2. **Source-exact by default.** Conversion is opt-in, declared per measure and
   refused when its quality cannot be defended.
3. **Release-pinned by default.** A mutable `latest` is convenient discovery;
   a downstream analysis, tile, export or receipt must identify its immutable
   Atlas release.
4. **No private state in the first API phase.** Customer project manifests stay
   customer-owned; API keys represent operational entitlements, not a new data
   store.
5. **Build tutorials as product tests.** If the map, trend and sync examples
   require hidden knowledge, the underlying API is not ready to sell.
6. **A feature earns its place through a golden path.** Otherwise it stays in
   the backlog until user evidence changes the priority.

## Concrete next repository work

The first tickets deliberately repair contract clarity before expanding the
surface area. They follow Phase 0 and Phase 1 only.

### P0 — make the current API safe to discover and integrate

1. **Establish a contract source of truth.** Reconcile `api/openapi.yaml`,
   `api/src/routes.ts`, root discovery links and README examples against the
   routes actually implemented. Add a test that every root link resolves to an
   OpenAPI operation and that every public operation is reachable from
   discovery or its documented task group. Resolve the current public template
   drift too: OpenAPI used `{geography}` where root discovery advertised
   `{type}`; publish one canonical placeholder vocabulary.
   _Done._ `tests/openapi.test.ts` requires the OpenAPI paths to be exactly
   the index's links, placeholder names included, and `tests/contract.test.ts`
   serves every link and every README example against the compiled
   catalogues. Every path now names its placeholders `{geography}`,
   `{release}`, `{code}` and kebab-case ids.
2. **Remove documentation drift.** Keep the conceptual resource model clearly
   labelled as non-binding, and either generate the standalone endpoint list
   below from OpenAPI or replace it with an OpenAPI-derived task index. Do not
   maintain a second hand-written inventory of several dozen URLs.
   _Done._ The conceptual model is labelled non-binding, and the route index
   under [Initial standalone implementation](#initial-standalone-implementation)
   is generated from `openapi.yaml` by `pnpm docs:index`, with a test that
   fails when it goes stale. What remains by hand is a list of worked example
   requests, which the contract tests run; they are examples, not a second
   inventory.
3. **Make operations navigable.** Add the task tags, plain-language summaries,
   parameter descriptions, response examples and error references described in
   [API UX and contract clarity](#api-ux-and-contract-clarity). Link the root
   response to the authoritative OpenAPI description and a human documentation
   landing page.
   _Done._ Every operation carries a task tag, a summary and its most likely
   refusal, and every parameter is described, the repeated ones through shared
   components. Response examples are taken from live responses and held to
   them by test. The index links to that description, which the API serves,
   and to `GET /v1/docs`, a landing page rendered from it.
4. **Document the data identity model.** For `/data/{measure}` and every
   derivative route, make source geography, `boundaryYear`, optional
   code-compatible geometry `release`, observation `period` and immutable
   `atlasRelease` unambiguous in OpenAPI and examples. Add negative tests that
   prove a geometry selection cannot be mistaken for a value conversion.
   _Done._ The OpenAPI description states the four identities once, and the
   shared parameters carry them into every data route. `tests/contract.test.ts`
   proves a geometry release leaves every value as published, and that all six
   derivative routes refuse a release rather than ignoring it. `/convert`
   ignored `release` silently until this audit; it now refuses it.
5. **Make errors usable by clients.** Replace loosely documented Problem
   Details extensions with typed schemas, stable `code` values and examples for
   ambiguous place, absence state, incompatible geometry, unsupported
   conversion, partial coverage, invalid format and cursor failures. Test both
   JSON and tabular error representation policy.
   _Done._ `src/problemCodes.ts` declares eleven codes, including ambiguous
   place, incompatible geometry, invalid format and invalid cursor. Each has
   an OpenAPI schema whose example is checked against the live response, and
   a route cannot emit an undeclared code without failing the type check. An
   error is always `application/problem+json`, whatever `format` was asked
   for, which `tests/httpResponse.test.ts` holds for a failed CSV request.
6. **Make delivery semantics consistent.** Audit the implementation against
   the documented `format`/`Accept`, pagination, `Link`, content type,
   `Cache-Control`, provenance and content-hash rules. Implement or remove any
   claim that does not hold. Add representation and pagination contract tests.
   _Done._ Conditional requests, caching, `format`, pagination, `Link` and
   content types are documented once in the OpenAPI description and held by
   contract tests. `Accept` turned out to be described but never read, and is
   now documented as not negotiated. Provenance and content hashes are held at
   the representation too: `tests/provenance.test.ts` serves every published
   partition and requires each response to name an artifact that exists, quote
   that artifact's own hash, agree with its envelope about the release and
   with the request about the partition, offer no link that does not resolve,
   and claim a geometry join only where a release was asked for. The
   validation report proves the build is sound; this proves the response tells
   the truth about it.
7. **Clarify existing convenience resources.** In OpenAPI and docs, label
   `/locations` as curated area collections and `/data/{measure}/value` as a
   by-place convenience dispatcher. Add examples showing `/places` first when
   ambiguity matters; do not rename either v1 path.
   _Done._ OpenAPI calls `/locations` the curated area collections and
   `/data/{measure}/value` a by-place dispatcher, says it is not the primary
   way to fetch an observation, and points at `/places` first where a name is
   ambiguous.
8. **Turn tutorials into integration tests.** Write small, executable
   TypeScript or shell examples for the three golden paths using only the
   published OpenAPI contract. A broken example blocks release rather than
   becoming a support burden.
   _Done._ `examples/correct-map.ts`, `examples/defensible-trend.ts` and
   `examples/reliable-sync.ts` walk the three paths over HTTP using only the
   published contract, and `tests/examples.test.ts` runs them against a server
   it starts. Each asserts what it demonstrates: the trend example shows two
   refusals, and the sync example recomputes an export's hash and revalidates
   it for a 304.

### P1 — prove the correct-map product

9. **Specify the release-pinned map resource contract:** identity, value join,
   simplification/topology tier, attribution, caching, content hashes and the
   distinction between source and geometry release.
   _Done._ [Map resource contract](#map-resource-contract) settles all seven
   and resolves the drift between the two candidate tile shapes the
   non-binding sections sketched. Nothing in it is served yet; it is what
   items 10 to 12 build against. The two decisions that most affect those
   items: a tile carries `code`, `name` and a stable integer feature id only,
   with values joined in the renderer from a separate table, so one tileset
   serves every measure; and tiers are compiled from a shared-arc
   decomposition, so neighbours cannot diverge, which the existing per-area
   generalisation does not guarantee.
10. **Build a topology-preserving tile or PMTiles compiler** for one boundary
    release and test that neighbouring features share edges at every published
    map tier.
    _Geometry done; encoding still to do._ `src/mapResource/` splits a release
    into shared arcs and generalises each arc once, so both areas along a
    border get identical coordinates by construction rather than by tolerance.
    `localAuthority/2023-05-uk-bgc-v2` decomposes into 6,792 arcs over 417,116
    coordinates with no edge on three areas, and `tests/mapTopology.test.ts`
    holds all four tiers to the gate: the same 881 bordering pairs as the
    source, no pair gained or lost, no area dropped, and the full tier
    reproducing the source edge for edge. The coarsest tier keeps 27,749
    coordinates, a fifteenfold reduction. Generalising the same release one
    area at a time loses 218 of those borders, which the last test requires,
    so the gate is known to discriminate.

    Tiles are written too. `src/mapResource/vectorTile.ts` encodes a boundary
    layer as Mapbox Vector Tile 2.1 without a dependency, and is held to the
    worked example the specification publishes rather than to a reader written
    beside it. `tileGrid.ts` rounds coordinates to the tile's grid before
    cutting them to the tile, in that order, so both sides of a border round
    to the same integers and the cut then lands in the same place for each;
    Sutherland-Hodgman is used instead of a general clipper because its cut
    depends only on the segment. Zooms 0 to 12 draw from `low`, `medium` and
    `high` as the grid gets finer. From zoom 5 up, no edge in a tile lands on
    more than two areas. Zoom 0 puts the country on one tile at about 5.7km a
    unit, where 121 of 4,967 edges merge because the grid is coarser than the
    borders; `tests/mapTiles.test.ts` records that rather than leaving it to
    be found in a renderer.

    The release is now compiled and published. `pnpm build:map-resource`
    writes `public/map-resources/localAuthority-2023-05-uk-bgc-v2.pmtiles`,
    a 5.9MB PMTiles v3 archive of 12,206 tiles, and a descriptor in
    `public/map-resources.json` naming the publisher file behind the shapes,
    the archive's SHA-256, the zoom ladder and the attribution a renderer must
    display. The archive is read back in tests by a reader written from the
    PMTiles specification, and the tile ordering is checked by the property
    that defines a Hilbert curve rather than by a table of expected numbers.
    The build is reproducible: rebuilding gives the same bytes, and
    `tests/mapResourceArtifact.test.ts` fails if the committed archive stops
    matching its descriptor.

    The resource is served. `GET /v1/map-resources` lists what is published,
    the descriptor answers at `/v1/map-resources/{geography}/{release}`,
    `tiles.json` gives a renderer TileJSON 3.0 carrying the attribution, and
    `tiles/{z}/{x}/{y}.mvt` serves a gzipped vector tile; the whole archive
    downloads from `{release}.pmtiles`. A tile inside the published zooms that
    covers no area answers `204`, cached like any other answer rather than
    left unstored, and a zoom past the last says so and tells the renderer to
    over-zoom. All five are in the OpenAPI description and the index.

    Item 10 is done. The pinned
    `/v1/atlas-releases/{release-id}/map-resources/...` form the contract asks
    for is served too: it answers exactly what the unpinned path answers, with
    `Cache-Control: public, max-age=31536000, immutable`, and the links it
    returns stay pinned so a renderer configured from a pinned TileJSON never
    falls back to a revalidated tile. Only the current release can be
    answered, because the archive keeps release manifests rather than the data
    files behind them; a release that is recorded but no longer served is
    refused with `410`, naming the release now current, rather than quietly
    answered from it.

11. **Publish one source-exact measure** as a map-ready resource and as
    Parquet/GeoParquet, with schema, manifest and provenance tests.
    _Done._ Every measure that joins to the published map resource is served
    as a Parquet join table, and the resource's shapes as GeoParquet at every
    tier. `tests/mapResourceArtifact.test.ts` holds each GeoParquet file to
    the hash, size and row count its descriptor gives, to the GeoParquet
    metadata and bounding boxes, and to the ids and names in the tiles;
    `tests/mapResourceRoutes.test.ts` requires the Parquet join table to hold
    exactly the JSON values and to name its release and source. The map
    resource descriptor is now part of the Atlas release manifest, so a pinned
    map URL is covered by the release it names.
12. **Create the MapLibre/TypeScript correct-map tutorial** and make it a
    release gate for the first design partner.
    _Done, bar a design partner._ `examples/correct-map-render.ts` walks the
    whole path over HTTP using only the published contract: choose a published
    resource, read its descriptor, be refused a measure these boundaries
    cannot carry and told which releases would carry it, configure the
    renderer from TileJSON, join the values by code, and cite the result with
    the Atlas release and the archive hash. `pnpm example:map-render` writes a
    runnable MapLibre page, generated from the API's own answers so it cannot
    drift from them. `tests/examples.test.ts` runs it as a fourth golden path
    and checks what a test can check without a browser: the style draws the
    layer the values were numbered for, every tile URL it names is served, and
    the page carries the attribution, the release and the hash.

    Building it found a defect that would have stopped any browser map: the
    API sent no CORS headers at all, so a renderer on another origin could
    fetch a tile and then be refused permission to read it. Responses now
    carry `Access-Control-Allow-Origin`, expose `ETag` and `Link` so a client
    can revalidate and page, and answer the preflight that `If-None-Match`
    triggers. This is the tutorial earning its place as a release gate rather
    than as documentation.

13. **Specify, but do not yet generalise,** the analysis-preflight and
    analysis-geography response contracts required by Phase 2. No custom
    geometry or broad analysis endpoint is in this phase.
    _Done._ [Analysis contract](#analysis-contract) settles both and builds
    nothing. An analysis geography is a declared frame, supported per measure
    and only where the conversion method suits that measure's own semantics,
    so the four kinds the catalogue distinguishes each get a rule and a
    `non-aggregatable` median or rank is never converted at all. The preflight
    turns out not to be a new subsystem: it is the resolver's plan returned to
    the caller instead of to a route, which is why specifying it now was worth
    doing rather than later. A result carries a `basis` per period, where
    `not-comparable` is a value rather than a missing entry, because a period
    dropped from an array is indistinguishable from one never asked for.
    `tests/contract.test.ts` requires the section to rule on every aggregation
    kind in use and to keep its three routes unserved.

Phase 2 begins only after the correct-map tutorial succeeds with a design
partner. This order fixes the present usability debt, then proves a valuable
map workflow before committing to a general-purpose data or GIS platform.

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
`http://127.0.0.1:3001/v1`. Its routes are indexed below by task, generated
from `openapi.yaml` by `pnpm docs:index` and checked by test, so this is not a
second inventory to maintain:

<!-- route-index:start -->

**Start here**

- `GET /v1` — API discovery
- `GET /v1/openapi.yaml` — The OpenAPI description of this API
- `GET /v1/docs` — The human documentation landing page
- `GET /v1/places` — Find every place a name could mean
- `GET /v1/postcodes/{postcode}` — Find where a postcode is and the areas containing it
- `GET /v1/data/{measure-id}/value` — Answer a measure for a place by name (by-place dispatcher)
- `GET /v1/areas:resolve` — Resolve a code, name or alias to every exact area identity it can mean
- `GET /v1/areas/{geography}/{release}/{code}/dossier` — Get the verified geography dossier for one exact area identity
- `GET /v1/areas/{geography}/{release}/{code}/capabilities` — Report what the Atlas can serve for one exact area identity

**Map**

- `GET /v1/coordinates:convert` — Convert one supported coordinate between WGS 84 and national grids
- `GET /v1/data/{measure-id}` — Retrieve source-exact observations, or an opt-in canonical-unit representation
- `GET /v1/areas:intersects` — Find the areas meeting a bounding box in one release
- `GET /v1/areas:contains` — Find the areas containing a point in one or more geographies
- `GET /v1/areas:containsBatch` — Find the areas containing each of a bounded batch of points
- `GET /v1/areas:near` — Rank the areas nearest a point by distance
- `GET /v1/areas/{geography}/{release}/{code}/children/geometry` — Get every child of an area as one GeoJSON FeatureCollection
- `GET /v1/areas/{geography}/{release}/{code}/neighbours` — List the areas whose boundary meets this one's
- `GET /v1/areas/{geography}/{release}/{code}/overlap` — Measure how one area overlaps another
- `GET /v1/areas/{geography}/{release}/{code}/geometry` — Get one compiled area's raw geometry as a GeoJSON Feature
- `GET /v1/areas/{geography}/{release}/{code}/geometry/metadata` — Measure one area's geometry without transferring its coordinates

**Trend**

- `GET /v1/analysis-geographies` — List reviewed analysis geography conversions
- `GET /v1/analysis-geography-validation` — Get the validation receipt for reviewed conversions
- `GET /v1/analysis:plan` — Preflight a reviewed source-to-analysis conversion
- `GET /v1/measures/{measure-id}/conversion-support` — Inspect reviewed conversion support for one measure and frame
- `GET /v1/data/{measure-id}/aggregate` — Aggregate an extensive or explicitly weighted measure
- `GET /v1/data/{measure-id}/convert` — Regroup an extensive measure through a published crosswalk or relationship path
- `GET /v1/data/{measure-id}/series` — Retrieve a source-exact or reviewed derived time series
- `GET /v1/data/{measure-id}/rankings` — Rank areas within one source-exact measure partition
- `GET /v1/data/{measure-id}/change` — Rank areas by change between two periods of one measure partition
- `GET /v1/data/{measure-id}/compare` — Compare two areas within one source-exact measure partition

**Sync**

- `GET /v1/atlas-releases/{release-id}/map-resources/{geography}/{release}` — A map resource pinned to the Atlas release that produced it
- `GET /v1/exports` — List release-pinned whole observation artifacts
- `GET /v1/exports/{export-id}` — Download one immutable source observation artifact
- `GET /v1/lookups` — List whole lookup tables for download
- `GET /v1/lookups/{lookup-id}` — Download one whole lookup table as CSV or NDJSON
- `GET /v1/atlas-release` — Get the current immutable atlas release manifest
- `GET /v1/atlas-releases` — List the current and archived immutable Atlas releases
- `GET /v1/atlas-releases/{release-id}/artifacts` — Download one artifact from a current or archived Atlas release
- `GET /v1/atlas-releases/{release-id}` — Get one current or archived Atlas release manifest
- `GET /v1/atlas-releases/compare` — Compare two archived Atlas releases, artifact by artifact and resource by resource

**Geography**

- `GET /v1/map-resources` — List the boundary releases published as map resources
- `GET /v1/map-resources/{geography}/{release}` — Describe one map resource, its tiles and what they were made from
- `GET /v1/map-resources/{geography}/{release}/tiles.json` — The TileJSON a renderer is configured with
- `GET /v1/map-resources/{geography}/{release}/features` — Every area of one tier as a GeoParquet file
- `GET /v1/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt` — One vector tile of a boundary release
- `GET /v1/map-resources/{geography}/{release}/join/{measure-id}` — One measure's values, numbered to match this resource's tiles
- `GET /v1/map-resources/{geography}/{release}.pmtiles` — The whole tile pyramid as one PMTiles archive
- `GET /v1/geographies` — List geography types with their latest boundary release
- `GET /v1/boundary-releases` — List every compiled boundary release
- `GET /v1/boundary-releases:resolve` — Select the boundary release to use for a date
- `GET /v1/boundary-releases:compare` — Compare two releases of one geography without inferring geography change from codes
- `GET /v1/boundary-releases/{geography}/{release}` — Get one boundary release's metadata
- `GET /v1/geography-inventory` — Report resolver identity and relationship coverage, including the compiled backlog by geography
- `GET /v1/areas` — List or search compiled area identities
- `GET /v1/areas:validate` — Validate a batch of area codes or names against one release
- `GET /v1/areas/{geography}/{release}/{code}` — Get one compiled area by its full identity
- `GET /v1/areas/{geography}/{release}/{code}/relationships` — Get published relationships for one compiled area
- `GET /v1/areas/{geography}/{release}/{code}/history` — Explain a code's published historical relationships and same-code continuity
- `GET /v1/areas/{geography}/{release}/{code}/parents` — List published clean-containment parents for an area
- `GET /v1/areas/{geography}/{release}/{code}/children` — List published clean-containment children for an area
- `GET /v1/geography-health` — Summarise relationship health across compiled releases
- `GET /v1/relationship-paths` — Find the published paths from one boundary release to another for a purpose
- `GET /v1/relationship-capabilities` — Diagnose whether a geography conversion is usable and complete
- `GET /v1/conversion-plan` — Select a published conversion path and preflight its intended operation
- `GET /v1/relationship-coverage` — Report relationship coverage and hierarchy gaps for one release
- `GET /v1/crosswalks` — List published crosswalks
- `GET /v1/crosswalks/{crosswalk-id}` — Get one crosswalk's metadata
- `GET /v1/crosswalks/{crosswalk-id}/records` — List (optionally filtered) records for one crosswalk
- `GET /v1/translations` — Translate one code through a published conversion path in either direction
- `GET /v1/locations` — List the curated area collections
- `GET /v1/locations/{location-id}` — Get one curated area collection's definition
- `GET /v1/locations/{location-id}/capabilities` — Discover the direct and crosswalk views published for a named location
- `GET /v1/locations/{location-id}/members` — Resolve a named location's members in one geography and release
- `GET /v1/locations/{location-id}/parents` — Find the areas of a coarser geography a named location covers or meets

**Terrain**

- `GET /v1/terrain` — Discover terrain product families and their availability
- `GET /v1/terrain/{terrain-id}` — Get one terrain product definition
- `GET /v1/terrain/elevation/point` — Get one terrain elevation point

**Data catalogue**

- `GET /v1/datasets` — List published source datasets and their lineage
- `GET /v1/datasets/{dataset-id}` — Get one published source dataset and its input hashes
- `GET /v1/measures` — List measures currently available to query
- `GET /v1/measures/{measure-id}` — Get one measure's semantics and availability
- `GET /v1/measures/{measure-id}/compatibility` — Report source-code compatibility with compiled boundary releases
- `GET /v1/measures/{measure-id}/coverage` — Report source and boundary code coverage for a measure
- `GET /v1/measures/{measure-id}/reconciliation` — Check a measure against itself across two geographies
- `GET /v1/measures/{measure-id}/coverage-plan` — Say what a measure can answer on one release, country by country
- `GET /v1/measures/{measure-id}/quality` — Preflight source, status and boundary quality for a measure

**Governance**

- `GET /v1/areas/{geography}/{release}/{code}/citation` — Assemble a citation bundle for one exact area identity
- `GET /v1/relationship-candidates` — List discovered relationship candidates and their coverage gaps
- `GET /v1/relationship-repairs` — List the governed queue of relationship repairs
- `GET /v1/corrections` — List reviewed corrections and transformations applied by the API
- `GET /v1/validation` — Report every release gate, including waived exceptions
- `GET /v1/validation/boundary-releases/{geography}/{release}` — Get one boundary release's checks
- `GET /v1/validation/crosswalks/{crosswalk-id}` — Get one crosswalk's checks
- `GET /v1/validation/measures/{measure-id}` — Get one measure's definition check
- `GET /v1/validation/exports/{export-id}` — Get one measure source partition's checks
- `GET /v1/attribution` — Assemble the attribution and licence block for named resources

<!-- route-index:end -->

Three worked walkthroughs live in `examples/`, one for each golden path. Each
uses only the published contract, prints what a reader should notice, and
fails if what it demonstrates stops being true. `tests/examples.test.ts` runs
all three against a server it starts, so a broken tutorial blocks a release:

```sh
pnpm start &                      # or BASE_URL=https://api.ukdataatlas.com/v1
pnpm example:map                  # place → release → compatible values → geometry → attribution
pnpm example:trend                # series → ranked change → two refusals → caveat
pnpm example:sync                 # pin → download → verify hash → 304 → what changed
```

The requests below are worked examples, each of them run against the compiled
catalogues by the contract tests:

- `GET /v1`
- `GET /v1/openapi.yaml`
- `GET /v1/geographies`
- `GET /v1/geography-inventory`
- `GET /v1/datasets`
- `GET /v1/measures`
- `GET /v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023`
- `GET /v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc`
- `GET /v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc&include=area`
- `GET /v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=csv`
- `GET /v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=ndjson`
- `GET /v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023`
- `GET /v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000932&comparisonAreaCode=W05001039`
- `GET /v1/data/population-estimate/change?geography=localAuthority&boundaryYear=2023&startPeriod=2011&endPeriod=2022`
- `GET /v1/data/population-estimate/value?place=Cornwall&period=2022`
- `GET /v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2025`
- `GET /v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2025&release=2025-05-uk-bgc-v2&include=area`
- `GET /v1/measures/ghg-emissions/coverage`
- `GET /v1/data/mobile-5g-coverage?period=2025&geography=localAuthority&boundaryYear=2024`
- `GET /v1/measures/mobile-4g-coverage`
- `GET /v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025&areaCode=S92000003`
- `GET /v1/data/total-jobs/series?areaCode=E08000035&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/travel-to-work-bicycle?period=2021&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/travel-to-work-total?period=2021&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/car-availability-none?period=2021&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/qualification-level-4-plus?period=2021&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/broadband-gigabit-availability?period=2025-07&geography=localAuthority&boundaryYear=2024`
- `GET /v1/data/claimant-count/aggregate?period=2026-04&geography=localAuthority&boundaryYear=2024&areaCode=S92000003`
- `GET /v1/data/temporary-accommodation-children?period=2026-Q1&geography=localAuthority&boundaryYear=2025`
- `GET /v1/data/median-annual-pay/series?areaCode=E08000003&geography=localAuthority&boundaryYear=2025`
- `GET /v1/data/crime-total?period=year-ending-2026-03&geography=communitySafetyPartnership&boundaryYear=2023&release=2023-12-ew-bgc`
- `GET /v1/data/unemployment-rate/series?areaCode=E08000003&geography=localAuthority&boundaryYear=2019`
- `GET /v1/data/no2-background-mean/aggregate?period=2024&geography=localAuthority&boundaryYear=2024&areaCode=W92000004`
- `GET /v1/data/ethnicity-indian/aggregate?period=2021&geography=localAuthority&boundaryYear=2023&areaCode=W92000004`
- `GET /v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023&crosswalk=ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment`
- `GET /v1/data/population-estimate?period=2024&geography=localAuthority&boundaryYear=2023`
- `GET /v1/locations/north-yorkshire/members?release=2023-05-uk-bgc-v2`
- `GET /v1/locations/greater-manchester/parents?geography=region&release=2025-12-en-bgc&via=local-authority-2025-12-uk-bgc-to-region-2025-12-en-bgc-area-overlap`
- `GET /v1/relationship-paths?sourceGeography=ward&sourceRelease=2023-05-uk-bgc&targetGeography=localAuthority&targetRelease=2023-05-uk-bgc-v2&purpose=membership`
- `GET /v1/measures/population-estimate/coverage?geography=ward&release=2023-05-uk-bgc`
- `GET /v1/data/population-density?period=2024&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/house-price-median/series?areaCode=E05008945&geography=ward&boundaryYear=2020`
- `GET /v1/data/imd-decile?period=2019&geography=lsoa&boundaryYear=2011&release=2011-12-ew-bgc-v3&include=area`
- `GET /v1/data/life-expectancy-female/rankings?period=2020-2022&geography=localAuthority&boundaryYear=2021`
- `GET /v1/data/life-expectancy-male/series?areaCode=E06000001&geography=localAuthority&boundaryYear=2021`
- `GET /v1/data/population-estimate?period=2022&geography=constituency&boundaryYear=2024&release=2024-07-uk-bgc&include=area`
- `GET /v1/data/population-density/series?areaCode=E09000012&geography=localAuthority&boundaryYear=2023`
- `GET /v1/attribution?measure=ghg-emissions&boundaryRelease=localAuthority/2025-05-uk-bgc-v2`
- `GET /v1/places?q=Newport`
- `GET /v1/postcodes/SW1A1AA`
- `GET /v1/locations?q=york`
- `GET /v1/locations/london`
- `GET /v1/boundary-releases`
- `GET /v1/areas`
- `GET /v1/areas:contains?lng=-1.5491&lat=53.8008&geography=localAuthority&release=2024-05-uk-bgc`
- `GET /v1/areas:contains?lng=-3.1791&lat=51.4816&geography=ward&geography=localHealthBoard&date=2025-06-01`
- `GET /v1/areas:containsBatch?point=-1.5491,53.8008&point=1.0,54.5&geography=localAuthority&date=2025-06-01`
- `GET /v1/areas:near?lng=-0.5800&lat=54.5100&geography=ward&date=2025-06-01&limit=2&within=5000`
- `GET /v1/areas:intersects?bbox=-1.6,53.7,-1.4,53.9&geography=ward&release=2024-12-uk-bgc`
- `GET /v1/areas/ward/2024-12-uk-bgc/E05000932/history`
- `GET /v1/areas/ward/2024-12-uk-bgc/E05000932/parents`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/children`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/children/geometry`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/neighbours`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/geometry/metadata`
- `GET /v1/crosswalks`
- `GET /v1/translations?sourceGeography=ward&sourceRelease=2024-12-uk-bgc&code=E05000932&targetGeography=localAuthority&targetRelease=2024-12-uk-bgc&purpose=membership`
- `GET /v1/relationship-candidates`
- `GET /v1/validation`
- `GET /v1/exports`
- `GET /v1/lookups`
- `GET /v1/atlas-release`
- `GET /v1/atlas-releases`

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

A declared Shapefile source is read directly, identities from its companion
dBase (`.dbf`) attributes and geometry from the `.shp`, so no generated
topology stands in for either. Its CRS comes from the `.prj`; a projection
the API has no declared transformation for is recorded by name and refused.
The reader handles polygon shapes only, reverses rings into GeoJSON winding
order and places each hole in the ring that contains it. Scottish data zones
read this way match the publisher's own `Shape_Area` to within five parts
per billion.

The first crosswalk build is a published, many-to-many constituency lookup
from the constituencies in force from 2010 to 2024 to the July 2024 release.
The publisher labels its source side 2010; the compiler verifies it against
the December 2019 release, which holds the same 650 codes, and keeps the
lookup's own names as record labels. Its records are
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
adapter rather than assuming every crosswalk shares one method.

The third method, `area-overlap`, is computed rather than read. Its first
crosswalk intersects the July 2024 constituency boundaries with the May 2024
local authority boundaries, both read from the geometry source registry, and
is marked `derived` rather than `publisher-supplied`. Areas are ellipsoidal
square metres, measured in EPSG:6933, a Lambert cylindrical equal-area
projection of WGS 84. Each record gives the constituency's area and
`coverage`, and for each authority a `weight`, the overlap area, and the
overlap's share of each side. Weights are shares of the covered area and sum
to 1, so they apportion a whole constituency quantity. They describe land
area, not people: a constituency's residents are rarely spread evenly across
its area.

Both inputs are generalised to 20 m independently, so wherever the true
boundaries coincide they leave slivers a few metres wide. The compiler drops
a pair whose widest intersecting piece is narrower than the adapter's
`sliverWidthM` (twice area over perimeter), and publishes how many pairs it
dropped. On the 2024 inputs the widest sliver is 15 m and the narrowest real
overlap 332 m. The build fails if any pair falls between half and twice the
threshold, or if any constituency or authority is less than
`minimumCoverage` covered by kept overlaps, rather than publishing a split
that a slightly different rule would change. Its remaining limit is the
generalisation itself: a genuine overlap narrower than the threshold would be
dropped with the slivers, and generalised files cannot tell the two apart.

The fourth method, `same-code-continuity`, is also computed. GSS codes are
meant to change when a boundary does, but a code can survive a realignment
and a recycled code need not mean the same place, so a code two releases
share is treated as evidence rather than as identity. Each shared code's two
geometries are compared by their symmetric difference, judged by its widest
piece: the same twice-area-over-perimeter width, and the same 100 m
`sliverWidthM`, as the area-overlap slivers. Independently generalised
boundaries disagree in strips a few metres wide, while a moved boundary
leaves a piece hundreds of metres wide, whatever the area's size. A share of
area cannot tell the two apart, because the same strip is a larger share of a
small area: in a sample of 5,000 LSOAs shared by 2001 and 2011, the typical
difference is 3 to 4% of the area, yet no piece of it is wider than 30 m.

A pair is published when its widest difference is under half the sliver
width. Within a factor of two of it the pair is `indeterminate`, and beyond
that its extent `changed`; both are listed in
`validation.continuity.changedExtent` with the width and each side's share,
as repair evidence for a later area overlap or official lookup, and never
treated as identity. A code the clipper cannot measure, even retried at a
millimetre's precision, is listed as `unmeasured`. The clip runs in a worker
under a 30-second deadline, because polygon-clipping can loop forever on
near-coincident edges; one Northern Ireland constituency does. Only codes
both releases identify are compared: the Welsh 2011 LSOA geometry file also
holds English features. The crosswalks are `derived`, declare
`relationshipPurpose: identity`, and relate their records as successor and
predecessor.

They chain each geography's releases in date order. Each date links to the
next through its widest-coverage release, and same-month variants, such as
the Great Britain and United Kingdom ward files of December 2019, link to
that release. A pair already joined by a publisher identity lookup is left to
that lookup, and a pair sharing fewer than half its codes is skipped, which
leaves the 2024 constituency redistribution and the 2011 move to GSS local
authority codes to methods that can describe them. So is a release whose
geometry file holds no shapes, such as the names-and-codes 2011 data zone
file. `pnpm tsx scripts/propose-same-code-continuity.ts --write` regenerates
the adapters when a release is added.

Chaining the releases makes an area's history long, and every crosswalk
publishes its link from both ends, as a successor edge on one area and a
predecessor edge on the other. A walk that counts both reports one link
twice: before this was corrected, 337,722 of the 342,680 areas with any
history claimed more edges than there were areas to reach, and the 2019
Hampstead and Kilburn constituency reported 352 edges over 180 areas. The
resolver now walks the graph once, in one shared traversal used by area
history, ancestors and descendants: each area is reached once at its shortest
depth, and each published link is reported once, keyed by its crosswalk and
its pair of ends, whichever end the walk arrives from. Each entry names the
area the walk stood on as `from`, so a chain several hops long can be read
back in order rather than inferred from depth alone. The 4,218 areas that
still report more edges than areas reached are genuine: a merge or a split
gives two ways to arrive at the same area, and both are evidence worth
keeping.

Release health reports two things, because they answer different questions
and can disagree. `status` counts how many of a release's areas carry a
published relationship. `reach` asks whether anything can be converted onto
or off the release at all, and a path between two vintages of one geography
does not count: it keeps a code's history joined up without reaching
anything new. Of the 94 compiled releases, 72 are `connected`, 13 reach only
their own vintages, and 9 are `isolated`. The nine are already visible as
`unsupported`, but five releases are `available` on every area and still
convert onto no other geography: the 2019, 2020 and 2021 constituencies, and
the 2011 LSOAs for England and Wales and for Wales. The same-code work
chained each of those to its neighbouring vintages, which is what made them
look healthy.

Their bridges out exist and are not being used. An official lookup relates
the 2019 constituencies to the 2024 ones, the 2024 constituencies apportion
onto May 2024 authorities, an official lookup relates the 2011 LSOAs to the
2021 LSOAs, and those sit cleanly inside May 2023 authorities. Both lookups
are many-to-many, so `crosswalkShape` reports neither direction as
one-to-one, and the composition rules stop an identity step there rather
than carry it onward. That is the rule working as written, since a
redistribution is not an identity, but it leaves 37,962 areas' worth of
release converting onto nothing. Treating a many-to-many identity lookup as
an apportionment step would open these routes, and is a composition change
to review rather than infer.

The fifth method, `population-overlap`, reweights an area overlap by where
people live. An area weight assumes a source's residents are spread evenly
over its land, and they rarely are: Luton is 21% of the land of Luton South
and South Bedfordshire but holds 88% of its residents, so area weighting
would put most of Luton's people in rural Bedfordshire. The building blocks
are 2021 LSOAs with their Census 2021 usual residents (table TS001, under
`data/demographics/population/census-2021-lsoa`). Each block's residents are
split among the source and target pairs it falls in, in proportion to its
area in each, so the assumption of evenness shrinks from a whole constituency
to about 1,500 people.

It keeps the pairs of the area overlap it names in `pairs`, so the two
methods agree on which overlaps are real, and it counts rather than
reassigns the people a block puts in a source but in none of its kept
targets. The weighting states what was counted, its date and the blocks, so
every weighted answer carries its denominator. On the constituency to May 2024
local authority pairs, restricted to England and Wales because the blocks
cover nothing else, all 59,597,601 residents are accounted for: 6,032 fall in
border slivers and 12,393 outside every constituency, where the two files
draw the coast differently, and no constituency keeps less than 99.9% of its
people. Its records carry each pair's population, and `sourceShare` and
`targetShare` are shares of people, not land. Converting through it reports
`method: population-weighted`.

The gain is measurable against data the Atlas already holds. Converting the
2022 constituency population estimates to May 2024 local authorities, and
comparing each authority with its own published estimate, the area weights
are a median 8.8% out and the worst 99.5%, with 62 of 318 authorities within
2%. The population weights are a median 0.3% out and 312 of 318 within 2%.
That is a check on the weighting, not a published conversion: an authority
that also draws people from a constituency outside England and Wales is not
comparable this way. Scottish data zones and Northern Irish super
output areas, with their own counts, would extend it to the rest of the UK.

The sixth method, `geometric-containment`, publishes a hierarchy no lookup
carries. Each child of one release is measured against the parents of
another, and belongs to the parent holding most of it; the claim is then
tested by what it leaves outside, by the same widest-piece rule the
area-overlap crosswalks use for slivers. A child reaching less than half the
sliver width beyond its parent is within it, which is border noise; one
reaching further straddles, and the build refuses the whole pair rather than
publish a membership that is not one. A share of area could not make that
call, because the same strip of disagreement is a larger share of a data zone
than of a county.

`pnpm tsx scripts/propose-geometric-containment.ts` searches for these
hierarchies. It asks only pairs that could nest, where one release has more
areas than the other, its countries are inside theirs, their vintages are
within three years, nothing already relates them, and one of the two is a
release nothing relates at all. Of several releases of one parent geography
it asks the nearest in vintage, and it gives up on a pair after a handful of
children fail, because a pair that is not a hierarchy shows it immediately.
The geometry decides; the search only chooses what to ask.

Holding the same measure on two geographies is worth more than either alone:
adding the finer one up through a published crosswalk should reproduce the
coarser one, and where it does not, one of the three is wrong. The 2022 wards
added into May 2023 local authorities agree with the published local
authority figures for 299 of 318, a median 0.10% apart. The same check is how
a weighting is judged: the 2024 constituencies added into May 2024 local
authorities are a median 0.28% from the published figures by population
weight against 8.8% by area weight, and 245 of 318 agree within half a
percent against 44.

An area whose finer parts are not all published is reported `incomplete` with
the number missing, because a sum short of its parts is a gap rather than a
disagreement, and it is left out of the typical difference. Where the
compatibility inventory has assessed each partition against the release its
end of the crosswalk uses, the comparison is `verified`; otherwise it rests
on the codes the crosswalk carries and says so, because a partition of
another vintage may still be the same areas. Nothing is corrected: the two
figures are published side by side for a caller to judge.

A measure's coverage of a release is answered a country at a time, because
one word for a United Kingdom release hides the shape of the gap. On the May
2023 wards, population is `source-exact` for Wales, 762 of 762, `partial` for
England, 6,846 of 6,862, and `missing` for Scotland, 0 of 355, and Northern
Ireland, 0 of 462; the two missing countries are reported with the fact that
the measure covers them on 2023 local authorities and only lacks a crosswalk
onto wards. The counts come from the codes a partition's observations carry,
or the codes a dry-run conversion reaches, so a partition that names a
country it holds no area of is not credited with it, and an area whose code
names no country is counted apart rather than dropped. A ranking of UK wards
would leave two countries out; this is how a caller learns that first.

`public/relationship-paths.json` publishes every crosswalk as a one-step
path in each direction, the reviewed compositions declared in
`config/relationship-paths.json`, and the compositions the build's path search
finds between every pair of releases that neither covers. The search takes
the cheapest composition for each purpose, a step costing one and a derived
step half as much again, under rules that keep what each purpose claims:

- An identity path may take only identity steps that are one-to-one in the
  direction travelled, which the build reads from each crosswalk's records.
- An identity step that merges but never splits, such as the December 2022 to
  May 2023 local authority reorganisation, puts each old area wholly inside a
  new one, so it counts as a step up. Local authorities of 2011 therefore
  reach those of 2026 as membership, not identity.
- A membership path goes all the way up or all the way down; it never mixes.
- An apportion path takes exactly one weighted step, and after it only steps
  up, which keep each weighted share whole.
- No composition crosses a lookup that both splits and merges, such as 2011 to
  2021 LSOAs or the 2010 to 2024 constituencies.
- An apportion path is kept once for each weighting basis, as
  `…/apportion/by-area` and `…/apportion/by-population`. Population weighting
  is the better estimate of anything that follows people, but its blocks cover
  only England and Wales, so neither replaces the other; each states its own
  coverage.

Discovered paths are marked `origin: discovered`, and their trust is never
more than `derived`, because no one reviewed the composition. Their coverage
is end to end: the share of source areas that reach the target through every
step, which a chain of same-code steps loses a few areas to at each change of
vintage. On the current crosswalks the search closes at 2,179 discovered paths,
the longest 21 steps, so its 24-step limit is a guard rather than a cut.

Before publication, the crosswalk compiler validates every referenced code
against the compiled area artifact for that endpoint and fails on a missing
code. When the repository does not hold an endpoint's historical release, it
records that endpoint as `not-available` instead of implying verification,
and the validation report lists it as an exception until one is found.

`public/relationship-candidates.json` is the discovery half of the
"relationship coverage" goal: it scans every compiled area release's raw
source for extra code/name property pairs beyond the one already used for
its own identity, checks whether a matching compiled target release exists,
and reports coverage stats (referenced-but-missing target codes, source
codes with more than one target, missing values). Each candidate is
`eligible`, `needs-review`, or `not-available`, and carries the covering
crosswalk's id in `publishedCrosswalkId` when one already exists. `GET
/v1/relationship-candidates` exposes this directly; it is a gap report for a
human to act on, not an instruction to auto-publish every `eligible`
candidate without review.

`public/validation-report.json` applies the release gates above to what the
build has produced. It checks the links between the Atlas's own artifacts,
each boundary release (licence, compiled identities, servable geometry, and
relationship candidates awaiting a decision) and each crosswalk (artifact
integrity, resolvable endpoints, consistent source names, at least one
target per source, and the checks its method needs: one parent for clean
containment; weights summing to 1, required coverage and sliver separation
for area overlap). Where it can, it recomputes rather than restating a
compiler's claim: artifact hashes, code resolution against compiled areas,
weight sums, and coverage from the published shares.

It also checks each measure and each of its source partitions, which are
identified by the export that serves them. A measure's definition must agree
with itself and the catalogue: availability matching aggregation, known
datasets, an export for every source, and a summable weight on the same
geography and periods for any weighted mean. Each partition is read from its
observation artifact, not from the catalogue's summary of it: the artifact
must reproduce its hash and match the export manifest and the catalogue's
periods and latest-period record count, with no area code repeated in a
period; one compiled boundary release of the declared geography and year must
hold every code, in every period, which also stops a partition holding both a
merged authority and its predecessors; the codes must cover exactly the
declared nations; and every value must suit its measure (whole, non-negative
counts, percentages from 0 to 100, ranks no higher than the areas ranked,
deciles from 1 to 10, categories only on categorical measures, `derived`
records on derived measures, and published intervals that contain their
value). `config/measure-totals.json` declares measures that are the sum of
others in the same partitions, and each such partition must match its
components exactly in every area and period.

A check either passes or is waived. Every exception must be listed in
`config/validation-waivers.json` with its reason, and the build fails on one
that is not, or on a waiver that no longer matches an exception, so the file
stays an accurate list of known gaps. The report publishes each waived
check's finding beside its reason. `GET /v1/validation` serves the report,
with `?status=waived` for just the exceptions, and each boundary release,
crosswalk, measure and export's checks are also served at `/v1/validation`
followed by the resource's own path. Conversion checks, such as preserved
totals across a crosswalk, belong here once conversion is offered.

`GET /v1/exports` lists every source partition as a whole, immutable JSON
download. `GET /v1/exports/{export-id}` returns that exact observation
artifact, not a reconstructed paginated query. Its manifest entry records the
artifact's hash and byte size, and describes the artifact as read from it at
build time rather than restating the catalogue: the number of records in all
and in each period, the layout, whether records are numeric or categorical,
and each record field with its type and whether every record carries it. The
build fails on a record field the manifest has no description for, so every
field a download can contain is documented in the manifest's `fields`.
Provenance names the measure and each dataset to attribute, the source
dataset and any a derived measure was computed from, described once in the
manifest's `datasets` with publisher, licence and the hash of every input
file. The validation gate recounts each artifact's records against its entry.

An export's `schema.version` is the artifact's own `schemaVersion`. Adding an
optional field to records, or a new field to a manifest entry, does not change
it; removing or renaming a field, changing its type or meaning, or changing
the layout increments it, and the old version stays readable from the Atlas
release that published it. CSV, NDJSON and Parquet downloads of observations
are still future work.

`GET /v1/lookups` lists the whole reference tables a user would otherwise
rebuild call by call: every boundary release's area identities with their
aliases, every crosswalk flattened to one row per source and target, and the
membership of every named location. `GET /v1/lookups/{lookup-id}` returns one
as CSV, the default, or NDJSON with `?format=ndjson`. A list column, such as
an area's aliases, is joined with " | " in CSV and is an array in NDJSON; a
CSV cell is quoted only when it holds a comma, quote or line break, and a
column a row has no value for is empty in CSV and null in NDJSON. Each row
carries its geography and release, or its crosswalk and both sides, so a
downloaded file can be read without the manifest.

The files are not stored twice. `public/lookup-manifest.json` records, for
each lookup, the published artifact it is read from and that artifact's hash,
its columns, its row count, and the byte size and SHA-256 of each rendered
format; the build fails if a column marked required is empty in any row. The
server renders a download from the artifact it has loaded and serves it only
if the bytes match the manifest's hash, so every download of a lookup in a
given Atlas release is byte-identical. The Atlas release pins the lookup
manifest by hash, so a change in how any lookup renders makes a new release.
All 88 lookups, 114 MB across both
formats, pass that check.

The build's final step writes `public/atlas-release.json`, an immutable
manifest that references every other build-time artifact (the boundary
registry, derived boundaries, area inventory, geometry source registry,
crosswalk inventory, relationship candidate inventory, geography inventory,
validation report and source inventory) by its content hash, plus a single
`releaseId` hash of that set. Rebuilding without changing any input produces the same
`releaseId`; changing any one artifact changes it. This is a first, minimal
step toward the release and provenance model described above, not the full
versioned release history it will eventually anchor.

A build begins by archiving the current release under
`public/atlas-releases/` before any compiler replaces it. Alongside its
manifest, the archive retains every artifact that manifest declares in a
release-ID directory and verifies each file's SHA-256 before copying it. This
directory belongs on durable deployment storage (or an equivalent object
store) and is deliberately not duplicated in source control. Read the release
manifest, then retrieve an exact retained artifact through `GET
/v1/atlas-releases/{release-id}/artifacts?artifact={artifact-id}`; the response
is immutable and refuses a missing or hash-mismatched snapshot rather than
falling back to current bytes. `GET /v1/atlas-releases/compare`
provides a machine-readable change log between any archived release and the
current release. It reports artifacts added, removed and changed by hash, and, inside
them, which resources changed. Each release manifest records `resources`: for
each kind (datasets, measures, boundary releases, area identities, geometry
sources, crosswalks, validation exceptions, named locations, exports and
lookups), a fingerprint per resource id, taken from that resource's published
entry, or from the artifact hash where an inventory already records one. A
validation exception is a waived check, identified by resource and check, and
its fingerprint covers both the finding and the reason. The fingerprints are
read from artifacts the release already hashes, so they do not enter the
`releaseId`, and a comparison names a changed resource, not the field within
it that changed. It does not infer dataset rows or boundary geometry changes.

A kind one release does not record, such as lookups in a release made before
the lookup manifest existed, is reported as `not-recorded` rather than as
empty.

`public/geometry-sources.json` records, per compiled area release, where its
raw GeoJSON lives, its CRS, and its code property, or an explicit
`not-available` reason when no raw source is declared. `GET
/v1/areas/{geography}/{release}/{code}/geometry` serves that geometry directly as
a GeoJSON Feature, reading and caching the source file on first request
rather than precompiling per-area geometry artifacts. A source code that maps
to more than one feature fragment (an area split across islands, for
example) is returned as a single `GeometryCollection` instead of an
arbitrarily chosen fragment. Geometry is always served in WGS84. Sources in
British National Grid (EPSG:27700), 26 of the current releases, are
reprojected one requested area at a time through EPSG:1314, OSGB36 to WGS 84
(6): the seven-parameter Helmert transformation the website build already
uses, which EPSG states as accurate to 2 m within Great Britain. Checked
against the ONS's own WGS84 release of the same boundaries, reprojected Great
Britain authorities land a median 1 to 2 m away, and no authority's median
exceeds 5 m, well inside these files' 20 m generalisation. Northern
Ireland's 2011 super output areas are published on the Irish Grid (EPSG:29902)
and reprojected through EPSG:1641, TM65 to WGS 84 (2), which EPSG states as
accurate to 1 m; the API's output matches PROJ's to nine decimal places of a
degree, and every area lands within 7 m of the website's independently
produced map.

Northern Ireland is the exception. In the ONS's UK-wide British National Grid
files it sits a linear transform away from its true grid position, about 66 m
east at Belfast, and no published transformation reproduces the shift. The 15
releases measured to carry it declare `northern-ireland-offset` in their
`meta.json`. The website's boundary compiler and this API both move those
releases' Northern Ireland areas by the correction fitted in
`data/boundaries/northern-ireland-offset.json` before reprojecting, which puts
them within a metre of NISRA's native boundaries; the geometry registry
records each release's declared corrections, and a corrected area's
`properties.geometrySource.corrections` names the correction applied.
Constituencies December 2016 are British National Grid but already accurate,
and are served uncorrected. Three WGS84 releases, constituencies December 2017
and 2019 and travel to work areas 2011, are off in Northern Ireland by a
different shift that is not corrected yet. Each response's
`properties.geometrySource` names the source CRS and any transformation. A source in any other CRS is refused
rather than served unprojected. This is a raw per-area lookup, not the tiled or
simplified delivery the full proposal describes for map rendering at scale.
