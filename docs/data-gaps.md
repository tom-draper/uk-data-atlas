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
  accommodation, council tax and budgets, waste, fuel poverty,
  smoking, physical activity, excess weight, preventable mortality, net
  additional dwellings and NHS waiting lists.
- England and Wales only: `population`, `recorded-crimes`,
  `people-in-employment` and the ward house prices.
- Census coverage includes usual residents and households across the UK.
  Scotland 2022 adds detailed age, sex, housing, health, disability, caring,
  identity, language, qualifications, employment, migration, commuting and
  armed forces veteran tables.
  Northern Ireland 2021 adds age and sex, household size and spaces, and
  district-level tenure and 48 other district tables. The census year follows
  each nation's census day.
  Nation-specific categories retain their published definitions (section 5).
- ASHE pay covers England, Wales and Scotland, from 2012 to 2025. Northern
  Ireland is not in these ONS tables, which publish no authority rows for it.

Sources to collect:

- NRS and NISRA mid-year estimates by age and sex are now collected
  (`population-council-scotland`, 1981 to 2025, and `population-district-ni`,
  2001 to 2025, single years of age 0 to 90 and over by sex, compiled
  2026-11-23). Their small-area files (data zones) are held as before, for 2011 to
  2024 in Scotland and 2021 to 2024 in Northern Ireland, and are not
  updated.
- ASHE for Northern Ireland, which the ONS tables do not carry, and for
  years before 2012, which are not compiled. The earnings and hours
  tables for those years use earlier occupation codings and layouts, so they
  need checking before they are read as the same series.
- Scottish and Welsh equivalents for education, planning, homelessness,
  council tax and waste.
- Police Scotland and PSNI recorded crime. Not collected on 2026-11-22:
  statistics.gov.scot now redirects to data.gov.scot, which has no direct
  file for the council-area series, and the PSNI statistics pages link no
  downloadable tables. The OpenDataNI monthly file ends in December 2021.

### 2. Earlier years

Many measures hold one period, so they have no trend. Seen with one period:
broadband, premises, mobile coverage, public EV chargers, council tax,
enterprises and the NHS waiting-list data. IMD holds 2015 and 2025, with no
2019 (the 2019 file is in the folder but not read). The 2015 edition is
England only, on the 2011 LSOAs (32,844 areas). Its scores, ranks and deciles
are not converted, because ranks and deciles are relative to the year's own
England and cannot be summed or compared across editions. The deprivation
card lists the 2015 decile and rank beneath 2025 for an LSOA whose code is
unchanged since 2011, and the 2015 share in the most deprived tenth for an
authority with the same code in both editions, never as a trend. Its population
converts to 31,907 of the 35,672 2021 LSOAs and to coarser areas. Back-years
are the cheapest data to add. Roadmap task 44 (change between periods on fixed
boundaries) depends on them.

ASHE now holds 2012 to 2025, by area of residence and by workplace, for
England, Wales and Scotland. 2012 to 2024 are the revised editions and 2025 is
provisional. From 2021 the survey codes occupations to SOC 2020, so 2021 onward
is not directly comparable with earlier years, and 2020 and 2021 come from a
smaller sample that includes furloughed employees. The measure notes say so.
The catalogue and API serve every year on the authorities of 2025, and again on
those of 2020, 2019 and 2016, so an authority merged or recoded since keeps its
earlier years under its earlier code. The Pay and Workplace Pay cards draw that
whole history, and the Claimant Count card draws the monthly history from
January 2013.

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

The 110 compiled nation census datasets use National Records of Scotland and
Northern Ireland Statistics and Research Agency archives under
`data/source/population/population-estimates`. Both source records carry Open
Government Licence v3.0 and publisher attribution in `meta.json`.

- **Scotland 2022.** UV101b, UV102b, UV113, UV302 and UV404 share measures
  only where the published categories agree. New standalone data-zone tables
  cover single-year age, sex totals from UV102b, marital status, household
  composition and lifestage, ethnicity and identity, country of birth,
  religion, passports, language, care, disability, long-term conditions,
  accommodation, tenure of residents, vehicles, household size, heating,
  bedrooms, qualifications, economic activity, hours worked, industry,
  occupation, socio-economic classification, migration, travel to work or
  study and armed forces veteran status. UV201 and the
  economic activity tables use Scotland-specific measures and definitions.
  UV204b uses the publisher's all-age, all-sex counts.
- **Scottish follow-ups.** UV104b, UV106b, UV201b, UV202b, UV205b to UV212b,
  UV301b to UV303b, UV501b, UV603b and UV604b cross age or sex with another
  topic and need dimension modelling. UV701b, UV703b and UV704b also need
  dimensions for their published travel cross-tabulations.
  Scotland's disclosure dashes are read as zero. Published cells can differ
  from separately reported totals.
- **Northern Ireland 2021.** MS-A01, MS-A09, MS-E01, MS-E02 and MS-E04 are
  compiled from the data-zone sheets. A14 repeats A01's resident counts
  alongside area and density. Density needs an area denominator and cannot
  be summed to councils. MS-E15 provides household tenure on the 11 local
  government districts and supplies the household default there. Another 48
  phase 1 to 3 tables supply published district counts for population,
  identity, health, housing, qualifications, labour and travel. MS-A09 covers
  MS-A05. MS-E10 includes the household categories, while the vehicle total
  and average have a different unit. The following workbooks lack a district
  or data-zone sheet and need separate geography or historical-series handling:
  phase 1 A03, A04, A06, A11 to A13, A17, A19, A21, B16, B20, B22, B24 and
  E03, phase 2 B11, D05 to D16 and E07, and phase 3 A27, A28, B04, B25, C01,
  C02, F01 to F03, H03, H04 and K02. MS-I01 to MS-I04 supply the published
  travel counts. Supplemental archives remain staged.
- Nation count conversions are checked series by series against their
  published totals on the 2026-05 authorities. The atlas also aggregates
  those source counts to countries. Independently disclosure-controlled
  publisher totals can differ from these aggregates. Mid-year estimates
  use a different reference date.
- The ONS ethnic group by age and sex workbook combines Cornwall with the Isles
  of Scilly and the City of London with Westminster. Those counts need explicit
  composite geographies before the complete table can be compiled. Household
  economic activity A1(LA) is an Annual Population Survey release for 2025.

New standalone count measure keys use the dataset slug plus a category suffix,
for example `census-2022-scotland-uv102b-sex-female`,
`census-2022-scotland-uv405-all-occupied-households` and
`census-2021-ni-e04-household-spaces-without-usual-residents`. MS-E15 uses the
existing `tenure-total` measure and the `tenure-ni-*` keys for rental categories
specific to Northern Ireland.

The `commuting` and `vehicles` folders under `data/source/transport` also have
no measures in default coverage. Compiling the staged files needs no new
collection.

## Gaps in the compiled data

### 1. Change events (`area_change_event`)

- The Scottish 2011 to 2022 data-zone replacement and the 2026 Senedd
  replacement are linked through postcode-overlap crosswalks (basis
  `postcode-overlap`), so their splits and merges are measured from residents,
  not recorded. Neither publisher has a predecessor lookup: NRS publishes only
  2022 output-area linkage, not data zone 2011 to 2022. The data-zone
  crosswalk is derived and checked against councils in a built test. The 2001
  Scottish data-zone edition is absent from the atlas.
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
- How much each area changed between releases (`area_change_extent`, task 34) has gaps:
    - Land is null on 49,365 of 679,310 rows. No pair with only an official
      lookup has measured land: local authorities 2009 to 2011, 2022-12 to
      2023-05 and 2024-12 to 2025-05, LSOA 2011 to 2021 (34,629 rows), Scottish
      Parliament and Senedd constituencies 2022 to 2026. Most code-changing
      splits and merges elsewhere also lack an `area` weight.
    - 16 releases have a later vintage but no one-hop route to it, so have no
      rows: constituency 2022-12-uk-bgc, county electoral division
      2017-05-en-names and 2023-05-en-bgc, data zone 2011-12-sc-bfc and 2021-ni,
      historical constituency 1918, 1945, 1950, 1955, 1974, 1983 and 1997,
      integrated care board 2023-04-en-bgc, LSOA 2011-12-w-bgc, NHS England
      region 2022-07-en-bgc, ward 2019-12-gb-bgc.
    - LSOA 2001 to 2011 runs through extent continuity only, so splits there
      have no successor row.

### 2. Conversion and rollup

- 42 of 96 measures are refused for conversion.
- `v_coverage_missing` has 861 rows and `series_gap` 284,927.
- No `aggregated` series exist, so nothing is rolled up to parent areas
  (task 26).
- Only three rates are rebuilt from numerator and denominator (task 27): the
  claimant rate, recorded crime per 1,000 residents and public EV chargers per
  10,000 residents. The claimant rate is not rebuilt on the 2022-12 and 2024-05
  authorities, whose population has no single years of age, and crime on
  community safety partnerships has no population to divide by. The counts
  marked `named` in `COUNT_DENOMINATORS` have a denominator but no rate yet.
- The IMD 2025 population is not a mid-year estimate of 2025, so rates for
  2025 in England and Wales use the 2024 estimate and say so in
  `rate_input.earlier_year`.

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
  revised ones, 5,511,800 and 5,543,300 for the whole country. They replace
  the unrevised 5,506,000 and 5,546,900 that `population-uk` holds (it was
  compiled before NRS revised them), a rise of 5,800 for 2023 and a fall of
  3,600 for 2024 (by council, from -990 to +2,520). The totals agree with the
  data zones: the sum of the council areas equals the sum of the data zones
  for every year 2011 to 2024.
- The revised figures already win everywhere the default view takes a value.
  `population-uk` is ranked after both nation files and after the data
  zones, and no default population value of any Scottish or Northern Irish
  area comes from it on any release (`populationNationRank.test.ts`). No
  default cell changes, so there is no before and after to report. The dataset
  itself is kept as published, with the unrevised Scottish 2023 and 2024
  figures. The outputs that read it by name as the population (the
  per-100,000 measures, population density, the `residents` ranking recipe,
  place facts and age arrays) still use those two years for the 32 Scottish
  councils. Using the nation files there would change the `population-uk`
  payload, its content hashes and the direct-payload goldens, so it is left
  as a separate decision. The ONS file `myebtablesuk20112024.xlsx` is the one
  held, and it carries the unrevised figures. Whether ONS has re-issued it
  with the revised ones is not checked, as nothing beyond the pinned release
  is downloaded.
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
  the 2021 LSOAs) hold the new datasets as converted series by age and sex,
  which `v_observation_default` does not rank, and also as a converted total
  of persons of all ages (`STANDARD_TOTAL_DATASETS`), ranked after every
  finer source. England and Wales defaults are unchanged and no existing
  Scottish or Northern Irish value changes. On the 2026-05 authorities this
  adds 992 Scottish cells (32 councils, 1981 to 2010 and 2025) and 231
  Northern Irish ones (11 districts, 2001 to 2020 and 2025). The 2026-05
  wards, the 2024 constituencies and the 2021 LSOAs gain nothing, because no
  route reaches them from an authority release.
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

### 4. Other open roadmap items

- Population-weighted centroids exist only for 2021 England and Wales output
  areas (task 39).
- No postcode district or sector lookup (task 36).
- No GP practice to LSOA lookup (task 37).
- Neighbours are computed at request time (task 38).
- Population reaches every release only for the years held (task 41, see
  above). Every count names its denominator, but only three per-person rates
  are built (task 42).
- No release manifest or diff between releases (task 24).
- Crosswalk weights lack Northern Ireland and Scottish dwellings (task 1).
- A fixed-boundary change has no published comparison where the area's code
  was not published at one end (152,256 of 1,454,005 rows in
  `v_area_period_change`, `boundary_check = 'code-not-published'`), and method
  breaks are flagged, not estimated (task 44).

## Where to start

1. Review the remaining census tables and composite ONS geographies in
   section 5, then compile the other staged population files.
2. Police Scotland and PSNI recorded crime, once a direct download is found.
3. Collect official predecessor lookups to link the Scottish data-zone and
   Senedd constituency events, and add the 2001 Scottish data-zone inventory.
