# API direction

This is the authoritative statement of what the API is for and what to build
next. It replaced the commercial roadmap, the three golden paths and the
phased delivery plan that were in [README.md](README.md); they are in the git
history. Where the two disagree on priority, this document wins.
`openapi.yaml` stays the binding description of what is implemented.

Written 2026-09-29, after putting a set of everyday questions to a local build
of the API (see [What we tested](#what-we-tested)).

## Mission

> The UK's geography intelligence API. Every boundary, every year, behind one
> resolver that understands how UK geography changes — with a curated,
> maintained set of public datasets that answer most people's questions about
> a place, and the tools to match and map your own data.

It is read-only to begin with. Private uploads may come later, but nothing
before launch should depend on them.

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
  from one obvious URL. Today only local authorities, May 2023, can be.
  Everything else has to be fetched one area at a time, or 1,000 at a time
  through a bounding box.
- Every release has map tiles (PMTiles), not only local authorities, May 2023.
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
updated against a local build on 2026-09-30.

| Question                                           | Status         | Notes                                                                                                                                                                                              |
| -------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What's the population of North Wales?              | ✅ one request | `/data/population/value?place=north wales` gives 697,115 (2024) and lists the other "North Wales" places it could have meant.                                                                      |
| Which measures are about house prices?             | ✅ one request | `/measures?q=house prices` finds `house-price-median`, and `house-prices` is accepted wherever the id is. `q=deprivation` lists all four national indices rather than choosing one.                |
| I have 100 LAD codes; which boundary set are they? | ✅ one request | `/areas:validate` ranks releases, and 2019-12 matches all 100. The codes can be POSTed as CSV or JSON, and releases that match equally well are named in `likely.tiedWith`.                        |
| What replaced Allerdale?                           | ✅             | `history` gives Cumberland (E06000063), April 2023.                                                                                                                                                |
| Which wards are in Manchester?                     | ✅             | `children`.                                                                                                                                                                                        |
| What's at this postcode?                           | ✅             | `/postcodes/{postcode}`, or `/areas:contains?postcode=` for the geographies you name.                                                                                                              |
| What's the history of Lancashire?                  | ❌             | Lancashire county exists in one release (2025) with no lineage. The named location is an editorial list of 14 councils. There are no ceremonial or historic counties and no reorganisation events. |
| Give me all 2019 ward boundaries as one file       | ✅ one request | `/boundary-releases/ward/2019-12-uk-bgc` links GeoJSON, GeoParquet and PMTiles. 98 of 99 releases download whole; four that are not coverages have no tiles and download at full detail only.      |
| Map my CSV of 2019 ward values                     | ✅ one request | `POST /boundary-releases/ward/2019-12-uk-bgc:join` with the CSV returns a join table, the unjoined rows with reasons, and the tiles to draw it on.                                                 |
| Convert my 2019 ward counts to 2024 constituencies | ⚠️             | Code translation exists for some pairs; there is no way to send your own values.                                                                                                                   |
| What were the boundaries of X in 2005?             | ❌             | Nothing earlier than 2008 for LADs, 2011 for wards, 2015 for constituencies.                                                                                                                       |

## UX rules

1. **Nothing is deployed, so nothing is frozen yet.** The README currently
   says to keep v1 paths and parameter names stable. There are no v1 clients,
   so this is the only cheap moment to rename, merge and delete. Freeze at
   launch, not before. What freezes is the routes, their parameters and what
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
   `targetCode` and `regionCode`. Still open: the data routes name their
   source partition's code vintage `boundaryYear`, which is not a boundary
   release, so it needs its own word rather than `release`.
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

## Surface: 87 paths to a front door

The API had 93 documented paths on 2026-09-29, and 89 after the first merges
below. Four area and location report paths have since folded into canonical
resources, leaving 87. Many answer the same question in slightly different ways, or expose
build internals as routes. Proposed shape:

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
  with a request for each. Still to do: `/compare` names its two areas
  `baselineAreaCode` and `comparisonAreaCode` rather than `place`, and
  `/data/{measure}` itself still needs its partition named.
- `/data/{measure}/aggregate` folds into `value`, which already dispatches to
  it.

### Publish as documents, not routes

`/validation/*`, `/corrections`, `/geography-health`, `/geography-inventory`,
`/relationship-candidates`, `/relationship-repairs`,
`/analysis-geography-validation`, and the per-measure `quality`,
`reconciliation`, `coverage-plan`, `conversion-support` and `compatibility`
routes. These are the evidence that the archive is correct. Link them from
the release and measure resources, and serve them as static files.

### Park

`/terrain` and `/terrain/elevation/point` (a remote elevation preview, not UK
boundary or statistical data). The analysis-geography formalism
(`/analysis-geographies`, `/analysis:plan`) beyond the one conversion it
already supports.

## Priorities

### Now: close the gaps that block the mission

1. **Simplify the surface.** Apply the merges, the one vocabulary and the
   `include=` folding above while it costs nothing. Update `openapi.yaml`, the
   docs page and the contract tests in the same passes. Under way: see
   [Merge](#merge); `latest` is accepted wherever a path names a release, and
   `/areas:contains` takes a postcode. `pnpm contract:surface
--before-launch` locks a deliberate break until launch.
2. **Places with history.** Ceremonial counties (the source is in
   `data/geography/ceremonial-counties` and, since `data-2026-09-29`, in the
   published data release, but not yet compiled into the API), then historic
   counties, then reorganisation events as
   first-class lineage, so a county, a district and its successors can be told
   as one story.
3. **Matching your own data by name.** Name matching with parent hints, and a
   whole-column diagnosis that says which geography and release a column is
   and what in it is broken.
4. **The last boundary download gaps.** `dataZone/2011-12-sc-nc` has no
   readable geometry, and the 2022 and 2021 data zone ids carry no month, so
   `latest` cannot place them.

Done since this was written, and recorded in the [question
bank](#question-bank): whole-release downloads and tiles for 98 of 99
releases, measure discovery by name and alias, and a `POST` body, match
report and `:join` for your own data.

### Next: depth

- **Backfill the archive**, working from the [gaps](#archive-gaps), earliest
  releases first for the most-used geographies (LAD, ward, constituency,
  LSOA/MSOA/OA, region, county).
- **Resolutions.** Most releases are generalised (BGC) only. Add full
  resolution (BFC/BFE) where people need accurate edges, and extra-generalised
  (BUC) for fast web maps.
- **Stateless value conversion.** Send `code,value` rows, a target geography
  and a method, and get converted values with the crosswalk and its quality.
- **Dataset breadth** driven by the question bank: add what common questions
  reach for and we don't have, before adding more of what we do.

### Later

- Private uploads and storage.
- API keys, quotas and usage tiers. These only matter once it is deployed.
- Custom polygon queries.

### Parked

These are good ideas but not needed for a solid first API. Don't extend them
until a real user asks.

- DuckDB/dbt sync references, change feeds and freshness contracts (the old
  "reliable sync" path).
- Consultancy decision layers: area briefs, peer groups, signals and profiles.
- Terrain and elevation.
- Further analysis-geography conversions beyond the one already built.
- Commercial positioning and pricing.

## Archive gaps

The compiled archive holds 99 releases across 33 geographies. Many
geographies have only one release, so they can't answer anything historical.

| Geography                                                        | Releases held        | Gap                                                 |
| ---------------------------------------------------------------- | -------------------- | --------------------------------------------------- |
| Local authority                                                  | 19 (2008–2026)       | Pre-2008, including the 1990s unitary changes       |
| Ward                                                             | 17 (2011–2026)       | Pre-2011                                            |
| Westminster constituency                                         | 9 (2015–2024)        | 2010 and earlier                                    |
| Parish                                                           | 7 (2019–2026)        | Pre-2019                                            |
| Country                                                          | 6 (2020–2025)        | Earlier releases                                    |
| LSOA                                                             | 4 (2001, 2011, 2021) | —                                                   |
| MSOA                                                             | 1 (2021)             | 2011 and 2001                                       |
| Output area                                                      | 1 (2021)             | 2011 and 2001                                       |
| Region                                                           | 1 (2025)             | Every earlier release                               |
| County and unitary authority                                     | 1 (2025)             | Every earlier release; the 2009 and 2019–23 changes |
| Combined authority                                               | 1 (2025)             | Earlier releases                                    |
| Police force area, fire and rescue, community safety partnership | 1 each               | Earlier releases                                    |
| Integrated care board                                            | 1 (2026)             | 2022–2025, and CCGs/STPs before them                |
| Senedd constituency                                              | 1 (2022)             | The 2026 constituencies                             |
| Ceremonial county                                                | not compiled         | Everything (source is in the data release)          |
| Historic county                                                  | none                 | Everything                                          |
| Built-up areas                                                   | none                 | 2022                                                |
| National Landscapes (AONBs)                                      | none                 | Current                                             |

Grow this table as a checklist: a row is done when every published release is
compiled, related to its neighbours in time, and downloadable whole.

## What we tested

On 2026-09-29, a fresh local build (`services/api/public`) was served and asked the
question bank above as a first-time user would, starting from `/places` and
`/measures` and without the README. The results are the statuses in the
[question bank](#question-bank). Re-run it after each priority lands, and
update the statuses here.
