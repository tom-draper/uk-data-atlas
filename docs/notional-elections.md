# Notional elections

Estimates of the 2019 general election result on the 2024 Westminster
constituencies, and how close they come to the published notionals (roadmap
task 46, issue #415).

Every number here comes from one run of
`pipeline/src/stages/build-notional-elections.ts` on 2026-11-17, against the
atlas base built from `main` at `f9b424b65`. The stage is run by hand and is not
in the build graph. It writes `data/build/notional-elections/notional-elections.sqlite`
and the tables below to `data/build/notional-elections/notional-elections.md`.

```sh
cd pipeline
tsx src/stages/build-notional-elections.ts --source <built checkout> --benchmark <candidacies.csv>
```

## Summary

- **The main method beats the baseline.** Mean absolute error in party share per
  seat falls from 0.72 to 0.42 points over all 632 seats in Great Britain, and
  from 0.80 to 0.47 over the 567 seats whose make-up changed. The notional
  winner differs from the benchmark in 7 seats, against 11 for the baseline.
- **England gains most** (0.74 to 0.40). Wales gains less (0.56 to 0.51), since
  15% of its adults live in wards with no usable contest. **Scotland is the
  baseline**: the atlas holds no Scottish local results.
- **Northern Ireland is excluded.** The weight atoms do not cover it, and the
  benchmark has no Northern Ireland seats to score against.

## Benchmark

The 2019 notionals on the 2024 boundaries by Colin Rallings and Michael
Thrasher, with David Denver (Scotland) and Alan Whyte (Northern Ireland),
published by the House of Commons Library as the candidacies file of general
election 5 at `electionresults.parliament.uk`. Their sums match the published
valid votes in every seat.

They are third-party estimates, not covered by the Open Parliament Licence that
covers Parliament's own data. They are used only to score against: read from a
local file passed with `--benchmark`, never committed, stored or shipped. The
build output keeps per-seat errors and benchmark winners for diagnosis, so it
must not be published either.

Parties are folded to con, lab, ld, snp, pc, green, brx and other, by the
file's main party abbreviation. The Speaker, independents and all smaller
parties count as other.

## Method

The weight atoms (postcodes, each holding a share of the 2021 census
population) are grouped into pieces: one local election contest, within one
2019 seat, within one 2024 seat. There are 9,218 pieces in Great Britain.

**Baseline.** Each 2019 seat's votes are split between its pieces by residents,
the same within every piece.

**Main method.** Within each 2019 seat, a party's vote in a piece is taken as
proportional to its adults times the party's relative strength there:

1. **Local results.** Each atom takes the ward contest nearest in time to
   12 December 2019 that covers it, up to the end of 2023. A contest is usable
   if it has votes, at least two of Conservative, Labour, Liberal Democrat,
   Green and Plaid Cymru stood, and they took at least half the vote. Each
   party's local vote in a year is scaled to its 2019 general election vote in
   England and Wales, so contests from different years are comparable. A
   piece's strength is its scaled local share over the average of the seat's
   pieces that have one. UKIP's local share stands in for the Brexit Party.
2. **Census model, where local results are missing.** For Conservative,
   Labour, Liberal Democrat and Green, a weighted regression across all seats of
   log local share, relative to the seat average, on how far a piece's census
   2021 profile is from the seat average (age, ethnicity, tenure, students,
   retired, unemployed, long-term sick, bad health). It fills in pieces whose
   contest was unusable or where the party did not stand. Within-seat R² is
   0.37 (Con), 0.43 (Lab), 0.07 (LD) and 0.08 (Green). Plaid Cymru and the
   Brexit Party scored worse with the model, so they fall back to the seat
   average.
3. **Seat average,** where neither applies.
4. **Raking.** The pieces are raked so each party sums exactly to its actual
   vote in the 2019 seat, and each piece's total vote follows its adults
   (50 iterations, then a final party fit).
5. The pieces are summed into the 2024 seats.

Pieces without a usable contest are flagged in `notional_piece` with the 2019
ward, the reason (`no local results held`, `contest unusable`,
`no contest placed`) and the parties the model or the seat average filled in.

Where local results come from, by adults covered:

| Source                           | Adults (m) |
| -------------------------------- | ---------- |
| 2019 local elections             | 28.36      |
| 2018                             | 8.28       |
| 2021                             | 5.36       |
| 2022                             | 2.08       |
| 2023                             | 1.16       |
| 2017                             | 0.34       |
| 2016                             | 0.06       |
| No local results held (Scotland) | 4.32       |
| Contest unusable                 | 1.56       |
| No contest placed                | 0.01       |

## Accuracy

Mean absolute error in party share per seat, in percentage points, over the
parties standing in either set. "Changed seats" are the 567 that are not one or
more whole 2019 seats. The rows add each part of the main method in turn.

| Method                                       | MAE, all seats | MAE, changed seats | Winners differ |
| -------------------------------------------- | -------------- | ------------------ | -------------- |
| Baseline: residents, uniform within old seat | 0.72           | 0.80               | 11             |
| Local results, seat average where missing    | 0.43           | 0.48               | 6              |
| Plus UKIP for the Brexit Party               | 0.43           | 0.48               | 6              |
| Plus census model and adult raking (main)    | 0.42           | 0.47               | 7              |

By nation (seats):

| Method             | England (543) | Wales (32) | Scotland (57) |
| ------------------ | ------------- | ---------- | ------------- |
| Baseline           | 0.74          | 0.56       | 0.57          |
| Local results only | 0.41          | 0.52       | 0.57          |
| Plus UKIP          | 0.41          | 0.52       | 0.57          |
| Main               | 0.40          | 0.51       | 0.57          |

By party, mean absolute error (mean signed error):

| Method             | con          | lab          | ld           | snp          | pc           | green        | brx          | other        |
| ------------------ | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ |
| Baseline           | 1.35 (+0.07) | 1.33 (-0.09) | 0.70 (+0.03) | 0.86 (-0.03) | 0.45 (+0.05) | 0.21 (+0.00) | 0.17 (-0.02) | 0.18 (+0.01) |
| Local results only | 0.74 (+0.05) | 0.70 (-0.08) | 0.43 (+0.03) | 0.86 (-0.03) | 0.47 (+0.06) | 0.15 (+0.00) | 0.17 (-0.02) | 0.18 (+0.01) |
| Plus UKIP          | 0.74 (+0.05) | 0.70 (-0.08) | 0.43 (+0.03) | 0.86 (-0.03) | 0.47 (+0.06) | 0.15 (+0.00) | 0.15 (-0.02) | 0.18 (+0.01) |
| Main               | 0.73 (+0.07) | 0.68 (-0.09) | 0.41 (+0.03) | 0.86 (-0.03) | 0.46 (+0.05) | 0.15 (+0.00) | 0.15 (-0.02) | 0.18 (+0.01) |

Of the 7 seats where the main method's winner differs from the benchmark, 4
are within 1,000 votes in the estimate. The local-only variant gets one more
winner right but is worse on share error.

A census model of seat-level shares (fitted across seats rather than within
them) was also tried and made things worse: 0.46 overall and 0.69 in Wales, as
it overrode local evidence with a national pattern. It was dropped.

### Worst 20 seats

Main method. "From" lists the 2019 seats it draws on; the last column is where
the votes from split seats were placed.

| Seat                                 | MAE  | Largest error | Winner             | From                                                                                                                | Local, model, uniform |
| ------------------------------------ | ---- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Wakefield and Rothwell               | 2.92 | con 7.46      | lab, benchmark con | Morley and Outwood, Elmet and Rothwell, Wakefield                                                                   | 96%, 1%, 2%           |
| Ossett and Denby Dale                | 2.73 | con 7.51      | con                | Hemsworth, Colne Valley, Dewsbury, Wakefield                                                                        | 91%, 0%, 8%           |
| Alloa and Grangemouth                | 2.50 | con 7.69      | snp                | Linlithgow and East Falkirk, Falkirk, Ochil and South Perthshire                                                    | 0%, 0%, 100%          |
| Kingswinford and South Staffordshire | 2.41 | lab 4.60      | con                | Dudley South, South Staffordshire                                                                                   | 91%, 9%, 0%           |
| Gordon and Buchan                    | 2.41 | con 3.12      | con                | Gordon, Banff and Buchan                                                                                            | 0%, 0%, 100%          |
| Leeds North West                     | 2.17 | con 5.76      | con                | Pudsey, Leeds North West, Leeds North East                                                                          | 99%, 0%, 1%           |
| Wetherby and Easingwold              | 2.11 | lab 5.38      | con                | Skipton and Ripon, Thirsk and Malton, Selby and Ainsty, Harrogate and Knaresborough, Leeds East, Elmet and Rothwell | 91%, 7%, 2%           |
| Spen Valley                          | 2.07 | lab 6.09      | con                | Batley and Spen, Huddersfield, Dewsbury                                                                             | 87%, 0%, 13%          |
| Wirral West                          | 2.06 | lab 5.00      | con, benchmark lab | Wirral South, Wirral West                                                                                           | 97%, 1%, 2%           |
| Selby                                | 1.98 | con 4.84      | con                | Selby and Ainsty, Elmet and Rothwell                                                                                | 82%, 14%, 3%          |
| Bicester and Woodstock               | 1.91 | ld 4.67       | con                | Witney, Henley, Banbury, Oxford West and Abingdon                                                                   | 91%, 9%, 0%           |
| Dewsbury and Batley                  | 1.87 | lab 5.43      | lab                | Batley and Spen, Huddersfield, Dewsbury                                                                             | 92%, 0%, 8%           |
| Leeds Central and Headingley         | 1.77 | lab 4.67      | lab                | Leeds Central, Leeds West, Leeds North West                                                                         | 98%, 0%, 2%           |
| Perth and Kinross-shire              | 1.72 | snp 3.76      | snp                | Perth and North Perthshire, Ochil and South Perthshire                                                              | 0%, 0%, 100%          |
| East Grinstead and Uckfield          | 1.71 | con 3.61      | con                | Lewes, Wealden, Mid Sussex, Horsham                                                                                 | 81%, 19%, 0%          |
| Isle of Wight West                   | 1.68 | lab 3.15      | con                | Isle of Wight                                                                                                       | 67%, 29%, 4%          |
| Aberdeen North                       | 1.68 | con 3.76      | snp                | Aberdeen North, Aberdeen South, Gordon                                                                              | 0%, 0%, 100%          |
| Melton and Syston                    | 1.68 | ld 2.92       | con                | Loughborough, Charnwood, Rutland and Melton                                                                         | 81%, 18%, 1%          |
| Banbury                              | 1.67 | lab 3.20      | con                | Witney, Banbury                                                                                                     | 96%, 4%, 0%           |
| Isle of Wight East                   | 1.66 | lab 3.11      | con                | Isle of Wight                                                                                                       | 87%, 8%, 4%           |

Why:

- **West Yorkshire (8 of the 20).** Local votes there follow local
  candidates, not national parties. Rothwell elects Liberal Democrat
  councillors (3,167 votes in 2018, 2,206 in 2019) and Ossett, Morley and the
  Spen Valley have strong independent and residents' groups. The method reads
  those wards as weak for the Conservatives and moves their vote elsewhere in
  the old seat. Wakefield and Rothwell is the worst case and flips the winner.
- **Scotland (5).** No local results, so each old seat is split uniformly. The
  error is the baseline's.
- **Rural seats in the Midlands and South (Bicester, Banbury, Melton, East
  Grinstead, Kingswinford).** Liberal Democrat and Green local strength is
  patchier than their general election vote, and parts of these seats have
  unusable contests (uncontested or independent wards), so the model or the
  seat average fills in.
- **Isle of Wight.** One old seat split in two, with the nearest contests in
  2021 and many independents, so 29% of the west's at-risk vote comes from the
  model.
- **Wirral West.** Local results place more of the two old seats'
  Conservative vote in the wards that form the new seat than the benchmark
  does, and the winner flips to Conservative.

## Bounds

Every estimate has a lower and an upper bound: the value plus or minus 0.32
times the votes that came from 2019 seats split between new seats
(`at_risk`). Seats made only of whole 2019 seats are `derived` with no
uncertainty (65 seats, all matching the benchmark exactly). The others are
`estimated`. The factor is the 95th percentile of error over at-risk votes for
the main parties in the changed seats: 95% of those estimates fall within their
bounds, 91% within 0.2, and 99% within 1.1. It is fitted on the same benchmark
it is checked against, so its coverage on another boundary change is not
proven.

## Residents, not electors

The weights count census residents in 2021, not electors in December 2019. The
main method rakes each piece to its adults (residents aged 18 and over, from
census table TS007A, with 2 in 5 of the 15 to 19 band), which removes children.
It does not remove adults who cannot vote (most non-British, non-Irish,
non-Commonwealth nationals), and it assumes turnout is the same across a seat.
Both bias the split towards areas with many foreign nationals, students or low
turnout, mostly inner cities. Raking to adults moved the error from 0.428 to
0.418; electorates by ward or polling district would remove the rest of this
bias but are not in the atlas. Scotland has no LSOA census data in the atlas,
so its adults are taken as the England and Wales average share; this only
affects the Scottish split by its size, not its shares.

## Storage

The estimates are a build output for now:
`data/build/notional-elections/notional-elections.sqlite`, with:

- `notional_estimate`: votes per 2024 seat and party for each method, with
  `lower`, `upper`, `status` (`derived` or `estimated`), `at_risk` and the 2019
  seats it draws on.
- `notional_input`: every series key read (general election, local elections by
  date, census tables) and the weights used.
- `notional_piece`: each piece, its local contest or fallback reason, and the
  parties the model or seat average filled in.
- `notional_seat_source`, `notional_score`, `notional_seat_score`: where at-risk
  votes came from, and accuracy against the benchmark.

Proposal for the atlas: store the main estimate as series rows, one per party,
with `method = 'modelled'`, keyed like converted series:
`general-election/party-votes/constituency:2019-12-uk-bgc/party=con~modelled:constituency:2024-07-uk-bgc`,
period `2019-12-12`, `derived_from_id` pointing at the published 2019 series,
observations with status 6 (derived) or 2 (estimated) and lower and upper
bounds as above. The contest tables are the wrong place: they hold real
contests with candidates, and a notional has neither.

This needs a schema change, so it stops here. `series_input` is keyed on
`(series_id, role)` with `role` limited to value, numerator, denominator and
weight, so it cannot name the several inputs (the general election, local
elections from several years, five census tables, the weights). Either
`series_input` gains a free list of inputs per series, or a `modelled` input
role that may repeat. `series_conversion.rule` is limited to `sum` and
`rebuild`, so it also needs a `modelled` rule or the series stays out of that
table.

## Known weak areas

- Places where local and national voting differ: strong local Liberal
  Democrats, independents and residents' groups (West Yorkshire, Isle of
  Wight).
- Scotland: no local results, so no better than the baseline.
- Wales: 15% of adults in wards with no usable contest, and Plaid Cymru is
  slightly worse than the baseline (0.46 against 0.45).
- Local contests from 2021 to 2023 are up to four years from the general
  election.
- The Brexit Party relies on UKIP local votes, which are thin by 2019.

## What would improve it

- Scottish council results (STV first preferences by ward, 2017 and 2022).
- Electorates by ward or polling district, to weight by electors instead of
  adults.
- Several years of local results per ward, averaged, to damp local candidate
  effects; or a per-ward adjustment where local and general election votes are
  known to diverge.
- Postal-vote and polling district results where councils publish them.
- Census data for Scotland at small-area level, so the model can run there.
