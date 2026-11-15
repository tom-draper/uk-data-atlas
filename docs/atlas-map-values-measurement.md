# Code-aligned map values at small-area scale

Issue #408 proposed colouring tiled maps from one value array per (measure,
boundary release, year) instead of joining the dataset onto the boundaries in
the browser. PR #598 shipped that for eight local authority datasets and found
no gain at about 300 areas. This records the same test at the heaviest tiled
numeric case, England neighbourhoods (33,755 LSOAs), and the conclusion.

## Result

The array path gives no measurable gain at LSOA scale either. Nothing further
was migrated.

Case: England, Fuel Poverty (LSOA 2021, rate). A throwaway prototype built the
array with the existing `website-map-values` stage and requested it for the
default measure. It was not committed. Median of three fresh-browser trials,
milliseconds unless stated, range in brackets.

| Switch, map first changes                  | old join            | array               |
| ------------------------------------------ | ------------------- | ------------------- |
| Child Poverty to Fuel Poverty (new tiles)  | 2185 (2094 to 2427) | 2387 (1715 to 2393) |
| IMD to Fuel Poverty (same tiles)           | 2681 (2677 to 3011) | 2703 (2525 to 3325) |
| Child Poverty to Fuel Poverty, data cached | 1497 (1018 to 1753) | 1536 (1482 to 1558) |

| Switch, map settled                        | old join | array |
| ------------------------------------------ | -------- | ----- |
| Child Poverty to Fuel Poverty (new tiles)  | 4780     | 4569  |
| IMD to Fuel Poverty (same tiles)           | 4756     | 4569  |
| Child Poverty to Fuel Poverty, data cached | 3965     | 3808  |

|                                                | old join          | array             |
| ---------------------------------------------- | ----------------- | ----------------- |
| JS heap after load (CDP)                       | 128.1 to 128.9 MB | 128.3 to 128.5 MB |
| JS heap after the Fuel Poverty switch          | 139.0 MB          | 139.5 MB          |
| Bytes on the first switch to Fuel Poverty      | 1,085,355         | 1,330,878         |
| Bytes on a switch with the data already loaded | 250 to 28,828     | 250 to 28,828     |

The differences are inside the trial to trial spread. Bytes rise by 245 KB,
which is the array itself, because the dataset JSON is still needed for the
cards.

## Why

A CPU profile of the switch (CDP, 2 ms sampling) puts the whole join, from
`renderNumericDataset` down, at 51 to 64 ms of a 2 to 2.7 s switch, and
`valueGeojson` at 16 to 22 ms. Removing it entirely could save about 3%. The
array path still pays for the rest:

- `setFeatureState` and `updatePaintArrays`, 220 to 270 ms, identical on both
  paths because the array path sets the same state.
- Fetching and retiling the boundary tiles when the geometry changes.
- Rendering, which dominates the settle time in headless Chrome on software GL.

Feature state was already used for same-geometry switches (#246), so the
GeoJSON rebuild the issue targets does not happen on the tiled path in the
first place.

Heap does not fall either. It rises about 11 MB across the first switch on
both paths, so the cached join can account for at most that, against a 128 MB
base dominated by the boundary GeoJSON and the datasets.

## Bytes and cards

Bytes per switch cannot fall by skipping the dataset JSON. Every card on the
page shows a figure for its dataset, so the payloads load at page load (an IMD
switch transferred 250 bytes, the dataset already being in memory). Making the
map-only path lazy would need the cards to read precomputed figures instead of
the payloads, which is a separate and larger change. It was not attempted.

## Method and limits

- `next dev --turbopack` on this branch, headless system Chrome with software
  GL, screenshots of the map polled every few hundred ms. Same method as #598.
- React's development build diffs component props for its performance tracks.
  With 33,755-feature props that made an LSOA to LSOA switch block for about
  43 s (`addObjectDiffToProperties`). That is a development artefact, so both
  runs disabled `console.timeStamp` and `performance.measure` in the page.
- Three trials per case, so differences under about 500 ms are noise.
- UK scope was not run. Headless Chrome peaks near 3.7 GB there on this box,
  and England already has the most tiled features of any numeric dataset.
- IMD was not given an array. It is chunked by region, has many measures, and
  the plain-field rule in `mapValuesRequestFor` excludes it. The profile above
  shows its switch is not join bound either.

## Recommendation

Close #408. The array path does not pay at 300 or at 33,755 areas, and the
costs that remain are tile fetch, retiling, feature state and rendering.

The #598 slice can stay or go. Keeping it costs a build stage, 11 small
arrays, a second render path and one awaited manifest fetch before the first
paint of every tiled numeric map, for no measured benefit. Reverting it is the
cleaner outcome. That is a decision for the owner, so it is not done here.
