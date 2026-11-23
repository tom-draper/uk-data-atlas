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
- England and Wales only: `population`, `recorded-crimes`,
  `people-in-employment` and the ward house prices.
- England and Wales, with Scotland (2022) and Northern Ireland (2021) for the
  census tables compiled so far: `usual-residents`, `households`, age in
  five-year bands, general health, tenure and household composition. Each
  nation counts as at its own census day, so they are separate periods of the
  same measure. Scotland also publishes finer categories England and Wales do
  not (single years from 15 to 19, dependent children by number, shared
  equity), which are measures with Scotland as their only source. Section 5
  lists what is left.
- ASHE covers Great Britain, but only the England rows are compiled.

Sources to collect:

- NRS and NISRA mid-year estimates by age and sex are now collected
  (`population-council-scotland`, 1981 to 2025, and `population-district-ni`,
  2001 to 2025, single years of age 0 to 90 and over by sex, compiled
  2026-11-23). Their small-area files (data zones) are held as before, for 2011 to
  2024 in Scotland and 2021 to 2024 in Northern Ireland, and are not
  updated.
- Scottish and Welsh equivalents for education, planning, homelessness,
  council tax and waste.
- Police Scotland and PSNI recorded crime. Not collected on 2026-11-22:
  statistics.gov.scot now redirects to data.gov.scot, which has no direct
  file for the council-area series, and the PSNI statistics pages link no
  downloadable tables. The OpenDataNI monthly file ends in December 2021.
- Seven census tables for Scotland (2022) and Northern Ireland (2021) are
  compiled onto their data zones (section 5 lists the rest, which are staged
  but not compiled).

### 2. Earlier years

Many measures hold one period, so they have no trend. Seen with one period:
broadband, premises, mobile coverage, public EV chargers, ASHE, council tax,
enterprises and the NHS waiting-list data. IMD holds 2015 and 2025, with no
2019 (the 2019 file is in the folder but not read). The 2015 edition is
England only, on the 2011 LSOAs (32,844 areas). Its scores, ranks and deciles
are not converted, because ranks and deciles are relative to the year's own
England and cannot be summed or compared across editions. Its population
converts to 31,907 of the 35,672 2021 LSOAs and to coarser areas. Back-years
are the cheapest data to add. Roadmap task 44 (change between periods on fixed
boundaries) depends on them.

### 3. ITL history

Closed on 2026-11-22. The Code History Database does not cover ITL areas, so
the ONS ITL2 and ITL3 2021 to 2025 change lookups
(`core/lookups/itl-changes`) and the 2025 ITL hierarchy are now held. Every
ITL2 and ITL3 change between the two releases is explained: ITL3 has 37
recoded, 10 redrawn, 5 split, 5 redistributed and 2 renamed, and ITL2 has 4
redistributed and 2 split, with none ended or created. None has a legal date,
and only two ITL releases are held.

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

The Scotland and Northern Ireland census folders have moved out of `_staging`
to `data/source/population/population-estimates`, because five Scottish tables
(UV101b, UV102b, UV302, UV404 and UV113) and two Northern Ireland tables
(MS-A01 and MS-E01) are compiled. The rest of both folders is left:

- Scotland's Census 2022 (`census-2022-scotland-data-zone`, 76 tables on the
  2022 data zones), apart from the five above. Ethnic group (UV201) and
  economic activity are defined differently from England and Wales, so they
  are not compiled. Where Scotland publishes a category more finely or
  differently, it is published as a measure of its own and never summed or
  matched to an England and Wales one: ages 15, 16 to 17 and 18 to 19 (in
  place of 15 to 19), shared equity, owned with a mortgage excluding shared
  equity, and council and housing association renting as one social rented
  figure. In household composition, the dependent-children categories are split
  into one and two or more, and the other household types into one, two or
  more, all full-time students, all aged 66 and over, and the rest. The England
  and Wales parents of these (15 to 19, owned with a mortgage, social rented
  from a council, and so on) have no Scottish value. The other UV tables are not
  read.
- The Northern Ireland Census 2021 main statistics
  (`census-2021-northern-ireland`), apart from MS-A01 and MS-E01. A09, A14,
  E02 and E04 have categories to match, and some tables have no data zone
  sheet. The phase 2, phase 3 and supplemental archives are not read. The
  Northern Ireland household default is the household composition total,
  because no tenure table is compiled for it.
- Scotland's disclosure control shows a small count as a dash, read here as
  zero. UV101b supports this, with households equal to all people in 5,818 of
  5,844 data zones and higher in the rest, but NRS does not state it. Neither
  nation's tables add to their totals, so the sums are not checked.
- Conversion backtests for the nation tables (`CENSUS_TABLES` in
  `backtestCases.ts`).

The `commuting` and `vehicles` folders under `data/source/transport` also have
no measures in default coverage. Compiling the staged files needs no new
collection.

## Gaps in the compiled data

### 1. Change events (`area_change_event`)

- The Scottish 2011 to 2022 data-zone replacement and the 2026 Senedd
  replacement now have ended and created events. The six data-zone crosswalks
  connect to other geographies. The Senedd crosswalk between editions measures
  postcode overlap. Both transitions still need official predecessor lookups
  to show splits, merges or other linked changes. The 2001 Scottish data-zone
  edition is absent from the atlas.
- County electoral divisions, integrated care boards, sub-ICB locations and
  fire and rescue authorities still have no events. Their crosswalks connect
  different geographies, so they cannot supply changes between editions.
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

### 3. Population on every release

Task 41 step 1 converts the mid-year estimates held, as a total of persons of
all ages, onto every ward, authority and constituency release. Step 2 added
three small-area sources, which feed the same conversion: the finest source
for each nation is tried first, and an official figure always beats a
converted one.

- `population-lsoa`: ONS LSOA mid-year estimates, 2011 to 2024, England and
  Wales (2021 LSOAs, 35,672 areas).
- `population-data-zone-scotland`: NRS small-area estimates, 2011 to 2024, on
  the 2022 data zones (7,392 areas).
- `population-data-zone-ni`: NISRA small-area estimates, 2021 to 2024, on the
  2021 data zones (3,780 areas).
- `population-council-scotland`: NRS mid-year estimates by single year of age
  and sex for the 32 council areas, mid-1981 to mid-2025 (45 years), from the
  mid-2025 time series (393,120 published values).
- `population-district-ni`: NISRA mid-year estimates by single year of age and
  sex for the 11 local government districts, mid-2001 to mid-2025 (25 years),
  from the mid-2025 file `MYE25-SYA` (75,075 published values).

What is still out of reach:

- LSOA estimates now reach wards and constituencies through the ONS LSOA to
  ward lookups (2024, 2025 and 2026 wards) and the LSOA to 2024 constituency
  lookup, added 2026-11-22. Every English and Welsh ward on 2024-05, 2025-05
  and 2026-05 has every year 2011 to 2024 (7,536, 7,545 and 7,552 wards), as
  do all 575 English and Welsh 2024 constituencies. December releases get
  only the wards unchanged since May. About 43 small wards per release have
  no best-fit LSOA, so no value. The default view (`v_observation_default`)
  takes the best-ranked value for each area and period, so on the 2024
  constituencies and the 2026-05 wards the LSOA years show beside the
  published constituency estimates and the IMD 2025 denominator, and the
  Scottish data-zone values show on the 2026-05 wards. A period of a quantity
  can therefore draw on several series, area by area. `v_coverage.is_default`
  is 1 for every series the default view takes at least one area from in that
  period, whatever its rank, and `default_areas` and `default_share` say how
  many areas and what share of the release it supplies.
- Every population source is converted onto every release it reaches,
  finest first, and a coarser source keeps a value only for an area and
  period no finer source reached (`better-route` gaps for the rest). The ONS
  ward estimates for 2022 therefore fill the wards LSOAs miss: 2,235 of the
  8,588 wards on 2011-12 have a 2022 value, and 23 to 32 more authorities and
  13 to 14 more constituencies per release before 2023.
- Conversion takes a publisher's best-fit membership lookup (such as LSOA to
  ward) only where no route avoids it, so IMD 2025 reaches every 2026-05
  authority through the authority lookups rather than through the wards.
- NI data zones reach only the 2025-05, 2025-12 and 2026-05 authority
  releases. NI wards and constituencies get nothing, and NISRA super data
  zones are not compiled because no release holds them.
- Scottish data zones reach wards (2015-12 onwards), constituencies (2015-12
  to 2024-07) and authorities (2011-12 onwards). Authority releases before
  2017 carry a value for only 4 Scottish councils (28 to 32 from 2017).
- The NRS and NISRA council-area files are compiled (task 41 step 3,
  2026-11-23), with the same age (0 to 89, 90 and over) and sex members as
  `population-uk`. Both publish exactly those bands, so no band is mapped or
  split. They rank after `population` and before `population-uk` (see
  `measurePreferences.ts`), so a data-zone sum still wins wherever one is held
  (Scotland 2011 to 2024, Northern Ireland 2021 to 2024) and the council and
  district files fill the rest. England and Wales defaults are unchanged
  (`v_observation_default` is identical for every English and Welsh area).
  What they add, on the authority releases from 2023-05 to 2025-12: Scotland
  1981 to 2010 and 2025 (45 years, up from 14), and Northern Ireland 2001 to
  2010 and 2025 (25 years). Authority-release cells of
  Scotland with a default value rise from 224 to 379, and of Northern
  Ireland from 74 to 129. NI values for 2011 to 2024 are the same as the
  ones `population-uk` held, and Scotland's 2023 and 2024 values are NRS's
  revised ones, which are higher than the unrevised 5,506,000 and 5,546,900
  `population-uk` holds for the whole country (it was compiled before NRS
  revised them). The totals agree with the data zones: the sum of the
  council areas equals the sum of the data zones for every year 2011 to 2024.
- The NRS time series files each year under the code the council area had
  then. Sixteen old codes are mapped to the current ones (the 1995 codes to
  2001, the 2011 codes to 2002, Fife and Perth and Kinross from 2018, Glasgow
  City and North Lanarkshire from 2019). Each is a one-to-one renaming, which
  NRS describes as a very minor boundary change, so no population is moved
  between areas (`COUNCIL_AREA_CURRENT_CODE` in `nationSource.ts`).
- Scottish and Northern Ireland wards and constituencies get no new years.
  There is no route from the authority release these files are published on
  to a ward or constituency release (`no-route` in the conversion skips, as
  for `population-uk`), and a total is never split down. Authority releases
  before 2023-05 get none either, as for every authority-level source. NI
  has no ward or constituency population at all, as before.
- The standard releases (the 2026-05 authorities, wards, constituencies and
  the 2021 LSOAs) hold the new datasets only as converted series by age and
  sex, which `v_observation_default` does not rank. The default total of a
  standard release is still built from the small-area and mid-year totals, so
  Scotland and Northern Ireland on the 2026-05 authorities keep 2011 to 2024
  and 2021 to 2024 as before. The 1981 to 2010 and 2025 years show on the
  five authority releases above.
- Data zones are not updated. No data-zone release newer than 2011 to 2024
  (Scotland) and 2021 to 2024 (NI) is held, and the council files are on
  authorities.
- The authority estimates (2011 to 2024, on the 2023-12 authorities) reach
  only the authority releases from 2023-05. No crosswalk carries the April
  2023 mergers back, and a total is never split down onto smaller areas, so
  authorities before 2023-05, wards and constituencies get none of them.
- Some ward and year cells cannot be reached by a population source. There are
  525,030 distinct cells with a `not-carried` gap and no default population
  value, most on the 2011 to 2018 ward releases. For 2022, 2,235 of 8,588
  wards on 2011-12 and 6,932 of 8,482 on 2022-12 have a value. A gap records
  a missing route for one source, so counting gap rows also counts cells that
  another source fills and can count the same cell more than once.
- Authority releases 2008 and 2009 have no route from any population source.
- The constituency estimates (2021 and 2022, on the 2024 constituencies) have
  no route back across the 2024 review, and every authority release they
  reach is already covered by the authority estimates, so none are converted.
- The new source folders, and the Scotland and Northern Ireland census folders
  moved out of `_staging`, must be in a published data release before other
  checkouts can build them.

### 4. Other open roadmap items

- Population-weighted centroids exist only for 2021 England and Wales output
  areas (task 39).
- No postcode district or sector lookup (task 36).
- No GP practice to LSOA lookup (task 37).
- Neighbours are computed at request time (task 38).
- Population reaches every release only for the years held (task 41, see
  above), and there are no per-person measures (task 42).
- No release manifest or diff between releases (task 24).
- Crosswalk weights lack Northern Ireland and Scottish dwellings (task 1).

## Where to start

1. Publish a data release holding the new source folders
   (`population-council-scotland`, `population-district-ni`, and the
   Scotland and Northern Ireland census folders): other checkouts cannot
   build the atlas without it.
2. Compile the rest of the staged Scotland and Northern Ireland census
   tables (section 5), and the other staged census and population files.
3. Collect ASHE back-years.
4. Police Scotland and PSNI recorded crime, once a direct download is found.
5. Collect official predecessor lookups to link the Scottish data-zone and
   Senedd constituency events, and add the 2001 Scottish data-zone inventory.
