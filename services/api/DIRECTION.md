# API direction

This is the authoritative statement of what the API is for and what to build
next. It replaced the commercial roadmap, the three golden paths and the
phased delivery plan that were in [README.md](README.md); they are in the git
history. Where the two disagree on priority, this document wins.
`openapi.yaml` stays the binding description of what is implemented.

Written 2026-09-29, after putting a set of everyday questions to a local build
of the API (see [What we tested](#what-we-tested)). Implementation status reviewed
on 2026-10-20 against the source, tests and a fresh compiled archive.

## Mission

> The UK's geography intelligence API. Every boundary, every year, behind one
> resolver that understands how UK geography changes — with a curated,
> maintained set of public datasets that answer most people's questions about
> a place, and the tools to match and map your own data.

It is read-only to begin with. Private uploads may come later, but nothing
before v1 is frozen should depend on them.

The centre of gravity is the **boundary archive**. Boundaries are what break
people's own visualisations: the wrong vintage, a missing nation, a code that
changed between the data and the map. Everything else in the API gets its
value from resting on a complete, correct archive and a resolver that knows
how its releases relate.

## Who it is for

Anyone who has a UK question involving places, or UK data they want to put on
a map: developers building maps and apps, analysts and researchers, journalists,
civic and public-sector teams, students. We are not designing for a
procurement process or a paid tier yet. The earlier consultancy-first and
"reliable warehouse sync" framing is parked (see [Parked](#parked)).

## The four pillars

Each pillar says what "no big gaps" means. That is the bar for being ready to
deploy.

### 1. Boundary archive

Every published boundary release for every UK geography we support, each one
available three ways: as individual areas, as a whole-release download, and as
map tiles.

**No big gaps means:**

- Every compiled release can be downloaded whole, as GeoJSON and GeoParquet,
  from one obvious URL. The current build publishes all 104 releases whole.
- Every release has map tiles (PMTiles). The current build tiles 100 releases;
  four others have full-detail downloads but fail the topology check.
- The archive holds every release ONS (and NISRA, Scottish Government, OS)
  publishes for the core administrative and statistical geographies, not only
  the latest. See [Archive gaps](#archive-gaps).
- "Which release was current on date X in nation Y?" is answered for every
  geography (`/boundary-releases:resolve` already does this; it needs the
  archive behind it).

### 2. Geography resolver

One resolver that turns anything a person might have — a name, code,
postcode, coordinate or grid reference — into exact area identities, and
knows every relationship between them: containment, succession, overlap and
membership of named places.

**No big gaps means:**

- Any code resolves, current or abolished, with what it became or came from.
- Any two geographies with a published or derivable relationship can be
  converted, with the method and its quality stated.
- Places people talk about exist as places: ceremonial and historic counties,
  regions, city regions, nations, national parks. They come with their
  history, not only today's membership.
- Local government reorganisations are first-class events (the 1974 counties,
  the 1990s unitaries, 2009, 2019–2023), so "what's the history of
  Lancashire?" gets a real answer.

### 3. Curated datasets

A maintained collection of public measures, repaired and joined to the right
boundary release, answering common questions in one request.

**No big gaps means:**

- The measures most questions reach for are present across all four nations
  where the sources allow, and coverage is stated where they don't.
- They are discoverable by the words people use. `GET /measures?q=` finds
  them by id, alias, label or dataset title, and a reviewed alias is accepted
  wherever a measure id is.
- Any measure can be asked for any place (name, code, postcode, named
  location) in one request, with the method used named in the answer.
  `/data/{measure}/value` already does this well.

### 4. Your own data

Bring a column of codes or names: find out which geography and release it is,
fix what's broken, convert it to where you need it, and put it on a map.

**No big gaps means:**

- Matching: "here are 100 area codes, what boundary set are they?" This works
  today through `/areas:validate`. Add name matching with parent hints, a
  whole-column diagnosis, and a downloadable match report.
- Converting: send your values and a target geography, get them back
  converted through a stated crosswalk. This stays stateless and read-only,
  since the request carries the data and nothing is stored.
- Mapping: send `code,value` rows and a release, get back joined GeoJSON (or a
  join table plus a tile URL). Again stateless.
- Bulk input goes in a request body (`POST`), not hundreds of query
  parameters. A read-only API can still accept a body for a query.

## Question bank

These are the acceptance tests. A pillar is done when its questions are
answered in one or two obvious requests, without reading the README. Add
questions as they occur to us. Status is from the local run on 2026-09-29,
updated against a local build on 2026-09-30. Later implementation findings are
identified below; they do not represent a fresh run of every original question.

| Question                                           | Status         | Notes                                                                                                                                                                                                              |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What's the population of North Wales?              | ✅ one request | `/data/population/value?place=north wales` gives 697,115 (2024) and lists the other "North Wales" places it could have meant.                                                                                      |
| Which measures are about house prices?             | ✅ one request | `/measures?q=house prices` finds `house-price-median`, and `house-prices` is accepted wherever the id is. `q=deprivation` lists all four national indices rather than choosing one.                                |
| I have 100 LAD codes; which boundary set are they? | ✅ one request | `/areas:validate` ranks releases, and 2019-12 matches all 100. The codes can be POSTed as CSV or JSON, and releases that match equally well are named in `likely.tiedWith`.                                        |
| What replaced Allerdale?                           | ✅             | `history` gives Cumberland (E06000063), April 2023.                                                                                                                                                                |
| Which wards are in Manchester?                     | ✅             | `children`.                                                                                                                                                                                                        |
| What's at this postcode?                           | ✅             | `/postcodes/{postcode}`, or `/areas:contains?postcode=` for the geographies you name.                                                                                                                              |
| What's the history of Lancashire?                  | ⚠️ partial     | Ceremonial and historic definitions, dated membership, alternative definitions and membership comparisons are implemented. Earlier boundary vintages and legally dated reorganisation events remain separate work. |
| Give me all 2019 ward boundaries as one file       | ✅ one request | `/boundary-releases/ward/2019-12-uk-bgc` links GeoJSON, GeoParquet and PMTiles. All 104 releases download whole; four that are not coverages have no tiles and download at full detail only.                       |
| Map my CSV of 2019 ward values                     | ✅ one request | `POST /boundary-releases/ward/2019-12-uk-bgc:join` with the CSV returns a join table, the unjoined rows with reasons, and the tiles to draw it on.                                                                 |
| Convert my 2019 ward counts to 2024 constituencies | ⚠️             | Supplied counts can be POSTed to a named crosswalk. This particular ward-to-constituency request still depends on a published crosswalk for the exact releases.                                                    |
| What were the boundaries of X in 2005?             | ❌             | Nothing earlier than 2008 for LADs, 2011 for wards, 2015 for constituencies.                                                                                                                                       |

## UX rules

1. **Early access, so nothing is frozen yet.** The API is deployed, but in
   early access, and the docs say v1 will change. This is the cheapest moment
   to rename, merge and delete, while the few clients have been told to expect
   it. Freeze when early access ends, not before. What freezes is the routes, their parameters and what
   they return. How the build lays its output out on disk is the API's own
   business and can change in any release, since every file is served
   through a route.
2. **One question, one request.** If a common question needs three calls and
   an id looked up from a fourth, add a front-door route, a default or an
   alias rather than documenting the dance.
3. **A small front door.** About twenty routes should answer most questions
   (see below). Everything else is either folded into those as an option, or
   kept as an advanced or transparency route, clearly labelled.
4. **One vocabulary.** Pick one word for each concept and use it everywhere:
   `geography`, `release` (or `date` to let the API pick), `place` for
   anything a person might type, `period` for observation time. Done for
   `place`: every data route takes it in place of `areaCode`, `locationId`,
   `targetCode` and `regionCode`. Done: `codeYear` names the source partition's area-code vintage. `release` names a boundary release.
5. **Accept what people have.** Wherever an area is expected, accept a code,
   a name, a postcode or a named location, and resolve it the same way
   `/data/{measure}/value?place=` does, reporting the other matches.
6. **Sensible defaults, loudly stated.** Latest period, current release,
   most likely match. Always say in the response what was defaulted, as
   `value` already does, never silently.
7. **Transparency is published, not queried.** Validation reports,
   corrections, quality and coverage matter, but they are build outputs.
   Serve them as documents linked from the resources they describe, not as a
   parallel set of query routes.

## Surface: 71 paths to a front door

The current contract has 71 paths after aggregation and evidence routes were folded into value and static documents. The front door below answers common questions; advanced operations remain documented separately.

### Front door

| Job                                             | Route                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Find anything by name, code or postcode         | `GET /places?q=`                                                                                     |
| One area, with optional extras                  | `GET /areas/{geography}/{release}/{code}?include=`                                                   |
| Its geometry                                    | `…/geometry`                                                                                         |
| Its history, parents, children, neighbours      | `…/history`, `…/parents`, `…/children`, `…/neighbours`                                               |
| What's here (point, postcode or grid reference) | `GET /areas:contains`                                                                                |
| Postcode                                        | `GET /postcodes/{postcode}`                                                                          |
| Browse the archive                              | `GET /geographies`, `GET /boundary-releases`                                                         |
| One release, whole                              | `GET /boundary-releases/{geography}/{release}`, with `.geojson`, `.parquet` and `.pmtiles` downloads |
| Which release on a date                         | `GET /boundary-releases:resolve`                                                                     |
| Named places                                    | `GET /locations/{id}`, `…/members`, `…/geometry`                                                     |
| Convert codes                                   | `GET /translations`                                                                                  |
| Match your data                                 | `GET` or `POST /areas:validate`                                                                      |
| Map your data                                   | `POST /boundary-releases/{geography}/{release}:join` (new)                                           |
| Find a measure                                  | `GET /measures?q=`                                                                                   |
| Answer a question                               | `GET /data/{measure}/value?place=`                                                                   |
| Table of values                                 | `GET /data/{measure}`                                                                                |
| Over time                                       | `GET /data/{measure}/series`                                                                         |

Typed [TypeScript and Python clients](../../clients/README.md) wrap these
routes, generated from `openapi.yaml`.

### Merge

- Done: `/relationship-paths`, `/relationship-capabilities`,
  `/conversion-plan` and `/relationship-coverage` took the same six
  parameters and answered "can I get from A to B, and how?"; they are now
  `/relationships`, and `/translations` does the conversion.
- Done: `/places`, `/areas?q=` and `/areas:resolve` were three name searches.
  `/places` is the only one; `/areas` is a plain paged listing.
- Done: `dossier`, `capabilities`, `citation` and `metrics` are `include=`
  options on an area; location capabilities are `include=capabilities` on the
  location.
- Done: `/series`, `/change`, `/rankings`, `/compare` and `/aggregate`
  default the partition as `value` does: a geography the place or the
  measure leaves no choice about, its newest boundary year and its latest
  period, stated in `defaults`. `/series`, `/change` and `/compare` take an
  area name as well as a code, and a name meaning several areas is a 409
  with a request for each. Done: `/compare` accepts `baselinePlace` and `comparisonPlace`. `/data/{measure}` defaults a partition when the source leaves one clear choice.
- Done: `/data/{measure}/aggregate` is removed. `value` answers named places and accepts explicit source and membership parameters for a detailed aggregate.

### Publish as documents, not routes

`/validation/*`, `/corrections`, `/geography-health`, `/geography-inventory`,
`/relationship-candidates`, `/relationship-repairs`,
`/analysis-geography-validation`, and the per-measure `quality`,
`reconciliation`, `coverage-plan`, `conversion-support` and `compatibility`
routes. These are the evidence that the archive is correct. Link them from
the release and measure resources, and serve them as static files.

The evidence routes now ship as static documents at `/documents/{document-id}.json`. Every measure links to its quality, coverage plans, compatibility, conversion support and period-by-period reconciliations. Releases link to archive validation and geography health. `pnpm --dir ../.. data:build --only documents` produces the reports before the `atlas-release` stage pins their manifest.

### Park

`/terrain` and `/terrain/elevation/point` (a remote elevation preview, not UK
boundary or statistical data). The analysis-geography formalism
(`/analysis-geographies`, `/analysis:plan`) beyond the one conversion it
already supports.

## Priorities

### Now: close the gaps that block the mission

1. **Close the remaining delivery gaps.** All 104 boundary releases have
   whole-release downloads. Four releases fail
   the shared-edge topology check: `dataZone/2022-sc-bfc`, `dataZone/2021-ni`,
   `lsoa/2001-12-ew-bgc` and `ward/2017-12-gb-bgc`. Their full-detail downloads
   remain available. Investigate the affected geometry before replacing it.
   `lsoa/2001-12-ew-bgc-v2` replaces the thinned 2001 LSOA release and is
   tiled; the thinned snapshot stays held unchanged.
2. **Complete the missing relationships.** The published Northern Irish
   data-zone membership adapter relates the district field to the held 2025
   local-authority release. The candidate inventory still identifies DEA and
   super-data-zone fields whose boundaries need source imports. The 2022 NHS
   England region release has an area-overlap crosswalk to the 2024 release.
3. **Backfill current and census boundaries.** The 2026 Senedd
   constituencies and the 2001 and 2011 MSOA and output-area releases are held,
   tiled and related. Separately generalised BGC files fail strict
   containment between census levels, so the 2011 OA-LSOA, 2011 LSOA-MSOA
   and 2001 LSOA-MSOA relationships come from the official ONS lookups, with
   reviewed overhang waivers. The 2001 OA-LSOA lookup is still missing: the
   ONS table keys output areas by their old `00AAFA0001` codes, while the
   held boundaries use `E00000001` codes. Relating them needs a pinned
   old-to-new code translation, tested for one-to-one coverage, rather than
   loosening containment. Keep the 2010 Westminster gap open until a polygon
   source is verified. A map PDF or a code lookup is not a boundary release.

The 2026-10-20 delivery investigation found that the held 2001 LSOA source
was thinned in this repository to meet an obsolete GitHub file-size limit.
That operation collapsed small polygon parts into rings with only two
distinct vertices. `lsoa/2001-12-ew-bgc-v2` is the publisher's unthinned
geometry, imported as a new snapshot. It passes the topology check and is
tiled. It carries the old release's continuity to 2011 LSOAs and best fit to
2026 local authorities. Clients still on `lsoa/2001-12-ew-bgc` should move to
it. The thinned release is deprecated, with `lsoa/2001-12-ew-bgc-v2` named as
its replacement; it has no sunset date yet, so it is not scheduled for removal.

The other three delivery failures involve source defects. The 2017 wards
contain small polygon parts inside neighbouring wards. Northern Irish 2021
data zones have tiny overlapping parts at three junctions. Scottish 2022
data zones contain near-spikes, which become exact shared edges after
reprojection rounding. Keep these releases downloads-only until a reviewed
source revision or explicit correction resolves the defects. Do not silently
snap, discard, or repair their coordinates to make tiles pass.

The Scottish Government's statistics.gov.scot records relate all 7,392 held
2022 data zones to December 2024 council areas as clean containment, with a
reviewed coastal overhang waiver. They also assign each data zone to one
December 2024 ward, one 2024 UK Parliament constituency and one 2011-based
Scottish Parliament constituency (the 2022 release). Data zones do not nest
in those, so the assignments are published as `membership` only, as the ONS
ward-to-constituency lookup is. The records' intermediate-zone, health-board
and health-and-social-care-partnership codes cannot be published until those
boundary releases are held. The 2011-to-2022 data-zone translation remains
unresolved.

The ONS `DZ_DEC_2011_SC_NC` source is a names-and-codes table, not an
unclipped boundary release. Its [publisher service](https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/DZ_DEC_2011_SC_NC_45ae61d197ca46658b7431e39e1eb3de/FeatureServer?f=pjson)
has no layers and one table. It remains in the source inventory as a lookup;
`dataZone/2011-12-sc-bfc` supplies the 2011 Scottish boundaries.

Run `pnpm --dir services/api audit:archive` after a data build to list delivery
failures, unpublished relationship candidates and the releases held for each
geography. The output records the compiled manifests' hashes, so a report can
be tied to the exact inputs inspected. It audits the held archive, not every
release available from publishers.

Per-area geometry validity reports are implemented. `data:build --only geometry-store`
compiles them without repairing coordinates, and `include=metrics` and geometry
responses expose them in source provenance. Reports identify invalid geometry
and areas not checked, including those above the validator's position limit.
They do not certify that a release is a valid cross-area coverage. The fresh
build holds compiled stores for all 104 releases; its archive audit still lists
the four delivery gaps and two relationship gaps above.

Completed since the original question bank: whole-release downloads for all
104 releases, map tiles for 100, measure discovery by name and alias, request
bodies and downloadable match reports, matching with parent hints, and `:join`
for supplied data. `POST /crosswalks/{crosswalk-id}:convert?semantics=count`
converts supplied counts with explicit weighting opt-in and coverage. Ceremonial
and historic counties are sourced named locations
with dated membership and comparison routes. Year-only boundary ids participate
in date selection through registry metadata. The query consolidation and
`include=` folding described above are implemented.

### Next: depth

- **Backfill the archive**, working from the [gaps](#archive-gaps), earliest
  releases first for the most-used geographies (LAD, ward, constituency,
  LSOA/MSOA/OA, region, county).
- **Resolutions.** Most releases are generalised (BGC) only. Add full
  resolution (BFC/BFE) where people need accurate edges, and extra-generalised
  (BUC) for fast web maps.
- **Conversion coverage.** Add reviewed crosswalks for common supplied-data
  requests that the initial single-crosswalk count conversion cannot answer.
- **Dataset breadth** driven by the question bank: add what common questions
  reach for and we don't have, before adding more of what we do.

### Next: answers that are hard to get elsewhere

Added 2026-10-26. The API is most valuable where a general-purpose assistant
or a quick script gives a confident wrong answer. Each item below rests on the
archive, the lineage and the weighted conversion together, so it is hard to
copy. In priority order:

1. **Consistent time series on one boundary release.** "Unemployment for
   2024 wards, 2011 to 2025", with every period rebuilt on the same
   boundaries and each rebuilt value naming its conversion method. Boundary
   changes break most UK trend analysis; this is the clearest answer to it.
2. **Better weights for conversion.** Area- and population-weighted conversion
   exists. Next:
    - Choose the weight to suit the measure: residents for people,
      households for household measures, dwellings or address counts for
      housing, workplaces for jobs.
    - Build splits from the smallest units held (output areas, postcodes,
      address counts from OS Open UPRN), not from overlapping two large
      polygons.
    - Return a range or quality score with every converted value, so a user
      can tell an exact regrouping from an estimated split.
3. **Profiles of custom areas.** A polygon, radius, drive time or list of
   postcodes in; every measure apportioned into it out. Medians, rates and
   indices are rebuilt by their proper method (a rate from its numerator and
   denominator, population-weighted deprivation scores) or refused with a
   reason, never averaged. This replaces "custom polygon queries" in Later.
4. **Official projections on any geography.** Serve the ONS, NRS, NISRA and
   Welsh Government population and household projections, converted through
   the crosswalks to any held release. Sourced and low risk. Our own
   projections stay out until we can publish backtests (how the method would
   have predicted the past) and ranges; a wrong forecast under our name costs
   trust in everything else.
5. **Is this change real?** Split an area's change between two periods into
   a boundary effect, a source or method change, and the remaining change.
6. **Notional election results.** Past elections re-estimated on new
   constituency and ward boundaries, with the method stated. A known hard
   problem, using data already held.
7. **Small-area estimates.** Spread a figure published only for councils down
   to LSOAs using held covariates, always labelled as modelled.

Items 1, 3 and 5 need observations stored as rows (see Foundations).

### Foundations

Changes to how the API is built that the work above depends on, or that cut
cost:

- **Observations as rows.** Store each observation as a row in
  `atlas.sqlite` (dataset, measure, area, release, period, value) instead of
  one JSON payload per dataset, so most new datasets become configuration
  rather than compiler code. Started with one pilot dataset.
- **The data build outside the API.** Build code runs in `pipeline/` and
  shared packages. The API serves the resulting release, and the website reads
  shared release assets. See [the move plan](../../docs/data-pipeline-move.md).
- **Heavy joins out of Node.** Consider DuckDB for large tabular and spatial
  joins in the build, which spills to disk instead of exhausting memory. Keep
  our own shared-arc tiler and boundary mappings.
- **Fewer stored download variants.** Each release is stored as GeoJSON and
  GeoParquet at four detail levels plus PMTiles (5.2 GB). Keep full detail and
  tiles, and make simplified downloads on request with caching.
- **Route schemas as the source of the contract.** Generate `openapi.yaml`
  from typed route schemas rather than maintaining both by hand, and group
  `src/` by domain.

### Making it easy to reach

- Generated TypeScript and Python clients from `openapi.yaml`.
- An MCP server over the front-door routes, so AI assistants can answer UK
  place questions with the API's answers rather than guesses. Built as
  `services/mcp` (stdio, eight read-only tools); not yet published.
- `llms.txt`, copyable `curl` examples per front-door route, and a public
  changelog tied to the release id.
- Usage counts by route and question type, without personal data, to choose
  which gaps to close first. Built: set `ATLAS_USAGE_DIR`, then
  run `usage:report`.

### Later

- Private uploads and storage.
- API keys, quotas and usage tiers. These only matter once usage grows past
  early access.
- Similar areas: "which councils are most like Wigan?" across chosen measures.
  Cheap once observations are rows.
- Address and UPRN lookup.

### Parked

These are good ideas but not needed for a solid first API. Don't extend them
until a real user asks.

- DuckDB/dbt sync references, change feeds and freshness contracts (the old
  "reliable sync" path).
- Consultancy decision layers: area briefs, signals and profiles. Similar
  areas moved to Later.
- Terrain and elevation.
- Further analysis-geography conversions beyond the one already built.
- Commercial positioning and pricing.

## Archive gaps

The compiled archive holds 104 releases across 33 geographies. Many
geographies have only one release, so they can't answer anything historical.

| Geography                                                        | Releases held                      | Gap                                                  |
| ---------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Local authority                                                  | 19 (2008–2026)                     | Pre-2008, including the 1990s unitary changes        |
| Ward                                                             | 17 (2011–2026)                     | Pre-2011                                             |
| Westminster constituency                                         | 9 (2015–2024)                      | 2010 and earlier                                     |
| Parish                                                           | 7 (2019–2026)                      | Pre-2019                                             |
| Country                                                          | 6 (2020–2025)                      | Earlier releases                                     |
| LSOA                                                             | 5 (2001, 2011, 2021)               | —                                                    |
| MSOA                                                             | 3 (2001, 2011, 2021)               | —                                                    |
| Output area                                                      | 3 (2001, 2011, 2021)               | —                                                    |
| Region                                                           | 1 (2025)                           | Every earlier release                                |
| County and unitary authority                                     | 1 (2025)                           | Every earlier release; the 2009 and 2019–23 changes  |
| Combined authority                                               | 1 (2025)                           | Earlier releases                                     |
| Police force area, fire and rescue, community safety partnership | 1 each                             | Earlier releases                                     |
| Integrated care board                                            | 1 (2026)                           | 2022–2025, and CCGs/STPs before them                 |
| Senedd constituency                                              | 2 (2022, 2026)                     | —                                                    |
| Ceremonial county                                                | Sourced named locations            | Historical boundary releases and legal change events |
| Historic county                                                  | Sourced circa-1888 named locations | Historical boundary releases and legal change events |
| Built-up areas                                                   | none                               | 2022                                                 |
| National Landscapes (AONBs)                                      | none                               | Current                                              |

Grow this table as a checklist: a row is done when every published release is
compiled, related to its neighbours in time, and downloadable whole.

## What we tested

On 2026-09-29, a fresh local build (`services/api/public`) was served and asked the
question bank above as a first-time user would, starting from `/places` and
`/measures` and without the README. The results are the statuses in the
[question bank](#question-bank). Re-run it after each priority lands, and
update the statuses here.
