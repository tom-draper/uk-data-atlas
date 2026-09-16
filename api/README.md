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
      back once. Of some 85,000 places, "Manchester" is six geographies and a
      curated location, and "Newport" thirteen codes.
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
- [ ] Expand parent/child coverage beyond currently published clean-containment
      relationships, for example constituency → wards where an authoritative or
      carefully qualified mapping exists.
- [x] Add purpose-aware reverse translation rather than requiring a caller to
      reverse a directional crosswalk themselves. Results state `forward` or
      `reverse`, preserve the original crosswalk provenance, and normalise
      reverse area-overlap weights against the queried target.
- [ ] Publish a directional relationship graph: within, contains, overlaps,
      predecessor, successor, split-from, merged-from and equivalent-to, each with
      method, quality and provenance.
- [ ] Add official ward and LAD historical change lookups. Do not promote
      name-based matching or same-code continuity to a public equivalence claim.
- [ ] Find and explain a multi-step relationship path, for example 2019 ward →
      current LAD → constituency. Return every step's method, release and
      quality rather than collapsing it to an undocumented answer.
- [ ] Complete the standard small-area hierarchies with explicit national
      coverage: OA → LSOA → MSOA → LAD where applicable, Scottish data zone
      and Northern Irish super output area equivalents.
- [x] Report an area's capability/availability matrix: supported geometry,
      parent/child relations, crosswalks, named-location membership, datasets
      and measures for its exact release. The API reports explicit unavailable
      and not-published states, and never upgrades code-set compatibility into
      a geometry-equivalence claim.
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
      them by source authority and exactness; support small, declared multi-step
      crosswalk composition without hiding intermediate mappings.
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
      authority it was found through.
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
- [ ] Find nearby areas for a coordinate outside a boundary, reporting distance
      and making clear that nearest is not the same as containing.
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
- [ ] Deliver vector tiles and cached exports for map-scale workloads.
- [x] Publish bulk, versioned CSV and NDJSON downloads for area identities,
      aliases, hierarchy relations, named-location membership and crosswalks
      through `GET /v1/lookups`, so no one needs thousands of API calls to
      reproduce a lookup. Hierarchy is the clean-containment crosswalks, one
      row per child and parent. Parquet is not offered yet.
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
      partition through `GET /v1/data/{measure-id}/series`. The route neither
      converts nor aggregates values, and reports the observation artifact and
      all periods in its provenance.
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
- [x] Return provisional reported road collisions for January to June 2025
      through `GET /v1/data/road-collisions` and its fatal, serious and slight
      subsets, for 349 of Great Britain's 350 local authorities on 2024 codes,
      and in a second partition for the 20,623 December 2021 LSOAs in England
      and Wales that have a collision; Scotland has no LSOAs.
      Each collision is counted in the authority and LSOA the Department for
      Transport assigns it to in the published record, not by placing its
      coordinates in a boundary, so the counts are exact tallies of the source
      rows and the three severities add up to the total in every area. An
      LSOA with no collision records has no value rather than zero. The period
      is `2025-H1`, a provisional half year. Collisions assigned to Heathrow
      Airport are counted in no authority, and North Somerset has no records
      in the file, so it has no value rather than zero. Serious and slight
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
- [x] Aggregate an extensive or explicitly weighted local-authority measure
      over an English region through `GET /v1/data/{measure-id}/aggregate`.
      Callers must name the 2025 local-authority-to-region crosswalk and a
      code-set-compatible source release. The derived crosswalk records only
      complete one-to-one area membership; no split or partial overlap is used
      as an implicit geographic conversion.
- [x] Convert an extensive measure across releases through
      `GET /v1/data/{measure-id}/convert`, using only the crosswalk the caller
      names. The response repeats that crosswalk's method, quality, weighting
      and content hash, and reports whether the result was an exact regrouping
      (every source wholly inside one target, partition total unchanged) or an
      area-weighted estimate. An intensive measure is refused, as is a source
      code the crosswalk does not carry or a split source with no published
      weight. Population-weighted conversion is not yet offered.

### Postcodes, homes and addresses — data required, later

- [ ] Postcode → ward, local authority, constituency and country lookup, with
      an explicit postcode release and containment method.
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
      change log between any two releases; there are no release notifications
      and no deprecation policy yet.
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
- [ ] Operational API keys, fair rate limits and managed services only when
      they add service value rather than restricting openly licensed data.
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

| Path | Primary user | Promise |
| --- | --- | --- |
| Correct map | GIS/product engineer | Render release-pinned UK boundaries and values without a code/geometry mismatch, with attribution. |
| Defensible trend | Analyst or consultant | Compare a small set of measures through time on an explicit analysis geography, with conversions and caveats visible. |
| Reliable sync | Data engineer | Ingest release-pinned data into an existing stack and reprocess only meaningful changes. |

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

| Term | Meaning |
| --- | --- |
| **Area** | One official, versioned identity: `{geography}/{release}/{code}`. |
| **Place** | An ambiguous name-resolution result from `/places`; it is never silently chosen. |
| **Curated area collection** | An editorial grouping served by `/locations`, not a generic geographic `location`. |
| **Source geography** | The geography and code vintage on the publisher's observation. |
| **Geometry release** | The caller-selected boundary release used only to join compatible geometry for a map. |
| **Observation period** | The time period the measure describes. |
| **Atlas release** | The immutable published Atlas artifact set that produced the response. |

The route selector in the documentation should begin with the user’s job:

| I need to… | Start here |
| --- | --- |
| resolve a name or inspect possible meanings | `/places` |
| inspect one exact official identity | `/areas/{geography}/{release}/{code}` |
| get its geometry, relationships or citation | the corresponding area subresource |
| render values or download source-exact observations | `/data/{measure}` |
| see a trend, ranking, comparison or change | `/series`, `/rankings`, `/compare` or `/change` under that measure |
| translate an identifier through a published crosswalk | `/translations` |
| convert values under a declared measure/method rule | `/data/{measure}/convert` |
| validate a supplied code/name or discover releases | `/areas:validate`, `/geographies`, `/boundary-releases` |
| cite, attribute or inspect the published release | area citation, `/attribution`, `/atlas-releases` and `/validation` |

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
- [ ] Group every OpenAPI operation under task-oriented tags: **Start here**,
      **Map**, **Trend**, **Sync**, **Geography**, **Data catalogue** and
      **Governance**. Give each operation a plain-language summary, its
      success shape and its most likely refusal. Every operation now carries
      exactly one of these tags, checked by test; each has a summary, but its
      most likely refusal is not yet documented operation by operation.
- [ ] Publish a glossary, endpoint chooser and three copy-paste quick starts
      (correct map, defensible trend, reliable sync) which use only current
      OpenAPI routes. Treat them as executable contract tests. The glossary and
      endpoint chooser are the two tables above; they are not yet published
      with the OpenAPI description, and the quick starts are not written.
- [ ] Document the four clocks/identities above beside every data endpoint and
      response example. Do not rename v1 parameters; decide clearer names such
      as `observationPeriod`, `sourceGeography`, `geometryRelease` and
      `atlasRelease` only when designing a versioned successor.
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
      exports and lookups that changed between two releases; periods and
      values are not yet compared, and there is no feed to subscribe to.
- [ ] Expand release comparison from added/removed/changed artifacts to
      semantic diffs, with affected area and record counts where possible.
      Comparison now reaches resource level, naming each resource added,
      removed or changed by its recorded fingerprint; it does not yet say
      which fields, areas or records within a changed resource differ.
- [ ] Serve an archived Atlas release or its immutable resources on request,
      so an analysis can be reproduced as the Atlas published it at a stated
      time rather than merely inspecting its old manifest.
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

- [ ] Define an `analysis geography`: an exact geography and boundary release
      selected as the common frame for a series or comparison.
- [ ] Publish supported historical-to-analysis conversion pairs only where an
      official lookup or validated, measure-appropriate weighting method
      exists. A crosswalk suitable for land area is not automatically suitable
      for people, votes or rates.
- [ ] Return `not-comparable` or separate source partitions where no defensible
      conversion exists. Never fill a gap with a same-code assumption or an
      unlabelled best fit.
- [ ] Test conservation of extensive values, coverage thresholds, rounding and
      uncertainty rules for each measure/crosswalk pair before publication.
- [ ] Let a response state whether a change is observed on a common source
      geography, derived onto an analysis geography, or unavailable.

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
      its schema, row count, hashes and provenance under a pinned release;
      Parquet, GeoParquet and tabular source partitions remain.
- [ ] Deliver boundaries and selected measure joins as cached vector tiles or
      PMTiles. This is the correct map-scale interface; nationwide GeoJSON is
      not.
- [ ] Compile topology-preserving collection/tile geometries for map delivery.
      The existing per-area simplification is appropriate for a feature query,
      but a map must not show cracks or divergent shared borders between
      neighbours.
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
- [ ] Add versioned postcode-to-geography resolution as soon as the relevant
      ONS directory release is available, including the postcode release and
      containment method in every response.
- [ ] Extend coordinate lookup to multiple explicitly selected geographies and
      add a nearest-area convenience route. Nearest must be labelled as a
      distance result, never as containment.
- [ ] Defer address/UPRN lookup, drive-time catchments, public-transport
      catchments and parcel/site intelligence until the data licences, update
      cadence and product vertical justify the greater cost and scope.

Candidate read-only routes:

```text
GET /v1/licensing:assess?measure={measure-id}&boundaryRelease={geography}/{release}&use={map|export|embed|report}
GET /v1/postcodes/{postcode}
GET /v1/areas:contains?lng={longitude}&lat={latitude}&geography={geography}&geography={geography}
GET /v1/areas:near?lng={longitude}&lat={latitude}&geography={geography}
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
      "sourceGeography": { "type": "localAuthority", "boundaryYear": 2023 },
      "coverage": { "kind": "source-reported", "includes": ["England", "Wales", "Scotland", "Northern Ireland"] }
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
GET /v1/areas:contains?lng=-2.2426&lat=53.4808&types=ward,local-authority,constituency
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
GET /v1/translations?sourceGeography=constituency&sourceRelease=2024-07-uk-bgc&code=E14001262&targetGeography=localAuthority&targetRelease=2025-05-uk-bgc-v2&purpose=membership
```

`GET /translations` is the read-only convenience route for one interactive
translation, rather than forcing callers to discover an opaque crosswalk
identifier first. Its query supplies the source geography, release and code,
the target geography and release, and an explicit `purpose`. Bulk translation
is an immutable crosswalk download, not a request which creates server state.

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

- [ ] Publish release-pinned, topology-preserving boundary tiles/PMTiles and
      the associated attribution and licence metadata.
- [ ] Publish a small set of map-ready, source-exact value resources for the
      chosen measures, rather than trying to tile every measure at once.
- [ ] Provide GeoParquet/Parquet and a compact map join contract for the same
      resources, so a customer may use its own renderer or warehouse.
- [ ] Supply one MapLibre/TypeScript reference implementation showing place
      resolution, explicit release choice, values, tiles and citation.
- [ ] Add cache validators and immutable resource URLs before adding API-key
      tiers; public correctness and inexpensive delivery come first. Cache
      validators are in place; resource URLs are not yet pinned to a release,
      so a cached response is revalidated rather than kept indefinitely.

**Exit criterion:** an external engineer can build a cited UK map from the
reference guide without downloading publisher files, guessing a release or
repairing a boundary join.

### Phase 2 — defensible-trend beta

Make one historical claim safe. The target is not universal geography
conversion; it is a small, transparent demonstration that the Atlas can retain
comparability when geography changes.

- [ ] Define the analysis-geography and analysis-preflight contracts.
- [ ] Implement and validate one source-to-analysis conversion path for the
      selected measure/geography pair, including coverage, conservation,
      rounding and refusal behaviour.
- [ ] Return source-exact, derived and not-comparable observations distinctly.
- [ ] Add a compact explanation receipt and release-pinned source evidence for
      this result.
- [ ] Supply an analyst reference implementation that creates one trend and
      one comparison, including a deliberately refused example.

**Exit criterion:** an analyst can reproduce and defend a historical conclusion
on the chosen analysis geography, and can see why the API refuses an unsafe
alternative.

### Phase 3 — reliable-sync beta

Turn the useful resources into production data infrastructure. This is the
first plausible paid operational tier: service value comes from dependable
delivery, change management and support, never from withholding OGL data.

- [ ] Serve archived resources or an equivalent immutable release-pinned
      download path, so a past result remains retrievable.
- [ ] Publish semantic release changes, freshness states, schema compatibility
      changes and a public correction register for the beta resources.
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
   *Done.* `tests/openapi.test.ts` requires the OpenAPI paths to be exactly
   the index's links, placeholder names included, and `tests/contract.test.ts`
   serves every link and every README example against the compiled
   catalogues. Every path now names its placeholders `{geography}`,
   `{release}`, `{code}` and kebab-case ids.
2. **Remove documentation drift.** Keep the conceptual resource model clearly
   labelled as non-binding, and either generate the standalone endpoint list
   below from OpenAPI or replace it with an OpenAPI-derived task index. Do not
   maintain a second hand-written inventory of several dozen URLs.
   *Partly done.* The conceptual model is labelled non-binding, and the
   endpoint list is checked against the index by test, but it is still
   written by hand rather than generated.
3. **Make operations navigable.** Add the task tags, plain-language summaries,
   parameter descriptions, response examples and error references described in
   [API UX and contract clarity](#api-ux-and-contract-clarity). Link the root
   response to the authoritative OpenAPI description and a human documentation
   landing page.
   *Partly done.* All 61 operations carry a task tag and a summary, 57
   document their error responses, and every parameter is described, the
   repeated ones through shared components. The index now links to the
   description, which the API serves at `GET /v1/openapi.yaml`. 24 operations
   have a response example, and there is no human documentation landing page
   to link to yet.
4. **Document the data identity model.** For `/data/{measure}` and every
   derivative route, make source geography, `boundaryYear`, optional
   code-compatible geometry `release`, observation `period` and immutable
   `atlasRelease` unambiguous in OpenAPI and examples. Add negative tests that
   prove a geometry selection cannot be mistaken for a value conversion.
   *Partly done.* Series, rankings and aggregate refuse a geometry `release`
   by test, and the observation route's join states that no conversion was
   applied; the OpenAPI descriptions have not been audited for the four
   identities route by route.
5. **Make errors usable by clients.** Replace loosely documented Problem
   Details extensions with typed schemas, stable `code` values and examples for
   ambiguous place, absence state, incompatible geometry, unsupported
   conversion, partial coverage, invalid format and cursor failures. Test both
   JSON and tabular error representation policy.
   *Done.* `src/problemCodes.ts` declares eleven codes, including ambiguous
   place, incompatible geometry, invalid format and invalid cursor. Each has
   an OpenAPI schema whose example is checked against the live response, and
   a route cannot emit an undeclared code without failing the type check. An
   error is always `application/problem+json`, whatever `format` was asked
   for, which `tests/httpResponse.test.ts` holds for a failed CSV request.
6. **Make delivery semantics consistent.** Audit the implementation against
   the documented `format`/`Accept`, pagination, `Link`, content type,
   `Cache-Control`, provenance and content-hash rules. Implement or remove any
   claim that does not hold. Add representation and pagination contract tests.
   *Partly done.* Conditional requests, caching, `format`, pagination,
   `Link` and content types are documented once in the OpenAPI description
   and held by contract tests. `Accept` turned out to be described but never
   read, and is now documented as not negotiated. Provenance and content-hash
   rules are gated in the validation report rather than by a representation
   test.
7. **Clarify existing convenience resources.** In OpenAPI and docs, label
   `/locations` as curated area collections and `/data/{measure}/value` as a
   by-place convenience dispatcher. Add examples showing `/places` first when
   ambiguity matters; do not rename either v1 path.
   *Done.* OpenAPI calls `/locations` the curated area collections and
   `/data/{measure}/value` a by-place dispatcher, says it is not the primary
   way to fetch an observation, and points at `/places` first where a name is
   ambiguous.
8. **Turn tutorials into integration tests.** Write small, executable
   TypeScript or shell examples for the three golden paths using only the
   published OpenAPI contract. A broken example blocks release rather than
   becoming a support burden.
   *Not started.*

### P1 — prove the correct-map product

9. **Specify the release-pinned map resource contract:** identity, value join,
   simplification/topology tier, attribution, caching, content hashes and the
   distinction between source and geometry release.
10. **Build a topology-preserving tile or PMTiles compiler** for one boundary
    release and test that neighbouring features share edges at every published
    map tier.
11. **Publish one source-exact measure** as a map-ready resource and as
    Parquet/GeoParquet, with schema, manifest and provenance tests.
12. **Create the MapLibre/TypeScript correct-map tutorial** and make it a
    release gate for the first design partner.
13. **Specify, but do not yet generalise,** the analysis-preflight and
    analysis-geography response contracts required by Phase 2. No custom
    geometry or broad analysis endpoint is in this phase.

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
`http://127.0.0.1:3001/v1`. Its initial read-only endpoints are:

- `GET /v1`
- `GET /v1/openapi.yaml`
- `GET /v1/geographies`
- `GET /v1/geography-inventory`
- `GET /v1/datasets`
- `GET /v1/datasets/{dataset-id}`
- `GET /v1/measures`
- `GET /v1/measures/{measure-id}`
- `GET /v1/measures/{measure-id}/compatibility`
- `GET /v1/measures/{measure-id}/coverage`
- `GET /v1/measures/{measure-id}/quality`
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
- `GET /v1/data/population-density?period=2024&geography=localAuthority&boundaryYear=2023`
- `GET /v1/data/house-price-median/series?areaCode=E05008945&geography=ward&boundaryYear=2020`
- `GET /v1/data/imd-decile?period=2019&geography=lsoa&boundaryYear=2011&release=2011-12-ew-bgc-v3&include=area`
- `GET /v1/data/life-expectancy-female/rankings?period=2020-2022&geography=localAuthority&boundaryYear=2021`
- `GET /v1/data/life-expectancy-male/series?areaCode=E06000001&geography=localAuthority&boundaryYear=2021`
- `GET /v1/data/population-estimate?period=2022&geography=constituency&boundaryYear=2024&release=2024-07-uk-bgc&include=area`
- `GET /v1/data/population-density/series?areaCode=E09000012&geography=localAuthority&boundaryYear=2023`
- `GET /v1/attribution?measure=ghg-emissions&boundaryRelease=localAuthority/2025-05-uk-bgc-v2`
- `GET /v1/places?q=Newport`
- `GET /v1/locations?q=york`
- `GET /v1/locations/london`
- `GET /v1/boundary-releases`
- `GET /v1/boundary-releases:resolve?geography={geography}&date={YYYY-MM-DD}`
- `GET /v1/boundary-releases/{geography}/{release}`
- `GET /v1/areas`
- `GET /v1/areas:validate?geography={geography}&release={release}&value={code-or-name}`
- `GET /v1/areas:contains?lng=-1.5491&lat=53.8008&geography=localAuthority&release=2024-05-uk-bgc`
- `GET /v1/areas:intersects?bbox=-1.6,53.7,-1.4,53.9&geography=ward&release=2024-12-uk-bgc`
- `GET /v1/areas/{geography}/{release}/{code}`
- `GET /v1/areas/ward/2024-12-uk-bgc/E05000932/history`
- `GET /v1/areas/ward/2024-12-uk-bgc/E05000932/parents`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/children`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/children/geometry`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/neighbours`
- `GET /v1/areas/{geography}/{release}/{code}/relationships`
- `GET /v1/areas/{geography}/{release}/{code}/capabilities`
- `GET /v1/areas/{geography}/{release}/{code}/citation`
- `GET /v1/areas/{geography}/{release}/{code}/overlap?with={geography}/{release}/{code}`
- `GET /v1/areas/{geography}/{release}/{code}/geometry`
- `GET /v1/areas/localAuthority/2024-12-uk-bgc/E08000014/geometry/metadata`
- `GET /v1/crosswalks`
- `GET /v1/crosswalks/{crosswalk-id}`
- `GET /v1/crosswalks/{crosswalk-id}/records`
- `GET /v1/translations?sourceGeography=ward&sourceRelease=2024-12-uk-bgc&code=E05000932&targetGeography=localAuthority&targetRelease=2024-12-uk-bgc&purpose=membership`
- `GET /v1/relationship-candidates`
- `GET /v1/validation`
- `GET /v1/validation/boundary-releases/{geography}/{release}`
- `GET /v1/validation/crosswalks/{crosswalk-id}`
- `GET /v1/validation/measures/{measure-id}`
- `GET /v1/validation/exports/{export-id}`
- `GET /v1/exports`
- `GET /v1/exports/{export-id}`
- `GET /v1/lookups`
- `GET /v1/lookups/{lookup-id}`
- `GET /v1/atlas-release`
- `GET /v1/atlas-releases`
- `GET /v1/atlas-releases/{release-id}`
- `GET /v1/atlas-releases/compare?from={release-id}&to={release-id}`

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

At the start of every build, the previous manifest is archived under
`public/atlas-releases/`. `GET /v1/atlas-releases/compare` provides a
machine-readable change log between any archived release and the current
release. It reports artifacts added, removed and changed by hash, and, inside
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

Releases archived before fingerprints existed were given them from git
history: for each, the commit where it was the current release supplied the
artifacts, and a kind was recorded only where every artifact it reads matched
the hash the release pinned. All 25 archived releases matched, for every kind
but lookups, which no release pinned before the lookup manifest was added. A
kind one release does not record is reported as `not-recorded` rather than as
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
