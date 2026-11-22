# Time series on one boundary release

Issue #410. `GET /v1/data/{measure}/series?place=…&on={geography}/{release}`
returns every period of a measure for one area of one boundary release. Each
value says how it got there.

## Target releases

Every measure is offered on the four standard releases. They are the
releases the build converts every convertible series onto (see
[conversion accuracy](conversion-accuracy.md#what-the-atlas-converts)):

| `on=`                           |
| ------------------------------- |
| `localAuthority/2026-05-uk-bgc` |
| `ward/2026-05-uk-bgc`           |
| `constituency/2024-07-uk-bgc`   |
| `lsoa/2021-12-ew-bgc-v5`        |

Population is also offered on every other ward, local authority and
constituency release (task 41), as the total of persons of all ages. The
single years of age are not converted there, so a read of
`population?…&on=ward/2015-12-gb-bgc` is served from the converted total,
with the same provenance as any converted value. Which years each release
holds is in [data gaps](data-gaps.md#3-population-on-every-release): 2011 to
2024 on the authorities from 2023-05, and 2022 elsewhere.

The list is read from the database (`convertedReleases`, the releases that
hold a `converted` series), not hard-coded. Any other release is refused with
a 422 that lists the releases that hold converted series.

There is no on-request path. Converting at request time would mean walking
crosswalk chains of up to seven hops and applying split weights per value. A
route is only trusted once its basis has been backtested, and that happens at
build time. Precomputed series cost one indexed read per series. A new target
release is added by adding it to the standard plan and rebuilding.

`on` cannot be combined with `to`. `to` is the older reviewed analysis frame,
and stays as it is.

## Provenance per value

Each entry in `series` carries:

- `method`
    - `native`: the target release's own published value, unchanged.
    - `exact`: whole source areas regrouped on the named crosswalks.
    - `weighted`: at least part of the value was split from a source area the
      target cuts across, in proportion to a weight. Its `exactShare` is the
      share that did not pass through a split, read from `series_estimate`.
- `source` (converted values only): `release`, `rule` (`sum` or `rebuild`),
  `basis` (the weight basis, such as `population`), `crosswalks` (the chain,
  in order), and `seriesCoverage` (the share of the areas the converted series
  reaches that hold a value).
- `rebuiltRatio`: the value is a ratio taken again from a converted numerator
  and denominator.
- `flags`
    - `low-exact-share`: a weighted value with `exactShare` below 0.8
      (`LOW_EXACT_SHARE`).
    - `low-series-coverage`: `seriesCoverage` below 0.9 (`LOW_SERIES_COVERAGE`).
    - `area-not-on-source-release`: the target area did not exist on the
      source release. See [reorganisations](#reorganisations).

The top-level `summary` gives the periods, the first and last, the count by
method, the gaps, `convertedShare`, and `warnings`. Each warning has a code,
a sentence, and the periods it applies to. When a period is published on
the target and also converted from an older release, the native value wins.
Where several datasets publish the measure, the one with the most values is
served, and the choice is stated in `defaults`.

## How the measure type drives the method

The rule comes from `measure_conversion`, which `pipeline/src/conversion/rules.ts`
decides from the measure's declaration:

- **sum** (counts, amounts): converted values are added. Only `population` on
  the `population` basis may be split, because it is the only backtested
  pair. A sum over a dimension, such as votes over party or people over age,
  adds the members the area holds, as the source-exact read does. A member
  with no source value, such as a party that did not stand, is absent, not a
  gap.
- **rebuild** (rates, percentages, weighted means): the numerator and
  denominator are each converted, and the ratio is taken again. A ratio is
  never averaged. A rebuilt ratio is kept only where both parts regrouped
  exactly. A part that was split gives a `split-ratio` gap, because the error
  of a split numerator over a split denominator has not been backtested.
- **refuse** (medians, indices, shares with no stated parts): no converted
  value exists, and each period is a gap with reason `refused-measure`. The
  gap also carries the stored reason.

Some selectors are refused with a 422 before any read: contest winners (a
category, not a value), sums across measures (`plus`), half-width intervals,
values that are already derived, and ratios whose denominator comes from
another dataset or period.

### Fixed in the conversion

- A series was skipped for a target that published the same measure, even
  for periods the target does not publish. Now only the periods the target
  holds are skipped, and the others are converted (`f2b21d05a`).
- The split share of each estimated value was not kept. It is now stored in
  `series_estimate(series_id, area_version_id, period_id, estimated_share)`.
- The general election series converted onto 2024 constituencies now have
  stable ids.
- A sum with an absent member was reported as a gap (see above).

### Hook for #411

`series_estimate.estimated_share` is the per-value input that #411's
uncertainty model needs. The response already exposes it as `exactShare`
and flags low values. #411 can add a measured interval per value from the
backtest error for that share, without changing the shape. That is not
built here.

## Gaps and breaks

A period that is published on some release but has no value on the target is
listed in `gaps`, with one reason per source release:

| Reason                                                                | Meaning                                                                          |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `no-route`                                                            | No crosswalk chain joins the source release to the target.                       |
| `refused-measure`                                                     | The measure has no defensible conversion. The note says why.                     |
| `not-carried`                                                         | A source area's value that no crosswalk on the route carries anywhere.           |
| `unmeasured-split`, `no-weight`                                       | The value would need a split that has no backtested basis.                       |
| `missing-input`                                                       | A predecessor area has no source value, so the regrouped total would be short.   |
| `no-source-value`                                                     | The source holds the period, but not for any area that reaches this one.         |
| `split-ratio`, `missing-component`, `no-denominator`, `mixed-sources` | A ratio part is split, missing, zero, or the parts came from different releases. |

A period that no release publishes is not listed. There is nothing to say
about it.

### Reorganisations

Local government reorganisations (mergers, new unitaries, ward reviews) are
not yet published as events. That is #426. Until then they show in two ways:

- The value carries `area-not-on-source-release` when the target area's code
  did not exist on the source release. The value was built from its
  predecessors' areas, along the stored crosswalks. The `summary` warning
  names #426.
- Where a reorganisation split an area with no weight, the period is a
  `not-carried` or `unmeasured-split` gap rather than an estimate.

What is not detected: a reorganisation that keeps the code but moves the
boundary is only visible through the crosswalk chain in `source.crosswalks`,
not as a flag.

## Proof

- `tests/server/releaseSeries.test.ts` covers each path on a small database:
  native unchanged, exact, weighted with its share and flags, no route,
  rebuilt rate, native-parts rate, refused split ratio, refused median, an
  absent member of a sum, and an unknown area or release.
- `tests/server/releaseSeries.test.ts` also covers a sum converted only as its
  total: the total fills a period whose single years have no value, carries
  its bounds and `exactShare`, never replaces a native value, and does not
  stand in where the parts were converted.
- `pipeline/tests/conversion/populationPlan.test.ts` covers the coverage of
  the plan: every release a source reaches is offered as a total split on
  population, the standard releases and the deprivation denominators are left
  out, a coarser source is a `better-route` skip where finer ones reach all its
  years, and a target with no route is a `no-route` skip.
- `pipeline/tests/conversion/convertTotal.test.ts` covers adding the single
  years into one total before converting it, an area with a part missing
  being a `missing-input` gap, and an official figure on the target being
  kept and never converted over.
- `services/api/tests/releaseSeriesRoutes.test.ts` covers the route: 200s,
  warnings, and the 400, 404 and 422 refusals.
- `services/api/tests/built/releaseSeries.test.ts` is the golden case on the
  built atlas:
    - Dearne South (E05016574), a ward made since 2024, has local election
      votes for 2022, 2023 and 2024. They are converted exactly onto the 2026
      wards from the 2022-12, 2023-12 and 2024-12 ward releases, across chains
      of up to eight crosswalks.
    - The 2025 votes regroup exactly onto the 2026 wards, and the converted
      total equals the published total (1,087,103).
    - The 2022 ward population, rebuilt on the 2026 wards and summed per 2026
      local authority, is compared with the independently published mid-year
      estimate converted onto the same authorities. The comparison covers the
      259 of 361 authorities where every ward holds a value. **Tolerance: 1% per
      authority and 0.2% in total.** Measured: mean 0.17%, worst 0.97%
      (E09000033), total 46,426,782 against 46,461,462 (0.075%). The
      difference is the two sources' own (census-based ward estimates against
      mid-year estimates), not the conversion. Hartlepool's wards, read one
      by one through the route, add up to the same sum.
    - Band D council tax on the 2026 authorities is returned with
      `method: native`, equal to the source-exact series.

## Clients

The generated client packages were removed in `c088f6dc5` and are generated
on demand from `openapi.yaml`. There is nothing to regenerate.
