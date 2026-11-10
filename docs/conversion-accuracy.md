# Conversion accuracy

How well a figure published for one set of areas can be moved onto another, what
the atlas does with the answer, and what it refuses to do.

Every number here comes from two stage runs on 2026-11-10, against the atlas
base built on 2026-11-09: `conversion-backtest` (tables in
`data/build/conversion-backtest/backtest-tables.md`) and `converted-series`
(tables in `data/build/converted-series/converted-series.md`). The tables below
are copied from those files. Run `pnpm data:build` to make them again.

## Summary

- **Exact regrouping is safe to show.** Where every source area lies wholly in
  one target area, the converted value is the sum of published values, with no
  estimate in it. Local authority to local authority, and LSOA to local
  authority for administrative counts, reproduced the published figure on every
  value compared.
- **An exact regrouping is exact arithmetic, not always the figure the publisher
  would print.** Census counts are perturbed for disclosure at every level, so
  LSOA counts added up to an authority differ from the published authority count
  (median 0.28%, 95th percentile 2.6%). Ward population estimates added up to an
  authority differ from the authority estimates by a similar amount.
- **An estimated split of a total population is good.** Wards to constituencies
  by residents: median error 0.083%, largest 1.34%. Constituencies to local
  authorities by residents: median 0.171%, 95th percentile 1.05%, largest 10.0%
  (Isles of Scilly).
- **An estimated split of anything else is refused.** Splitting an age and sex
  group by total residents gave errors up to 207.64%. Bases other than residents
  were worse than residents on every case. Best-fit lookups used as a conversion
  were wrong by up to 13.82% while looking exact.
- **The bounds are honest and wide.** They held the published figure on all but
  one of 3,134 checked values, 802 of them held out from the fit. They are
  much wider than the typical error.
- The atlas now holds 318 converted series: 1,216,154 regrouped values and 566
  estimated ones. 48 of 96 measures are refused outright, each with its reason.

## Method

### Carrying a value

A conversion follows a pinned route of crosswalks from the source release to the
target release (`pipeline/src/conversion/pinnedRoutes.ts`). Each source value is
shared between its target areas by the edge weights in `v_crosswalk_weight` on
one weight basis, and the parts landing in a target are added. Alongside the
value, each target carries:

- `atRisk`: how much of the value came through an edge with a weight below 1,
  on any step.
- the crosswalks that split it, and how much was pruned from its sources (pairs
  under 1% that the crosswalk dropped).

A value with nothing at risk is **regrouped**. Anything else is **split**.

A target gets no value, and a gap with a reason, when:

| Reason               | Meaning                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `missing-input`      | A source area that feeds the target has no observed value for the period.                |
| `best-fit-straddler` | A best-fit edge puts a whole source area in a target that holds only part of it.         |
| `no-weight`          | An edge on the route has no weight on the basis.                                         |
| `unmeasured-split`   | The value was split and the split is not one the backtest has measured for this measure. |
| `not-carried`        | Recorded against a source area: no crosswalk on the route carries it anywhere.           |
| `no-denominator`     | A rebuilt ratio whose converted denominator is not above zero.                           |

Only observed values are converted. A source value that is suppressed, flagged
or itself estimated is treated as missing, so the source's status flags never
need to be carried.

### Rules by measure

`pipeline/src/conversion/rules.ts` decides the rule from the measure table and
nothing else, and the result is stored in `measure_conversion`.

- **sum**: an additive count or amount. Parts are added.
- **rebuild**: a ratio whose numerator and denominator measures are named. Each
  is converted and the ratio is taken again. A ratio is never averaged.
- **refuse**: nothing defensible can be done with what is held. The reason is
  stored.

A `sum` measure also names the one weight basis a split of it has been
backtested on, or none. Only `population` on the `population` basis has one.

### The backtest

Each case converts a published series onto areas where the same quantity is
also published, and compares. Error is the absolute difference as a share of the
published value. A value is exact when it matches to within rounding. Cases are
declared in `pipeline/src/conversion/backtestCases.ts`.

### Bounds

For each splitting method and weight basis, the backtest takes every split value
and divides its absolute error by its amount at risk. The largest ratio seen,
rounded up to two decimal places, is the method's error factor. A converted
value's bounds are its value plus and minus the factor times its own amount at
risk. A method and basis with no factor has no bounds, and a value split that
way is refused.

### What is stored

| Table                                                                                                                       | Holds                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `series`                                                                                                                    | The converted series: `method = 'converted'`, `derived_from_id` set.            |
| `series_input`                                                                                                              | Every input series and its role (value, numerator, denominator).                |
| `series_conversion`                                                                                                         | The rule, the weight basis, whether every value is an exact regrouping, a note. |
| `series_crosswalk`                                                                                                          | The crosswalks of the route, in order, and their direction.                     |
| `series_gap`                                                                                                                | Each area and period with no value, and why.                                    |
| `measure_conversion`                                                                                                        | The rule of every measure, and the reason for a refusal.                        |
| `conversion_backtest`, `conversion_backtest_gap`, `conversion_backtest_worst`, `conversion_error`, `conversion_error_check` | The backtest results below.                                                     |

A regrouped value has status `derived` and no bounds. A split value has status
`estimated` and both bounds. No converted value has status `observed`: the copy
into the atlas fails if one does. In the built atlas, the 318 converted series
hold 1,216,154 derived values, none with bounds, 566 estimated values, all with
bounds, and no observed value. The 1,643 published series are unchanged, with
9,234,255 observed values.

Every query in the codebase that reads `series` names the method it wants, and a
test fails on one that does not
(`pipeline/tests/seriesReadersNamePublished.test.ts`). No reader that existed
before this work returns a converted value.

## Backtest results

### The noise floor

The census cases measure how far a sum of published parts sits from the
published whole when no boundary has changed and no weight is used. This is the
floor: no conversion of census counts can do better.

| Case                                  | Basis      | Values    | Series | Periods | Compared | Exact  | Median error | p95 error | Max error | Max absolute |
| ------------------------------------- | ---------- | --------- | ------ | ------- | -------- | ------ | ------------ | --------- | --------- | ------------ |
| noise-census-2021-ts001               | population | regrouped | 3      | 1       | 21,792   | 67.6%  | 0.000%       | 1.250%    | 100.00%   | 8            |
| noise-census-2021-ts003               | population | regrouped | 15     | 1       | 108,960  | 46.1%  | 0.119%       | 4.762%    | 150.00%   | 23           |
| noise-census-2021-ts007a              | population | regrouped | 18     | 1       | 130,752  | 48.9%  | 0.117%       | 0.847%    | 13.64%    | 9            |
| noise-census-2021-ts021               | population | regrouped | 19     | 1       | 138,016  | 60.7%  | 0.000%       | 10.526%   | 400.00%   | 8            |
| noise-census-2021-ts037               | population | regrouped | 6      | 1       | 43,584   | 50.1%  | 0.000%       | 1.379%    | 13.89%    | 12           |
| noise-census-2021-ts054               | population | regrouped | 9      | 1       | 65,376   | 49.1%  | 0.036%       | 7.843%    | 400.00%   | 15           |
| noise-census-2021-ts066               | population | regrouped | 10     | 1       | 72,640   | 40.9%  | 0.056%       | 2.632%    | 37.50%    | 22           |
| regroup-census-lsoa-la-2023           | population | regrouped | 19     | 1       | 6,042    | 13.4%  | 0.281%       | 2.617%    | 13.33%    | 32           |
| regroup-census-lsoa-msoa-la-2023      | population | regrouped | 19     | 1       | 6,042    | 13.4%  | 0.281%       | 2.617%    | 13.33%    | 32           |
| regroup-census-lsoa-la-2026           | population | regrouped | 19     | 1       | 5,966    | 13.4%  | 0.279%       | 2.609%    | 13.33%    | 32           |
| regroup-la-2021-2023-ethnicity        | population | regrouped | 19     | 1       | 76       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| regroup-la-2021-2023-car-availability | population | regrouped | 5      | 1       | 20       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| regroup-la-2021-2023-qualification    | population | regrouped | 8      | 1       | 32       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| regroup-la-2021-2023-travel-to-work   | population | regrouped | 9      | 1       | 36       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |

The `noise-` cases add LSOA counts to MSOAs. The large percentage errors are on
very small cells (largest absolute difference 23). Regrouping authorities from
2021 to 2023 is exact, because it adds published authority counts.

### Exact regroupings

| Case                              | Basis      | Values    | Series | Periods | Compared | Exact  | Median error | p95 error | Max error | Max absolute |
| --------------------------------- | ---------- | --------- | ------ | ------- | -------- | ------ | ------------ | --------- | --------- | ------------ |
| regroup-ward-la-2023              | population | regrouped | 273    | 1       | 86,268   | 11.7%  | 0.295%       | 1.607%    | 16.47%    | 728          |
| regroup-ward-la-2026              | population | regrouped | 273    | 1       | 84,903   | 11.7%  | 0.296%       | 1.609%    | 16.47%    | 728          |
| regroup-la-2022-2024-claimants    | population | regrouped | 2      | 1       | 8        | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| regroup-la-2019-2024-unemployment | population | regrouped | 1      | 26      | 88       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| regroup-lsoa-la-2024-collisions   | population | regrouped | 4      | 1       | 4        | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |

The ward cases do not show a conversion error. Ward and authority population
estimates are separate publications, and wards added up do not equal the
authority figure for single years of age (largest 16.47%, Runnymede, women aged
24, 416 against 498). The atlas does not convert ward population to authorities
for this reason: the published authority series is used instead. The three
administrative cases are exact on every value.

### Estimated splits and chains

| Case                              | Basis      | Values    | Series | Periods | Compared | Exact  | Median error | p95 error | Max error | Max absolute |
| --------------------------------- | ---------- | --------- | ------ | ------- | -------- | ------ | ------------ | --------- | --------- | ------------ |
| split-ward-constituency-overlap   | population | regrouped | 1      | 1       | 276      | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-ward-constituency-overlap   | population | split     | 1      | 1       | 297      | 17.2%  | 0.083%       | 0.539%    | 1.34%     | 1,475        |
| split-ward-constituency-overlap   | households | regrouped | 1      | 1       | 276      | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-ward-constituency-overlap   | households | split     | 1      | 1       | 297      | 16.8%  | 0.101%       | 0.636%    | 2.43%     | 2,733        |
| split-ward-constituency-overlap   | dwellings  | regrouped | 1      | 1       | 276      | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-ward-constituency-overlap   | dwellings  | split     | 1      | 1       | 297      | 17.5%  | 0.123%       | 0.803%    | 2.75%     | 2,877        |
| split-ward-constituency-overlap   | postcodes  | regrouped | 1      | 1       | 276      | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-ward-constituency-overlap   | postcodes  | split     | 1      | 1       | 297      | 16.8%  | 0.281%       | 1.719%    | 6.15%     | 6,443        |
| split-ward-constituency-best-fit  | population | regrouped | 1      | 1       | 403      | 84.1%  | 0.000%       | 5.896%    | 13.82%    | 13,808       |
| split-constituency-la             | population | regrouped | 1      | 1       | 32       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-constituency-la             | population | split     | 1      | 1       | 286      | 0.0%   | 0.171%       | 1.051%    | 10.03%    | 4,401        |
| split-constituency-la             | households | regrouped | 1      | 1       | 32       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-constituency-la             | households | split     | 1      | 1       | 286      | 0.0%   | 0.494%       | 2.521%    | 15.94%    | 8,918        |
| split-constituency-la             | dwellings  | regrouped | 1      | 1       | 32       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-constituency-la             | dwellings  | split     | 1      | 1       | 286      | 0.0%   | 0.631%       | 2.746%    | 22.23%    | 7,010        |
| split-constituency-la             | postcodes  | regrouped | 1      | 1       | 32       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| split-constituency-la             | postcodes  | split     | 1      | 1       | 286      | 0.0%   | 2.242%       | 10.107%   | 55.17%    | 21,012       |
| split-constituency-la-2022        | population | regrouped | 1      | 1       | 32       | 0.0%   | 0.084%       | 0.488%    | 1.19%     | 4,166        |
| split-constituency-la-2022        | population | split     | 1      | 1       | 286      | 0.0%   | 0.298%       | 1.209%    | 20.79%    | 4,975        |
| chain-ward-constituency-la        | population | regrouped | 273    | 1       | 6,552    | 14.5%  | 0.302%       | 1.584%    | 10.00%    | 424          |
| chain-ward-constituency-la        | population | split     | 273    | 1       | 79,170   | 1.7%   | 1.850%       | 9.850%    | 207.64%   | 1,718        |
| chain-ward-constituency-2019-2024 | population | regrouped | 1      | 1       | 37       | 100.0% | 0.000%       | 0.000%    | 0.00%     | 0            |
| chain-ward-constituency-2019-2024 | population | split     | 1      | 1       | 516      | 1.0%   | 0.165%       | 0.910%    | 2.39%     | 3,198        |

Reading the table:

- **Wards to constituencies, postcode-overlap.** The 276 constituencies made of
  whole wards are exact on every basis. The 297 split ones are best on
  residents, then households, dwellings and postcodes.
- **Wards to constituencies, best-fit.** The lookup crosswalk calls 403
  constituencies regrouped and gets 84.1% exact, with errors up to 13.82%
  (Chesham and Amersham) on the rest. It refuses 170 as straddlers. A best-fit
  crosswalk is never used to convert.
- **Constituencies to local authorities.** On the census year the weights were
  taken in, median 0.171%. A year later, held out, median 0.298%. The largest
  errors are the two smallest authorities, Isles of Scilly and City of London.
- **Chain of two splits, by age and sex.** Median 1.85%, 95th percentile 9.85%,
  largest 207.64% (Vale of Glamorgan, women aged 20, 1,276.7 against 415). A
  share of all residents does not say where the students are. This is why a
  breakdown is never split.
- **Chain through 2019 constituencies.** Held out from the fit: median 0.165%,
  largest 2.39% (Brent East).

### Published truths with no converted value

| Case                              | Basis      | Areas by reason                              |
| --------------------------------- | ---------- | -------------------------------------------- |
| regroup-census-lsoa-la-2026       | population | best-fit-straddler 19                        |
| regroup-ward-la-2023              | population | missing-input 12,285                         |
| regroup-ward-la-2026              | population | best-fit-straddler 546, missing-input 12,285 |
| regroup-la-2022-2024-claimants    | population | missing-input 714                            |
| regroup-la-2019-2024-unemployment | population | missing-input 8,764                          |
| regroup-lsoa-la-2024-collisions   | population | missing-input 1,396                          |
| split-ward-constituency-overlap   | population | missing-input 2                              |
| split-ward-constituency-overlap   | households | missing-input 2                              |
| split-ward-constituency-overlap   | dwellings  | missing-input 2                              |
| split-ward-constituency-overlap   | postcodes  | missing-input 2                              |
| split-ward-constituency-best-fit  | population | best-fit-straddler 170, missing-input 2      |
| split-constituency-la             | population | missing-input 43                             |
| split-constituency-la             | households | missing-input 43                             |
| split-constituency-la             | dwellings  | missing-input 43                             |
| split-constituency-la             | postcodes  | missing-input 43                             |
| split-constituency-la-2022        | population | missing-input 43                             |
| chain-ward-constituency-la        | population | missing-input 12,831                         |
| chain-ward-constituency-2019-2024 | population | no-weight 14, missing-input 8                |

Most `missing-input` gaps are areas outside the source's coverage. Ward
population is England and Wales only, so the 43 authorities missing from the
constituency cases are those of Scotland and Northern Ireland.

### Error factors

| Method             | Basis      | Measured on      | Fitted on                       | Split values | Median factor | p95 factor | Max factor | Factor used | Pruned only | Pruned only exact |
| ------------------ | ---------- | ---------------- | ------------------------------- | ------------ | ------------- | ---------- | ---------- | ----------- | ----------- | ----------------- |
| postcode-overlap   | population | total population | split-ward-constituency-overlap | 247          | 0.054         | 1.009      | 1.030      | 1.03        | 50          | 50                |
| postcode-overlap   | households | total population | split-ward-constituency-overlap | 247          | 0.085         | 1.009      | 5.999      | 6.00        | 50          | 50                |
| postcode-overlap   | dwellings  | total population | split-ward-constituency-overlap | 247          | 0.091         | 1.009      | 4.284      | 4.29        | 50          | 50                |
| postcode-overlap   | postcodes  | total population | split-ward-constituency-overlap | 247          | 0.217         | 1.012      | 1.166      | 1.17        | 50          | 50                |
| population-overlap | population | total population | split-constituency-la           | 286          | 0.010         | 0.058      | 0.364      | 0.37        | 0           | 0                 |
| population-overlap | households | total population | split-constituency-la           | 286          | 0.032         | 0.130      | 0.353      | 0.36        | 0           | 0                 |
| population-overlap | dwellings  | total population | split-constituency-la           | 286          | 0.039         | 0.161      | 0.373      | 0.38        | 0           | 0                 |
| population-overlap | postcodes  | total population | split-constituency-la           | 286          | 0.141         | 0.433      | 1.081      | 1.09        | 0           | 0                 |

"Pruned only" counts values carried whole from a ward whose dropped pairs put a
little of it elsewhere. All 50 matched the published figure, so pruning under
1% is not treated as a split.

### Do the bounds hold the truth

| Case                              | Basis      | Factor of          | Factor | Held out | Values | Truth within bounds | Median error | Median half width | p95 half width |
| --------------------------------- | ---------- | ------------------ | ------ | -------- | ------ | ------------------- | ------------ | ----------------- | -------------- |
| split-ward-constituency-overlap   | population | postcode-overlap   | 1.03   | no       | 297    | 297 (100.0%)        | 0.083%       | 1.82%             | 6.97%          |
| chain-ward-constituency-2019-2024 | population | postcode-overlap   | 1.03   | yes      | 516    | 516 (100.0%)        | 0.165%       | 23.69%            | 66.13%         |
| split-ward-constituency-overlap   | households | postcode-overlap   | 6.00   | no       | 297    | 297 (100.0%)        | 0.101%       | 10.41%            | 40.59%         |
| split-ward-constituency-overlap   | dwellings  | postcode-overlap   | 4.29   | no       | 297    | 297 (100.0%)        | 0.123%       | 7.43%             | 29.27%         |
| split-ward-constituency-overlap   | postcodes  | postcode-overlap   | 1.17   | no       | 297    | 297 (100.0%)        | 0.281%       | 2.23%             | 7.84%          |
| split-constituency-la             | population | population-overlap | 0.37   | no       | 286    | 286 (100.0%)        | 0.171%       | 5.94%             | 18.25%         |
| split-constituency-la-2022        | population | population-overlap | 0.37   | yes      | 286    | 285 (99.7%)         | 0.298%       | 5.92%             | 18.23%         |
| split-constituency-la             | households | population-overlap | 0.36   | no       | 286    | 286 (100.0%)        | 0.494%       | 5.73%             | 17.78%         |
| split-constituency-la             | dwellings  | population-overlap | 0.38   | no       | 286    | 286 (100.0%)        | 0.631%       | 6.08%             | 18.91%         |
| split-constituency-la             | postcodes  | population-overlap | 1.09   | no       | 286    | 286 (100.0%)        | 2.242%       | 17.57%            | 55.88%         |

The one miss is in the held-out 2022 case. The stored tables do not name it. The
worst value of that case is City of London (9,200.4 against 11,615, 20.79%),
which is the likely one. This is not verified.

### Worst cases

The three worst values of each case and basis.

| Case                              | Basis      | Values    | Area                                         | Series and period       | Converted | Published | Error   |
| --------------------------------- | ---------- | --------- | -------------------------------------------- | ----------------------- | --------- | --------- | ------- |
| regroup-ward-la-2023              | population | regrouped | Runnymede (E07000212)                        | age=24/sex=female, 2022 | 416.0     | 498       | 16.47%  |
| regroup-ward-la-2023              | population | regrouped | Lancaster (E07000121)                        | age=24/sex=male, 2022   | 717.0     | 827       | 13.30%  |
| regroup-ward-la-2023              | population | regrouped | Oxford (E07000178)                           | age=16/sex=female, 2022 | 868.0     | 989       | 12.23%  |
| regroup-ward-la-2026              | population | regrouped | Runnymede (E07000212)                        | age=24/sex=female, 2022 | 416.0     | 498       | 16.47%  |
| regroup-ward-la-2026              | population | regrouped | Oxford (E07000178)                           | age=16/sex=female, 2022 | 868.0     | 989       | 12.23%  |
| regroup-ward-la-2026              | population | regrouped | Runnymede (E07000212)                        | age=24/sex=all, 2022    | 885.0     | 1,005     | 11.94%  |
| split-ward-constituency-overlap   | population | split     | Birmingham Selly Oak (E14001099)             | all ages, 2022          | 111,349.1 | 109,874   | 1.34%   |
| split-ward-constituency-overlap   | population | split     | Liverpool Wavertree (E14001340)              | all ages, 2022          | 106,438.1 | 105,388   | 1.00%   |
| split-ward-constituency-overlap   | population | split     | Reading Central (E14001438)                  | all ages, 2022          | 117,980.3 | 116,859   | 0.96%   |
| split-ward-constituency-overlap   | households | split     | Earley and Woodley (E14001210)               | all ages, 2022          | 104,826.9 | 107,434   | 2.43%   |
| split-ward-constituency-overlap   | households | split     | Reading Central (E14001438)                  | all ages, 2022          | 119,591.8 | 116,859   | 2.34%   |
| split-ward-constituency-overlap   | households | split     | Brighton Kemptown and Peacehaven (E14001129) | all ages, 2022          | 97,221.7  | 96,034    | 1.24%   |
| split-ward-constituency-overlap   | dwellings  | split     | Rochester and Strood (E14001447)             | all ages, 2022          | 107,688.5 | 104,811   | 2.75%   |
| split-ward-constituency-overlap   | dwellings  | split     | Chatham and Aylesford (E14001157)            | all ages, 2022          | 104,012.8 | 106,459   | 2.30%   |
| split-ward-constituency-overlap   | dwellings  | split     | Earley and Woodley (E14001210)               | all ages, 2022          | 104,976.4 | 107,434   | 2.29%   |
| split-ward-constituency-overlap   | postcodes  | split     | Rochester and Strood (E14001447)             | all ages, 2022          | 111,254.5 | 104,811   | 6.15%   |
| split-ward-constituency-overlap   | postcodes  | split     | Chatham and Aylesford (E14001157)            | all ages, 2022          | 101,286.5 | 106,459   | 4.86%   |
| split-ward-constituency-overlap   | postcodes  | split     | Bracknell (E14001117)                        | all ages, 2022          | 99,725.7  | 102,980   | 3.16%   |
| split-ward-constituency-best-fit  | population | regrouped | Chesham and Amersham (E14001162)             | all ages, 2022          | 86,096.0  | 99,904    | 13.82%  |
| split-ward-constituency-best-fit  | population | regrouped | Wetherby and Easingwold (E14001582)          | all ages, 2022          | 80,506.0  | 92,325    | 12.80%  |
| split-ward-constituency-best-fit  | population | regrouped | Wellingborough and Rushden (E14001571)       | all ages, 2022          | 100,434.0 | 113,555   | 11.55%  |
| split-constituency-la             | population | split     | Isles of Scilly (E06000053)                  | all ages, 2021          | 2,043.2   | 2,271     | 10.03%  |
| split-constituency-la             | population | split     | Halton (E06000006)                           | all ages, 2021          | 124,169.2 | 128,570   | 3.42%   |
| split-constituency-la             | population | split     | Hertsmere (E07000098)                        | all ages, 2021          | 106,005.4 | 108,129   | 1.96%   |
| split-constituency-la             | households | split     | City of London (E09000001)                   | all ages, 2021          | 10,074.3  | 8,689     | 15.94%  |
| split-constituency-la             | households | split     | Isles of Scilly (E06000053)                  | all ages, 2021          | 2,075.6   | 2,271     | 8.61%   |
| split-constituency-la             | households | split     | Vale of White Horse (E07000180)              | all ages, 2021          | 148,317.9 | 139,400   | 6.40%   |
| split-constituency-la             | dwellings  | split     | City of London (E09000001)                   | all ages, 2021          | 10,620.9  | 8,689     | 22.23%  |
| split-constituency-la             | dwellings  | split     | South Hams (E07000044)                       | all ages, 2021          | 94,536.0  | 89,161    | 6.03%   |
| split-constituency-la             | dwellings  | split     | Oadby and Wigston (E07000135)                | all ages, 2021          | 54,745.5  | 57,788    | 5.26%   |
| split-constituency-la             | postcodes  | split     | City of London (E09000001)                   | all ages, 2021          | 13,483.1  | 8,689     | 55.17%  |
| split-constituency-la             | postcodes  | split     | South Hams (E07000044)                       | all ages, 2021          | 110,172.9 | 89,161    | 23.57%  |
| split-constituency-la             | postcodes  | split     | Isles of Scilly (E06000053)                  | all ages, 2021          | 1,823.8   | 2,271     | 19.69%  |
| split-constituency-la-2022        | population | regrouped | Coventry (E08000026)                         | all ages, 2022          | 355,600.0 | 351,434   | 1.19%   |
| split-constituency-la-2022        | population | regrouped | Portsmouth (E06000044)                       | all ages, 2022          | 208,420.0 | 209,599   | 0.56%   |
| split-constituency-la-2022        | population | regrouped | Wandsworth (E09000032)                       | all ages, 2022          | 329,035.0 | 330,447   | 0.43%   |
| split-constituency-la-2022        | population | split     | City of London (E09000001)                   | all ages, 2022          | 9,200.4   | 11,615    | 20.79%  |
| split-constituency-la-2022        | population | split     | Isles of Scilly (E06000053)                  | all ages, 2022          | 2,047.6   | 2,340     | 12.50%  |
| split-constituency-la-2022        | population | split     | Halton (E06000006)                           | all ages, 2022          | 124,605.3 | 129,449   | 3.74%   |
| chain-ward-constituency-la        | population | regrouped | Coventry (E08000026)                         | age=24/sex=male, 2022   | 3,233.0   | 2,939     | 10.00%  |
| chain-ward-constituency-la        | population | regrouped | Coventry (E08000026)                         | age=23/sex=male, 2022   | 3,462.0   | 3,172     | 9.14%   |
| chain-ward-constituency-la        | population | regrouped | Coventry (E08000026)                         | age=25/sex=male, 2022   | 3,085.0   | 2,827     | 9.13%   |
| chain-ward-constituency-la        | population | split     | Vale of Glamorgan (W06000014)                | age=20/sex=female, 2022 | 1,276.7   | 415       | 207.64% |
| chain-ward-constituency-la        | population | split     | Vale of White Horse (E07000180)              | age=20/sex=female, 2022 | 1,286.9   | 423       | 204.23% |
| chain-ward-constituency-la        | population | split     | Vale of White Horse (E07000180)              | age=19/sex=female, 2022 | 1,361.1   | 463       | 193.98% |
| chain-ward-constituency-2019-2024 | population | split     | Brent East (E14001122)                       | all ages, 2022          | 136,906.1 | 133,708   | 2.39%   |
| chain-ward-constituency-2019-2024 | population | split     | Worsley and Eccles (E14001598)               | all ages, 2022          | 110,171.7 | 107,900   | 2.11%   |
| chain-ward-constituency-2019-2024 | population | split     | Brent West (E14001123)                       | all ages, 2022          | 134,012.4 | 136,768   | 2.01%   |

## What the atlas converts

| Series                                            | From                             | Onto                          | Series | Periods | Regrouped values | Estimated values | Gaps                                       |
| ------------------------------------------------- | -------------------------------- | ----------------------------- | ------ | ------- | ---------------- | ---------------- | ------------------------------------------ |
| population-uk / population                        | localAuthority:2023-12-uk-bgc    | localAuthority:2026-05-uk-bgc | 91     | 14      | 456,092          | 0                | not-carried 3,822                          |
| jobs / total-jobs                                 | localAuthority:2023-12-uk-bgc    | localAuthority:2026-05-uk-bgc | 1      | 14      | 4,891            | 0                | not-carried 42                             |
| ghg-emissions / ghg-emissions                     | localAuthority:2025-05-uk-bgc-v2 | localAuthority:2026-05-uk-bgc | 10     | 20      | 71,600           | 0                | not-carried 600                            |
| ghg-emissions / ghg-population                    | localAuthority:2025-05-uk-bgc-v2 | localAuthority:2026-05-uk-bgc | 1      | 20      | 7,160            | 0                | not-carried 60                             |
| electricity-consumption / electricity-consumption | localAuthority:2025-05-uk-bgc-v2 | localAuthority:2026-05-uk-bgc | 3      | 10      | 10,410           | 0                | not-carried 90                             |
| electricity-consumption / electricity-meters      | localAuthority:2025-05-uk-bgc-v2 | localAuthority:2026-05-uk-bgc | 1      | 10      | 3,470            | 0                | not-carried 30                             |
| gas-consumption / gas-consumption                 | localAuthority:2025-05-uk-bgc-v2 | localAuthority:2026-05-uk-bgc | 3      | 10      | 10,401           | 0                | not-carried 90                             |
| gas-consumption / gas-meters                      | localAuthority:2025-05-uk-bgc-v2 | localAuthority:2026-05-uk-bgc | 1      | 10      | 3,467            | 0                | not-carried 30                             |
| unemployment / unemployed-people                  | localAuthority:2024-05-uk-bgc    | localAuthority:2026-05-uk-bgc | 1      | 26      | 8,774            | 0                | not-carried 78                             |
| child-poverty / children-in-relative-low-income   | localAuthority:2024-05-uk-bgc    | localAuthority:2026-05-uk-bgc | 1      | 4       | 1,432            | 0                | not-carried 12                             |
| school-performance / key-stage-4-pupils           | localAuthority:2024-05-uk-bgc    | localAuthority:2026-05-uk-bgc | 1      | 7       | 2,033            | 0                | not-carried 13                             |
| census-2021-ts001 / usual-residents               | lsoa:2021-12-ew-bgc-v5           | localAuthority:2026-05-uk-bgc | 3      | 1       | 945              | 0                | not-carried 9                              |
| census-2021-ts003 / households                    | lsoa:2021-12-ew-bgc-v5           | localAuthority:2026-05-uk-bgc | 15     | 1       | 4,725            | 0                | not-carried 45                             |
| fuel-poverty / fuel-poor-households               | lsoa:2021-12-ew-bgc-v5           | localAuthority:2026-05-uk-bgc | 1      | 1       | 293              | 0                | not-carried 3                              |
| fuel-poverty / households                         | lsoa:2021-12-ew-bgc-v5           | localAuthority:2026-05-uk-bgc | 1      | 1       | 293              | 0                | not-carried 3                              |
| fuel-poverty / fuel-poverty-rate                  | lsoa:2021-12-ew-bgc-v5           | localAuthority:2026-05-uk-bgc | 1      | 1       | 293              | 0                | not-carried 3                              |
| population / population                           | ward:2023-12-uk-bgc              | constituency:2024-07-uk-bgc   | 91     | 1       | 25,116           | 0                | missing-input 182, unmeasured-split 27,027 |
| population / population                           | ward:2023-12-uk-bgc              | ward:2026-05-uk-bgc           | 91     | 1       | 604,695          | 0                | not-carried 87,633                         |
| population-constituency / population              | constituency:2024-07-uk-bgc      | localAuthority:2026-05-uk-bgc | 1      | 2       | 64               | 566              | not-carried 6                              |

Every value above is an exact regrouping except the last row.

- **Local authority series onto the 2026 authorities.** Population by age and
  sex, jobs, greenhouse gas emissions and the population beside them,
  electricity and gas consumption and meters, unemployed people, children in
  relative low income, and key stage 4 pupils. Every value is a whole authority carried or added.
- **Census 2021 usual residents and households, LSOA to authority.** Exact
  sums, subject to the noise floor above.
- **Fuel poverty, LSOA to authority.** The two counts are summed and the rate is
  rebuilt from them. The same rebuild on the source LSOAs matched the published
  rate on all 33,755, with a largest difference of 0.0000.
- **Ward population onto 2024 constituencies.** Only constituencies made of
  whole wards have a value: 25,116 values. 27,027 are refused as `unmeasured-split`. All 91 series are single years of age, which are never split. The ward source holds no all ages series, so the total the backtest measured (largest error 1.34%) is not among them.
- **Ward population onto 2026 wards.** Only wards whose boundary has not
  changed.
- **Constituency population onto 2026 authorities.** The one estimated series.
  64 values are regrouped and 566 are estimated with bounds. It is kept to show
  an estimate beside its bounds. The published authority population is the
  better figure wherever it is held.

### Bounds of the estimated values

| Series                                | Estimated values | Median half width | p95 half width | Widest |
| ------------------------------------- | ---------------- | ----------------- | -------------- | ------ |
| population-constituency/population>la | 566              | 5.909%            | 18.302%        | 36.15% |

## What is refused

| Rule    | Measures |
| ------- | -------- |
| sum     | 45       |
| rebuild | 3        |
| refuse  | 48       |

| Refused because                                                                                                                                                    | Measures                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A score, decile or ratio computed by its publisher for the areas it was published on. Its inputs are not held, so it cannot be computed again for other areas.     | 9: social-care-quality-of-life, house-price-to-earnings-ratio, imd-score, imd-decile, imd-domain-score, simd-quintile, simd-decile, wimd-score, wimd-decile                                                                                                                                                                                                                   |
| A weighted mean can only be recombined with the weights it was taken over, and no weight series is linked to the measure.                                          | 12: background-concentration, pm25-population-weighted, pm25-population-weighted-anthropogenic, turnout, broadband-availability, band-d-council-tax, mobile-premises-coverage, mobile-area-coverage, gcse-english-maths-grade-4, gcse-english-maths-grade-5, attainment-8, progress-8                                                                                         |
| A rate or share must be rebuilt from its numerator and denominator, and the measure names neither. Averaging it would weight a small area the same as a large one. | 14: children-in-relative-low-income-rate, claimant-rate, households-in-temporary-accommodation-rate, gross-annual-pay-change, gross-hourly-pay-change, reception-excess-weight, year-6-excess-weight, adult-excess-weight, physically-active-adults, smoking-prevalence, preventable-mortality, gcse-english-maths-grade-4-gap, unemployment-rate, unemployment-rate-interval |
| The measure is declared as not additive (count, aggregation none), and no other method is held for it.                                                             | 2: majority, unemployed-people-interval                                                                                                                                                                                                                                                                                                                                       |
| A category cannot be added or averaged, and the largest part of an area need not decide the whole.                                                                 | 1: source-winning-party                                                                                                                                                                                                                                                                                                                                                       |
| A median of a whole is not a function of the medians of its parts. It needs the distribution underneath, which is not held.                                        | 1: house-price-median                                                                                                                                                                                                                                                                                                                                                         |
| A mean can only be recombined with the counts it was taken over, and none is linked to the measure.                                                                | 3: house-price-mean, life-expectancy, healthy-life-expectancy                                                                                                                                                                                                                                                                                                                 |
| A rank orders the areas of one release against each other. It has no meaning for any other set of areas.                                                           | 4: imd-rank, nimdm-rank, simd-rank, wimd-rank                                                                                                                                                                                                                                                                                                                                 |
| The measure is declared as not additive (amount, aggregation none), and no other method is held for it.                                                            | 2: gross-annual-pay, gross-hourly-pay                                                                                                                                                                                                                                                                                                                                         |

Beyond whole measures, a conversion is refused value by value when:

- the value would be split and the measure is not a total population on the
  residents basis (`unmeasured-split`);
- the series is a breakdown, such as an age or sex group, and would be split;
- a rebuilt ratio would need a split numerator or denominator;
- any source area feeding the target has no observed value;
- the route would need a best-fit edge that straddles.

## Known limits

- **Northern Ireland.** There are no postcodes or small-area counts for
  Northern Ireland in the weights, so nothing there can be split on any basis.
  Only exact regrouping works. No backtest case has a truth in Northern Ireland,
  so nothing here measures a conversion there.
- **Scotland.** The weights hold Scottish residents and households, but every
  split case here has its truth in England and Wales, because ward and
  constituency population are held for England and Wales only. The factors are
  untested on Scottish areas.
- **Scottish dwellings.** There is no dwelling count for Scotland, so the
  `dwellings` basis covers England and Wales only. No converted series uses it.
- **Three authorities are never carried.** The crosswalk
  `local-authority-2025-05-uk-bgc-v2-to-2025-12-uk-bgc-extent-continuity` has no
  edge for Cumberland (E06000063), Westmorland and Furness (E06000064) or
  Lancaster (E07000121), so every authority series loses them on the 2026
  release. Each is recorded as `not-carried` in `series_gap`. The crosswalk has
  not been repaired.
- **963 wards are not carried onto the 2026 wards**, because their boundary
  changed and a ward series by age cannot be split.
- **One fit per method.** Each error factor comes from one case, and is the
  largest error seen in it, not a percentile. One extreme value sets the width
  for every value. The fit and the first check use the same values. Only the
  2019 chain and the 2022 authority case are held out.
- **The bounds are wide.** On the estimated series the median half width is
  5.909% and the widest is 36.15%, against a measured median error of 0.171%.
  On the held-out 2019 chain the median half width is 23.69% against a median
  error of 0.165%.
- **The bounds are not a confidence interval.** They are a largest seen error,
  scaled. One held-out value in 286 fell outside them.
- **The weights are from one moment.** Residents and households are from the
  2021 and 2022 censuses and postcodes from August 2026. The held-out 2022 case
  is one year away. Nothing measures a split of a figure far from 2021.
- **Only a total population has been backtested on a split.** No other
  additive measure (jobs, emissions, energy use, pupils) has a published truth
  on two overlapping sets of areas here, so none is ever split.
- **Units are carried as published.** Some sources are in thousands
  (`ghg-population`, the meter counts). A sum keeps the unit.
- **Fuel poverty is itself modelled** by its publisher, and covers England
  only. The converted series is an exact regrouping of a modelled figure.
- **Size.** The converted series add about 1.2 million observations. The built
  atlas was 704 MB.
- **Not yet through a full build.** The converted series were built and
  assembled onto a base database copied from another checkout. The `v_candidacy`
  view now names the published method, and that change reaches a database only
  when the base is built again.
