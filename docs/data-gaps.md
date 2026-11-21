# Data gaps

Written 2026-11-21, after the history lookups for output areas, LSOAs, MSOAs,
parishes and local authorities (`docs/database-roadmap.md`, task 6, follow-up
4). It lists what is missing from the sources we hold and from the compiled
database. Counts come from the local `data/build/atlas.sqlite` (the default
series in `v_coverage`, `area_release`, `crosswalk` and `area_change_event`)
and from the folders under `data/source`. They are a snapshot, not a
guarantee, and the build will move them.

## Data files still to collect

### 1. Scotland and Northern Ireland across most topics

Many measures cover England only, or England and Wales only.

- England only, about 30 measures: education (attainment, progress, key stage
  4 pupils, enrolments, sessions), social care, planning, temporary
  accommodation, council tax and budgets, waste, ASHE pay, fuel poverty,
  smoking, physical activity, excess weight, preventable mortality, net
  additional dwellings and NHS waiting lists.
- England and Wales only: `population`, `recorded-crimes`, `usual-residents`,
  `households`, `people-in-employment` and the ward house prices.
- ASHE covers Great Britain, but only the England rows are compiled.

Sources to collect:

- NRS and NISRA mid-year population estimates.
- Scottish and Welsh equivalents for education, planning, homelessness,
  council tax and waste.
- Police Scotland and PSNI recorded crime.
- Census tables for Scotland (2022) and Northern Ireland (2021). The 2022
  Scottish output-area and 2021 Northern Ireland data-zone files are held in
  `data/source/core`, but only feed crosswalk weights.

### 2. Earlier years

Many measures hold one period, so they have no trend. Seen with one period:
IMD 2025 (no 2019 or 2015), claimants (one month), broadband, premises,
mobile coverage, public EV chargers, ASHE, council tax, enterprises and the
NHS waiting-list data. Back-years are the cheapest data to add. Roadmap task
44 (change between periods on fixed boundaries) depends on them.

### 3. ITL history

The Code History Database does not cover ITL areas. That is why 25 ITL2 and
43 ITL3 events are still ended or created, none has a legal date, and only
two ITL releases are held. ONS publishes ITL change lookups to collect.

### 4. Only one release for many geographies

Police force areas, fire and rescue authorities, community safety
partnerships, county and unitary authorities, regions, local health boards,
combined authorities, local planning authorities, national parks, major towns
and cities and travel to work areas each have one release, so their boundary
changes cannot be tracked. Parishes start in 2019 and Scottish data zones in 2011.

### 5. Staged but not compiled

These sit in `data/source/_staging`:

- the 25-table UK-wide census collection (190 variables; a research
  harmonisation by GeoDS, not an official release)
- England and Wales population estimates back to 1838
- deaths by area
- GP registered patients and appointments
- hospital admitted care
- the English prescribing dataset
- flood risk for England, Scotland and Wales
- primary care workforce
- childhood vaccination cover
- ethnic group by age and sex
- household economic activity
- local labour market indicators

The `commuting` and `vehicles` folders under `data/source/transport` also have
no measures in default coverage. Compiling the staged files needs no new
collection.

## Gaps in the compiled data

### 1. Change events (`area_change_event`)

- No events for geographies that have crosswalks: data zones (6 crosswalks),
  Senedd constituencies (4), county electoral divisions (4), ICBs, sub-ICB
  locations and fire and rescue authorities. Their identity crosswalk counts
  are 0 or null, which is probably the reason. This has not been confirmed.
- Very few events elsewhere: Scottish Parliament constituencies have 2 and
  ITL1 has 1.
- Legal dates matched: LSOA 1,625 of 6,418, MSOA 225 of 1,025, local
  authority 35 of 53, parish 283 of 380. ITL and Scottish Parliament
  constituencies have none. Everything else keeps its edition date.
- Still ended or created because the database has no successor: 88 ward
  endings and 87 creations, 20 parish endings or creations, and 41 output
  areas created.
- An event is a point in time. `area_version` validity is only known for the
  four recorded polling dates (task 3).
- An event does not say how much land or how many residents moved (task 34).

### 2. Conversion and rollup

- 42 of 96 measures are refused for conversion.
- `v_coverage_missing` has 861 rows and `series_gap` 284,927.
- No `aggregated` series exist, so nothing is rolled up to parent areas
  (task 26), and rates are not rebuilt from numerator and denominator
  (task 27).

### 3. Other open roadmap items

- Population-weighted centroids exist only for 2021 England and Wales output
  areas (task 39).
- No postcode district or sector lookup (task 36).
- No GP practice to LSOA lookup (task 37).
- Neighbours are computed at request time (task 38).
- Population is not rebuilt for every release and year (task 41), and there
  are no per-person measures (task 42).
- No release manifest or diff between releases (task 24).
- Crosswalk weights lack Northern Ireland and Scottish dwellings (task 1).

## Where to start

1. Scotland and Northern Ireland population and census.
2. The ITL change lookup, a small file that closes the largest remaining
   ended and created block.
3. Compile the staged census and population files.
4. Back-years for IMD, claimants and ASHE.
5. Events for data zones and Senedd constituencies, the cheapest compiled
   gap to close.
