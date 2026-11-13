# Product direction

What the UK Data Atlas is for, what in it is most valuable, and what to build
next. It covers the whole project: website, API, MCP server, pipeline and
database.

Written 2026-11-10 from two reviews of the repo at `a1cd196b7`: a review of
the docs, layout and `atlas.sqlite` schema, and an independent second review
asked to challenge the first. Where they disagreed, the outcome is recorded
under [Decisions](#decisions).

This note sets priority across the project. The other notes keep their detail:

- [services/api/DIRECTION.md](../services/api/DIRECTION.md): API mission,
  pillars, question bank and UX rules.
- [database-roadmap.md](database-roadmap.md): database tasks 1 to 51. Task
  numbers below refer to it.
- [data-organisation.md](data-organisation.md): themes, topics and layout.

Where they disagree with this note on what to do first, this note wins.

## Aim

An extraordinary product with excellent UX that solves a real problem. Money
is not the focus for now. See [Commercial](#commercial-parked).

## The problem

> My UK data is on the wrong boundaries, and I can't join, compare or trend
> it.

- **Who:** an analyst at a council, ICB, charity or think tank, a researcher,
  or a data journalist on a deadline.
- **The moment:** a lookup returns 40 missing rows because the file uses 2019
  ward codes, or a trend chart has a cliff in April 2023 because Cumbria was
  reorganised.

A second, larger problem rests on the same engine:

> Tell me about this place, in numbers I can trust and cite.

This is for people who will never call an API: local reporters, councillors,
bid writers. The field is crowded (ONS Explore Local Statistics, Nomis, LG
Inform). The edge is what the engine alone gives: series that stay consistent
through boundary change, all four nations, and custom areas.

## Identity

One sentence, used on the homepage and at the top of every direction doc.
Working version:

> UK data that still lines up after the boundaries change.

Today three docs give three answers: `ARCHITECTURE.md` says the website is the
priority, `DIRECTION.md` says the boundary archive, and `database-roadmap.md`
says a database sold as modules. The homepage says "A powerful mapping
platform for visualizing data" (`app/page.tsx`), which names nothing unique.

## Centre of gravity

The database is the engine. It is not the centre of gravity. Nobody's moment
of pain is "I lack a SQLite file".

The centre is the **conversion engine, felt on two surfaces**:

1. **`/fix`**, for the user's own data: drop a file, find out what it is,
   repair it, convert it, map it, download it.
2. **Place pages**, for our data: every figure as a consistent series on
   current boundaries, with rank, peers and markers where boundaries changed.

The API, the MCP server and the database download expose the same engine to
developers and agents. They follow the two surfaces. They do not lead them.

A feature is judged by whether a person can see or feel it. Six weeks of
commits to 2026-11-10, by scope: api 441, data 385, pipeline 278, atlas 164.
That balance should shift towards what users see.

## What is gold

1. **Boundary archive, lineage, weighted crosswalks and stable IDs.** 104
   releases, 207 crosswalks, 99.96% of edges with a residents weight,
   append-only ID registries. The hardest part to copy.
2. **Converted series.** Any measure on current boundaries as a consistent
   time series, each value naming its method and carrying a quality score
   (tasks 25, 33, 41, 44). As of the roadmap's measurement, all 1,643 series
   are `published` and none are `converted`, so the headline value is not in
   the file yet.
3. **Measured accuracy.** Run conversions where the true answer is known, for
   example 2011 census small areas converted to wards against the published
   ward figures. Publish the error per crosswalk and weight basis, and use it
   to fill `lower` and `upper`. A quality score without this is only a claim.
   It comes with converted series, not after.
4. **The `/fix` flow and the validate, join and convert routes.** The one
   screen where the engine becomes an experience.
5. **API honesty.** Nothing guessed, every answer shows its working, a refusal
   rather than a misleading number. The docs landing page already says this
   better than the homepage does.
6. **Point-level sources counted into every release.** Data published by
   postcode or coordinate can be aggregated exactly to any boundary vintage,
   with no crosswalk error. These would be the highest-quality series held.
7. **Derived products that are hard to get elsewhere.** Statistical
   neighbours, postcode sector to official areas, custom-area profiles,
   notional election results. Each waits for a user need.

## What is not gold

- **Dataset breadth for its own sake.** The sources are free from ONS, Nomis
  and Fingertips. Add a dataset when a user asks or a derived product needs
  it.
- **The free-form `/atlas` explorer.** It is the part AI assistants make
  trivial. Maintain it, and stop adding features to it.
- **Module packaging.** Dropped for now. One assembled file when a download
  ships.
- **Byte-for-byte dual JSON and row representations** (tasks 8 and 9). They
  slow every schema change.
- **Archive completism.** Pre-2008 backfill, extra resolutions and the four
  topology failures can wait for a user.
- **A wider API surface.** Freeze at the front door routes.

## AI

AI is a threat to one-off maps and a tailwind for a trusted source that agents
query. An agent can draw a map. It cannot cheaply rebuild ten years of ward
changes with correct weights, and it answers confidently and wrongly when it
tries.

- The MCP server becomes a hosted, zero-install endpoint. Today it needs a
  repo checkout (`services/mcp/README.md`) and has eight read-only tools, with
  none for validating, joining or converting supplied data.
- A question benchmark, grown from the question bank in `DIRECTION.md`, scores
  plain LLM answers against MCP-backed ones. It doubles as a regression suite.
- The database describes itself (tasks 3, 10 and 28), so an agent can learn
  what is answerable by querying it.

## Decisions

Settled 2026-11-10.

| Question          | Decision                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Centre of gravity | The conversion engine on `/fix` and place pages. The database is the engine underneath.                                            |
| Modules           | No per-module packaging for now.                                                                                                   |
| Vintages          | Start archiving raw source files with hashes and retrieval dates now. Defer the vintage schema.                                    |
| The freeze        | No schema restructuring, API growth or new datasets until Now items 1 and 2 are live. Exceptions: Price Paid and source archiving. |
| Selling           | Parked. Open versus paid for the derived data is undecided, see [Open questions](#open-questions).                                 |
| Website role      | The website is the product for people who do not write code. Only the `/atlas` explorer is a showcase.                             |

Vintages are the one place the reviews still differ. The second review would
defer them entirely. The case for archiving now: publishers overwrite revised
figures, so history not kept is lost for good, and keeping the raw files is
cheap.

## Now

In order. Items 1 and 2 lift the freeze when live.

| #   | Task                                                                                                                                                                                                                                                               | Done when                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | **Ship `/fix` as the headline promise.** Accept `.xlsx` and `.ods` (rejected today in `components/fix/InputPanel.tsx`). Lift the 10,000 row limit (`lib/fix/table.ts`) past an England LSOA file, about 33,000 rows. One-click corrected download. Index the page. | A real analyst's spreadsheet goes from dropped to corrected download in under 60 seconds. |
| 2   | **Turn place pages into answers.** Converted series for about ten measures (tasks 4, 25, 27, 41), with published backtest accuracy. Show the value, the trend on current boundaries, rank, peers, markers where boundaries changed, and a cite control.            | A council page answers "how has this changed?" without a cliff at a reorganisation.       |
| 3   | **Settle the identity sentence.** Rewrite the homepage and the openings of `ARCHITECTURE.md`, `DIRECTION.md` and `database-roadmap.md` around it.                                                                                                                  | All four say the same thing.                                                              |
| 4   | **Watch five people use `/fix`.** Add a feedback and "report a wrong number" route. The About page is empty.                                                                                                                                                       | Five sessions observed and written up in this folder.                                     |
| 5   | **Archive sources.** Keep every downloaded source file with its URL, retrieval date and SHA-256, and never overwrite one.                                                                                                                                          | A revised publication leaves both versions on disk.                                       |
| 6   | **Host the MCP server.** Add validate, convert and join tools. Publish the benchmark beside it.                                                                                                                                                                    | An assistant connects with a URL and no checkout.                                         |
| 7   | **Freshness.** Detect new publisher releases, and publish a status page: what the source has, what we hold.                                                                                                                                                        | A stale series is visible to us before a user finds it.                                   |
| 8   | **Price Paid at point level**, counted into every release. Fixes stale answers such as a 2022 house price on a 2020 ward because the ward series ended. Check the licence's address conditions first.                                                              | House prices are current on current boundaries.                                           |

Also keep deployment in step with the repo. On 2026-11-10 the live site
appeared behind it: `/fix` and `/llms.txt` returned 404.

## Next

After the freeze lifts. Unordered within each group.

### Seen by users

- "Explain this number" as a control on every figure: source file, method,
  crosswalk, weights, notes and breaks. Not only an API route.
- Custom-area profiles: polygon, radius or postcode list in, measures out
  (`DIRECTION.md`, "answers that are hard to get elsewhere", item 3).
- "Is this change real?": split a change into boundary effect, method change
  and the rest (`DIRECTION.md` item 5, task 44).
- Generated geography release notes: what split, merged and was recoded in
  each boundary release.
- Fix `/places/manchester` and similar: a visitor lands on a "grouping of
  councils" with "no official status".
- The old 19-card Economics group, now split into theme sections
  (`data-organisation.md` task 4).
- Meet analysts where they work: Excel, Sheets, QGIS, Power BI.

### Database

Keep these two early, because they show in the UI:

- Conversion error in `lower` and `upper`.
- Series breaks: dated method or definition changes per measure.

Deferred until a surface needs them:

- Vintage schema: a publication vintage on each series, superseded values
  kept.
- `source_file` table linked from `series`, built on the archive from Now
  item 5.
- Corrections ledger: original value, corrected value, reason, evidence.
- Notes and caveats as rows, attached to a dataset, measure, period or area.
- Identifier concordance: GSS, old ONS codes, NHS ODS, DfE numbers, ITL,
  Wikidata, OSM.
- Deflators and real-terms money measures.
- Area classifications as attributes: rural-urban, ONS area classification,
  coastal.

### Engine

- The validation harness, strict enough to accept or reject a dataset without
  a person reading it. The second review called this breadth tooling. Its
  other use is keeping one maintainer's upkeep bounded, which is the binding
  constraint.
- Running the engine on a user's private data through the declaration format,
  treated as a public, documented contract.
- UPRN as the smallest unit, from OS Open UPRN. About 40 million rows, so a
  separate file.
- More point-level sources: police.uk street crime, Companies House, school
  and GP registers, NaPTAN. Check each licence.
- A public errata register for source defects found, reported upstream.

## Later, or when a user asks

- Statistical neighbours and postcode sector to areas (tasks 45, 36).
- Notional election results (task 46). High reputational risk, and no boundary
  review is imminent.
- A harmonised UK census, H3 and 1 km grid outputs, migration flows, council
  political control. Each is breadth until someone needs it.
- An in-browser SQL console and Python and R packages. They serve the people
  who least need help.
- The project's identifiers as a citable reference. Citation is earned by use.
- The theme and topic restructure beyond its task 4, and the database download
  as a product.

## Open questions

- **Who is the named user?** `DIRECTION.md` says "anyone". No user
  conversation or usage reading is recorded anywhere.
- **Open or paid for the derived data?** A paid, non-redistributable database
  conflicts with wanting agents and researchers to treat it as a reference.
  `DATA-LICENCES.md` describes a paid product and a `licence` table that is
  not built.
- **What is the freshness promise?** How soon after a publisher release.
- **What does "extraordinary" mean, measurably?** The 60 second target in Now
  item 1 is a first answer.
- **When to launch?** The English local government reorganisation will break
  every council series, which makes it a natural moment. Its timetable
  (recalled as 2027 to 2028) is unchecked.

## Commercial (parked)

Recorded so it is not lost. Not a priority.

- Everything is reproducible: the repo is public AGPL and the sources are
  mostly OGL. A customer would pay for freshness, verification and
  convenience, so updates must be fast and visible.
- Organisations already pay for this kind of data: councils and charities
  (OCSI Local Insight, LG Inform Plus), political and polling teams
  (notionals), and property, insurance and retail analysts (postcode sector
  data).
- There are no API keys, quotas or billing yet.

## Not verified

- Neither review rendered the site in a browser. Views on `/atlas`, visual
  quality and mobile come from code and fetched text.
- The claim that place pages show no values came from the live site. The
  repo's `components/places/AreaPlacePage.tsx` has headline figures with
  ranks. Trends on fixed boundaries are absent in both.
- "No converted series" is from `database-roadmap.md`, measured 2026-11-05 to
  2026-11-08, not re-counted.
- "No users" is inferred from the absence of evidence in the docs.
- Audience size is judgement, not measurement.
- Licences for Price Paid, EPC and older boundary sets were not checked.
