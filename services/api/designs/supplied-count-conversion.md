# Supplied-count conversion

## Problem

The existing conversion engine operates on published observations with unique
codes. Supplied rows need validation, duplicate detection and coverage reporting
before their values can be combined.

## Usage

Send UTF-8 CSV or JSON to a crosswalk's conversion operation:

```sh
curl --data-binary @counts.csv -H 'content-type: text/csv' \
	'https://api.ukdataatlas.com/v1/crosswalks/CROSSWALK_ID:convert?semantics=count'
```

The crosswalk fixes the source and target releases. `semantics=count` asserts
that values are finite non-negative counts that add over areas. Splits require
`weighting=area` or `weighting=population`, matching the published crosswalk.
An exact regrouping needs no weighting parameter.

Only publish a result as a whole target total when its `coverage.status` is
`complete`. That status means all source codes the crosswalk maps to the target
were supplied. It does not establish that the crosswalk covers the whole
geography. The response reports both totals, the input hash and the crosswalk
hash, under the envelope's Atlas release.

## Shape

`crosswalkConversionRoutes.ts` owns HTTP policy and selects one forward crosswalk
through the resolver's cached step index. It reuses `readPostedRows` and validates
codes and names against the exact source release. `suppliedConversion.ts` owns
count validation and coverage. The existing conversion engine owns arithmetic
and refusal of unmapped codes or unweighted splits.

`readSuppliedCounts` returns either accepted records or rejected rows. A caller
cannot convert an accepted subset of an invalid column through that result.
Duplicates are detected by resolved code, so a code and its name also conflict.
The response lists at most 1,000 rejected rows and gives the full rejected count.

## Synthesis decision

Two designs were compared: a crosswalk-owned operation with whole-request
refusal, and a release-owned operation that excludes invalid rows. The
crosswalk-owned design requires fewer parameters and prevents excluded input
from quietly lowering a combined total. An independent comparison reached the
same conclusion.

The final design takes non-negative count semantics and input/output totals
from the release-owned alternative, and adds an explicit weighting opt-in.
It omits the proposed extra basis pin because the response already records the
Atlas release and content hashes. It does not refactor the existing join route.

## Tradeoffs

- One invalid row refuses the request. The caller can correct it and resubmit.
- Partial targets remain visible with coverage. Unreached targets are absent,
  never zero, and missing counts are never estimated.
- Best-fit assignments are refused because one assigned parent does not prove
  whole-area containment.
- The operation supports one forward crosswalk. Paths, reverse conversion,
  signed values, rates, intervals and storage remain outside this version.
- Results are returned together, without pagination. The existing row and body
  limits bound input, and a POST response is never cached.

## Verification

`tests/crosswalkConversionRoutes.test.ts` exercises the public router and a real
HTTP server. It checks CSV and JSON results, hashes, coverage, duplicate names
and codes, invalid values, unsupported splits, weighting opt-in, numeric overflow,
best-fit refusal and uncached POST bodies against literal expected results.
