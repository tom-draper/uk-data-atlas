# Notional elections

Estimates of the 2019 general election result on the 2024 Westminster
constituencies, and how close they come to the published notionals (roadmap
task 46, issue #415). The same stage makes notional local election results on
wards new at each boundary review, see [Local elections](#local-elections).

Every number here comes from one run of
`pipeline/src/stages/build-notional-elections.ts` on 2026-11-17, against the
atlas base built from `main` at `f9b424b65`. The build runs the stage as
`notional-elections`, after `crosswalk-weights` and `weight-atoms` and before
`assemble-atlas`, with no benchmark. It writes
`data/build/notional-elections/notional-elections.sqlite`, and the tables below
to `data/build/notional-elections/notional-elections.md`. To score it, run it by
hand:

```sh
cd pipeline
tsx src/stages/build-notional-elections.ts --source <built checkout> --benchmark <candidacies.csv>
```

## Summary

- **The main method beats the baseline.** Mean absolute error in party share per
  seat falls from 0.72 to 0.39 points over all 632 seats in Great Britain, and
  from 0.80 to 0.43 over the 567 seats whose make-up changed. The notional
  winner differs from the benchmark in 8 seats, against 11 for the baseline.
- **England and Scotland gain most** (0.74 to 0.40, and 0.57 to 0.23). Wales
  gains less (0.56 to 0.51), since 15% of its adults live in wards with no
  usable contest.
- **An open variant ships beside it.** The main method reads local results
  under CC BY-SA 3.0. The open variant leaves them out and scores 0.45 (0.51
  on changed seats). Both are in the atlas, in different modules (see
  [Licences](#licences)).
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
   SNP, Green and Plaid Cymru stood, and they took at least half the vote. Each
   party's local vote in a year is scaled to its 2019 general election vote in
   the same nation (England and Wales together, or Scotland), so contests from
   different years and places are comparable. A
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
   average. The census tables cover England and Wales only, so the model does
   not run in Scotland.
3. **Seat average,** where neither applies.
4. **Raking.** The pieces are raked so each party sums exactly to its actual
   vote in the 2019 seat, and each piece's total vote follows its adults
   (50 iterations, then a final party fit).
5. The pieces are summed into the 2024 seats.

Pieces without a usable contest are flagged in `notional_piece` with the 2019
ward, the reason (`contest unusable` or `no contest placed`) and the parties
the model or the seat average filled in.

**Scotland.** The atlas's local election series covers England and Wales. For
Scotland the stage reads the May 2017 council results from the same Local
Elections Archive Project file the atlas holds
(`data/source/politics/local-elections/local-election/2017`, CC BY-SA 3.0),
whose Scottish rows the series leaves out. Councils there use STV, so a
party's share is the sum of its candidates' first preferences. The 354 wards
are placed on the December 2019 ward release: seven were recoded after
December 2017. 2017 is the only Scottish contest before 2022, so every
Scottish piece uses it.

The May 2022 Scottish council results (LEAP's 2022 file, placed on the
December 2022 ward release) were tried and left out. Used alone, as the
nearest contest in time, they raise Scotland's error from 0.23 to 0.34.
Averaged with 2017 on the 2017 wards, Scotland scores 0.23 with 2022 at a
quarter weight, 0.25 at half and 0.29 at three quarters: no gain. The SNP and
Labour gained and the Conservatives lost between 2019 and 2022, so 2022 is a
worse guide to 2019 than 2017 is.

Where local results come from, by adults covered:

| Source                      | Adults (m) |
| --------------------------- | ---------- |
| 2019 local elections        | 28.36      |
| 2018                        | 8.28       |
| 2021                        | 5.36       |
| 2017 Scottish councils      | 4.20       |
| 2022                        | 2.08       |
| 2023                        | 1.16       |
| 2017 (England and Wales)    | 0.34       |
| 2016                        | 0.06       |
| Contest unusable            | 1.56       |
| Contest unusable (Scotland) | 0.12       |
| No contest placed           | 0.01       |

## Accuracy

Mean absolute error in party share per seat, in percentage points, over the
parties standing in either set. "Changed seats" are the 567 that are not one or
more whole 2019 seats. The rows add each part of the main method in turn.

| Method                                       | MAE, all seats | MAE, changed seats | Winners differ |
| -------------------------------------------- | -------------- | ------------------ | -------------- |
| Baseline: residents, uniform within old seat | 0.72           | 0.80               | 11             |
| Local results, seat average where missing    | 0.40           | 0.45               | 7              |
| Plus UKIP for the Brexit Party               | 0.40           | 0.44               | 7              |
| Plus census model and adult raking (main)    | 0.39           | 0.43               | 8              |
| Main, without CC BY-SA local results (open)  | 0.45           | 0.51               | 9              |

By nation (seats):

| Method             | England (543) | Wales (32) | Scotland (57) |
| ------------------ | ------------- | ---------- | ------------- |
| Baseline           | 0.74          | 0.56       | 0.57          |
| Local results only | 0.41          | 0.52       | 0.22          |
| Plus UKIP          | 0.41          | 0.52       | 0.22          |
| Main               | 0.40          | 0.51       | 0.23          |
| Open               | 0.44          | 0.49       | 0.57          |

By party, mean absolute error (mean signed error):

| Method             | con          | lab          | ld           | snp          | pc           | green        | brx          | other        |
| ------------------ | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ |
| Baseline           | 1.35 (+0.07) | 1.33 (-0.09) | 0.70 (+0.03) | 0.86 (-0.03) | 0.45 (+0.05) | 0.21 (+0.00) | 0.17 (-0.02) | 0.18 (+0.01) |
| Local results only | 0.68 (+0.05) | 0.65 (-0.08) | 0.40 (+0.03) | 0.41 (-0.02) | 0.47 (+0.06) | 0.15 (+0.00) | 0.17 (-0.02) | 0.18 (+0.01) |
| Plus UKIP          | 0.68 (+0.05) | 0.65 (-0.08) | 0.40 (+0.03) | 0.41 (-0.02) | 0.47 (+0.06) | 0.15 (+0.00) | 0.15 (-0.02) | 0.18 (+0.01) |
| Main               | 0.67 (+0.06) | 0.63 (-0.09) | 0.39 (+0.02) | 0.40 (-0.02) | 0.46 (+0.05) | 0.15 (+0.00) | 0.15 (-0.02) | 0.18 (+0.01) |
| Open               | 0.76 (+0.06) | 0.70 (-0.09) | 0.50 (+0.02) | 0.86 (-0.03) | 0.47 (+0.05) | 0.17 (+0.00) | 0.18 (-0.02) | 0.19 (+0.01) |

Of the 8 seats where the main method's winner differs from the benchmark, 5
are within 1,000 votes in the estimate. One is Scottish: Moray West, Nairn and
Strathspey, where the estimate has the Conservatives 976 votes ahead of the
SNP, well inside its bounds. The local-only variant gets one more winner right
but is worse on share error. In Scotland raking to adults is slightly worse
(0.23 against 0.22), since its adults are an England and Wales average share
of residents.

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
| Kingswinford and South Staffordshire | 2.41 | lab 4.60      | con                | Dudley South, South Staffordshire                                                                                   | 91%, 9%, 0%           |
| Leeds North West                     | 2.17 | con 5.76      | con                | Pudsey, Leeds North West, Leeds North East                                                                          | 99%, 0%, 1%           |
| Wetherby and Easingwold              | 2.11 | lab 5.38      | con                | Skipton and Ripon, Thirsk and Malton, Selby and Ainsty, Harrogate and Knaresborough, Leeds East, Elmet and Rothwell | 91%, 7%, 2%           |
| Spen Valley                          | 2.07 | lab 6.09      | con                | Batley and Spen, Huddersfield, Dewsbury                                                                             | 87%, 0%, 13%          |
| Wirral West                          | 2.06 | lab 5.00      | con, benchmark lab | Wirral South, Wirral West                                                                                           | 97%, 1%, 2%           |
| Selby                                | 1.98 | con 4.84      | con                | Selby and Ainsty, Elmet and Rothwell                                                                                | 82%, 14%, 3%          |
| Bicester and Woodstock               | 1.91 | ld 4.67       | con                | Witney, Henley, Banbury, Oxford West and Abingdon                                                                   | 91%, 9%, 0%           |
| Dewsbury and Batley                  | 1.87 | lab 5.43      | lab                | Batley and Spen, Huddersfield, Dewsbury                                                                             | 92%, 0%, 8%           |
| Leeds Central and Headingley         | 1.77 | lab 4.67      | lab                | Leeds Central, Leeds West, Leeds North West                                                                         | 98%, 0%, 2%           |
| East Grinstead and Uckfield          | 1.71 | con 3.61      | con                | Lewes, Wealden, Mid Sussex, Horsham                                                                                 | 81%, 19%, 0%          |
| Isle of Wight West                   | 1.68 | lab 3.15      | con                | Isle of Wight                                                                                                       | 67%, 29%, 4%          |
| Melton and Syston                    | 1.68 | ld 2.92       | con                | Loughborough, Charnwood, Rutland and Melton                                                                         | 81%, 18%, 1%          |
| Banbury                              | 1.67 | lab 3.20      | con                | Witney, Banbury                                                                                                     | 96%, 4%, 0%           |
| Isle of Wight East                   | 1.66 | lab 3.11      | con                | Isle of Wight                                                                                                       | 87%, 8%, 4%           |
| Tiverton and Minehead                | 1.57 | ld 2.72       | con                | Bridgwater and West Somerset, Tiverton and Honiton, Taunton Deane                                                   | 91%, 7%, 2%           |
| Ellesmere Port and Bromborough       | 1.53 | lab 3.70      | lab                | Ellesmere Port and Neston, Wirral South                                                                             | 94%, 2%, 4%           |
| Bristol North East                   | 1.42 | con 4.21      | lab                | Kingswood, Bristol West, Bristol North West, Filton and Bradley Stoke, Bristol East                                 | 97%, 1%, 2%           |
| St Neots and Mid Cambridgeshire      | 1.41 | con 3.21      | con                | South Cambridgeshire, South East Cambridgeshire, Huntingdon                                                         | 95%, 3%, 2%           |

Why:

- **West Yorkshire (8 of the 20).** Local votes there follow local
  candidates, not national parties. Rothwell elects Liberal Democrat
  councillors (3,167 votes in 2018, 2,206 in 2019) and Ossett, Morley and the
  Spen Valley have strong independent and residents' groups. The method reads
  those wards as weak for the Conservatives and moves their vote elsewhere in
  the old seat. Wakefield and Rothwell is the worst case and flips the winner.
- **No Scottish seat** is in the worst 20 now that the 2017 council results
  are used. Before, five were, each split uniformly. Their places go to
  Tiverton and Minehead, Ellesmere Port and Bromborough, Bristol North East,
  and St Neots and Mid Cambridgeshire, at 1.41 to 1.57 points.
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
it is checked against.

No second boundary change can test it. The 2010 seats have 2005 results on
the old seats, but no local results from those years and no benchmark. The
factor was checked instead against the actual 2024 results, which the benchmark
never saw. Each changed seat's 2019 notional share, plus its region's swing
leaving the seat out, was compared with the 2024 share for Conservative, Labour,
Liberal Democrat, Green and Reform. The same fit the local backtest uses
regresses squared error on the square of the at-risk share within each region
and party (2,512 estimates):

| Prior                 | RMSE, changed seats | Implied factor | 95% interval  |
| --------------------- | ------------------- | -------------- | ------------- |
| Main                  | 6.72                | 0.33           | 0.23 to 0.39  |
| Open                  | 6.65                | 0.32           | 0.22 to 0.38  |
| Baseline              | 6.60                | 0.29           | 0.21 to 0.35  |
| 2017 to 2019, placebo | 3.71                | 0.06           | -0.07 to 0.12 |

The intervals come from resampling seats. Derived seats have an RMSE of 6.15.
The implied factor agrees with 0.32. The placebo uses the same fit on the
2017 to 2019 change in the old seats, when no boundary moved, with each seat's
later split share in place of at-risk votes. It finds almost no slope, so
seats that were later redrawn did not just swing more erratically. The check
is weak, though. Swing noise (about 6 points) is far larger than the notional
error (about 0.4), and the baseline implies a similar factor even though it is
almost twice as far from the benchmark. So it supports the scale of the
bounds, not their exact width, and it cannot rank the methods.

The open variant has wider bounds, a factor of 0.38, fitted the same way on its
own errors.

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
so its adults are taken as the England and Wales average share of residents.

## Licences

The Local Elections Archive Project results for 2016 to 2019, and its 2017
Scottish council file, are under CC BY-SA 3.0, so an estimate built from them
must be shared under the same licence. The atlas keeps those results in the
`politics-sharealike` add-on module, not in `politics`. The stage records the
licence of every local source it reads, and `notional_model` the licence each
shipped estimate carries.

Two estimates ship:

| Model                 | Method | Licence      | Bound factor | Module                |
| --------------------- | ------ | ------------ | ------------ | --------------------- |
| `notional-sharealike` | Main   | CC BY-SA 3.0 | 0.32         | `politics-sharealike` |
| `notional-open`       | Open   | none added   | 0.38         | `politics`            |

The open variant reads only local results from 2021 to 2023 and none for
Scotland, which is why Scotland falls back to the baseline (0.57).

## Storage

The stage writes `data/build/notional-elections/notional-elections.sqlite`:

- `notional_estimate`: votes per 2024 seat and party for each method, with
  `lower`, `upper`, `status` (`derived` or `estimated`), `at_risk` and the 2019
  seats it draws on.
- `notional_input`: per method, every series key read (general election, local
  elections by date, census tables), the Scottish council file, and the weights
  used.
- `notional_model`: the methods shipped in the atlas, with model id, label,
  licence and bound factor.
- `notional_piece`: each piece, its local contest or fallback reason, and the
  parties the model or seat average filled in.
- `notional_seat_source`, `notional_score`, `notional_seat_score`: where at-risk
  votes came from, and accuracy against the benchmark. Empty in the build,
  which has no benchmark.

`assemble-atlas` copies the shipped methods into `atlas.sqlite` as series with
`method = 'modelled'`, one per party and model, keyed like converted series:
`general-election/party-votes/constituency:2019-12-uk-bgc/party=con~notional-open:constituency:2024-07-uk-bgc`.
Each is in period `2019-12-12` on the 2024 constituencies, has
`derived_from_id` pointing at the published 2019 series, and shares its
members. Observations are status 6 (derived) with no bounds, or 2 (estimated)
with lower and upper bounds. The contest tables are the wrong place: they hold
real contests with candidates, and a notional has neither.

Three tables describe them, rather than `series_input` (one input per role)
or `series_conversion` (sum or rebuild):

- `model`: id, label, licence, bound factor and a description.
- `model_input`: the series keys and files each model read, as text, since
  some (census counts, a source file) are not in the module that ships it.
- `series_model`: the model each modelled series is from.

The module build moves the observations of a model under a split's licence
into that split's add-on, in every period. It refuses to build a module that
would ship a share-alike model no add-on takes.

## Metrics

`assemble-atlas` also derives, per model, election metrics on the 2024 seats
(`notionalMetrics.ts`):

| Measure                   | Period       | Key                                                                                                                        |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `valid-votes`             | `2019-12-12` | `general-election/valid-votes/constituency:2019-12-uk-bgc~notional-open:constituency:2024-07-uk-bgc`                       |
| `majority`                | `2019-12-12` | `general-election/majority/constituency:2019-12-uk-bgc~notional-open:constituency:2024-07-uk-bgc`                          |
| `party-vote-share-change` | `2024-07-04` | `general-election/party-vote-share-change/constituency:2024-07-uk-bgc/party=con~notional-open:constituency:2024-07-uk-bgc` |

The share change is the 2024 share of the valid votes less the notional 2019
share, in percentage points. The Brexit Party's 2019 votes count as Reform's,
since it renamed itself Reform UK in 2021. A party that did not stand in 2019
had no previous share. Each series derives from the series it is made from: the
published 2019 series, the party's notional series, or for a party with none,
its 2024 series.

Swing between two parties is half the difference of their share changes, and
marginality is the majority over the valid votes, so neither is stored.
Turnout change needs a notional electorate, and the stage splits votes, not
electors, so it is not made.

Seats of whole 2019 seats are exact. Elsewhere each bound is a factor times
the seat's at-risk votes (or, for a share change, those votes as a share of
the notional valid votes), the 95th percentile of the metric's error over that
against the benchmark in the changed seats. Summing the party bounds instead
would be two to three times as wide, since party errors partly cancel.

| Metric       | Main  | Open  |
| ------------ | ----- | ----- |
| Valid votes  | 0.19  | 0.19  |
| Majority     | 0.10  | 0.10  |
| Share change | 0.031 | 0.036 |

Valid votes depend only on the residents split, so both share one factor. A
party that did not stand in 2019 has an exact previous share, so its change
carries no width.

## Local elections

A ward created by a boundary review has no result of its own until its first
election, so its previous result is notional: the votes of the old wards it
was drawn from at the latest earlier election (`pipeline/src/notional/local`).

- **Targets.** Every ward release an election is published on after the
  first, and the latest release (`2026-05-uk-bgc`, ahead of the 7 May 2026
  polls). Each target's new wards are the codes not on the release before it.
- **Source election.** The latest election before the target's own (or before
  7 May 2026), within 4.5 years, whose old wards with a usable result (two or
  more parties with votes) hold at least 90% of the new ward's adults. A day's
  results are read from the release holding most of its wards.
- **Split.** Old and new wards are overlaid on the weight atoms by adults
  (residents times their LSOA's census adult share). A piece under 2% of its
  old ward's adults is drift between two drawings of the same line and joins
  the old ward's largest piece. Each old ward's votes are spread uniformly by
  adults, summed, and scaled up by the share of adults covered.
- **Status.** A ward of whole old wards is `derived`; any other is `estimated`,
  and each party's at-risk votes are its votes less those from whole old
  wards.

| Ward release        | Election   | New wards | Notionals | Derived | From         |
| ------------------- | ---------- | --------- | --------- | ------- | ------------ |
| `2017-12-gb-bgc`    | 2017-05-04 | 345       | 0         | 0       |              |
| `2018-12-uk-bgc`    | 2018-05-03 | 918       | 273       | 43      | 2016 to 2017 |
| `2019-12-uk-bgc`    | 2019-05-02 | 1,409     | 94        | 14      | 2016 to 2018 |
| `2021-12-uk-bgc`    | 2021-05-06 | 507       | 359       | 46      | 2017 to 2019 |
| `2022-12-uk-bgc`    | 2022-05-05 | 1,648     | 849       | 178     | 2018 to 2021 |
| `2023-12-uk-bgc`    | 2023-05-04 | 1,181     | 1,120     | 259     | 2019 to 2022 |
| `2024-12-uk-bgc`    | 2024-05-02 | 346       | 332       | 82      | 2021 to 2023 |
| `2025-05-uk-bgc-v2` | 2025-05-01 | 335       | 334       | 68      | 2021 to 2024 |
| `2026-05-uk-bgc`    | none yet   | 371       | 370       | 101     | 2023 to 2024 |

3,731 notionals, 791 derived. The 2017 to 2019 reviews are mostly missed: the
councils redrawn then last polled all-out in 2012 to 2015, before the atlas's
first local results (2016), including the Scottish councils in 2017.

### Backtest

No benchmark of local notionals is published, so they are scored by what they
predict. A new ward's notional share plus its council's swing (all its other
wards, leaving the ward out) is compared with the ward's actual result at the
target election, for each of Conservative, Labour, Liberal Democrat, Green and
Reform where the party stood both times. Wards whose boundaries did not change
are scored the same way from their own previous result, which measures the
year-to-year noise both share. Root mean square error, in share of the vote:

| Years between | New wards | Unchanged wards |
| ------------- | --------- | --------------- |
| 1             | 0.070     | 0.066           |
| 2             | 0.086     | 0.078           |
| 3             | 0.096     | 0.098           |
| 4             | 0.094     | 0.107           |

New wards predict about as well as unchanged ones, so the notional adds
little error beyond the noise between elections. The 4-year rows differ in
make-up (new wards are mostly all-out councils), which is why new wards score
better there.

A within-council census model, as in the general election method, was tried
for the split pieces and dropped: it moved the backtest spread from 0.0767 to
0.0744 only, since census covariates explain little of the variation between
wards in one council (r² 0.32 Conservative, 0.35 Labour, 0.07 Liberal
Democrat, 0.12 Green).

### Bounds

Estimated values carry `value ± 0.23 × at-risk votes`. The factor is fitted on
the new wards: within each target and gap in years, the squared error is
regressed on the squared at-risk share, so derived wards set the shared noise
and split ones add their own error; 1.96 times the square root of the slope is
0.23, and between 0.08 and 0.37 across groups. The stage logs the factor it
measures on each run, and ships the fixed one. Unlike the general election
bounds, these cover the notional's own error only, not the change between
elections.

### Licences and storage

Notionals from the 2016 to 2019 results are under CC BY-SA 3.0 as
`notional-local-sharealike`, and ship in `politics-sharealike`; later ones are
`notional-local-open` in `politics`. Both have bound factor 0.23. The component
holds `local_notional_model`, `local_notional_input`, `local_notional_estimate`
(per model, new ward and release, party: value, bounds, status, at-risk votes,
coverage, the old ward release, period and old wards) and
`local_notional_score` (the backtest above). `assemble-atlas` copies them as
one modelled series per model, party, old ward release and new ward release,
derived from the old wards' published series, on the period of the old
election:
`local-election/party-votes/ward:2019-12-uk-bgc/party=con~notional-local-open:ward:2022-12-uk-bgc`.

## Known weak areas

- Places where local and national voting differ: strong local Liberal
  Democrats, independents and residents' groups (West Yorkshire, Isle of
  Wight).
- Scotland: one set of council results, from May 2017, two and a half years
  before the general election, and no census model.
- Wales: 15% of adults in wards with no usable contest, and Plaid Cymru is
  slightly worse than the baseline (0.46 against 0.45).
- Local contests from 2021 to 2023 are up to four years from the general
  election.
- The Brexit Party relies on UKIP local votes, which are thin by 2019.

## What would improve it

- Electorates by ward or polling district, to weight by electors instead of
  adults.
- Several years of local results per ward, averaged, to damp local candidate
  effects; or a per-ward adjustment where local and general election votes are
  known to diverge.
- Postal-vote and polling district results where councils publish them.
- Census data for Scotland at small-area level, so the model can run there.
- Local results from 2012 to 2015, so the 2017 to 2019 ward reviews get
  notionals.
