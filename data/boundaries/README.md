# Boundary releases

Every set of areas the atlas can draw lives in one folder:

```
data/boundaries/<geography>/<release>/
    meta.json                        where it came from, and what each file is
    Wards_December_2024_....geojson  as published, under its published name
```

The GeoJSON is the only form of a release this repository commits. The
TopoJSON the application serves is compiled from it into
`public/data/boundaries/<geography>/<release>/boundaries.topojson`, which is
not committed either — `pnpm boundaries:compile` rebuilds it byte for byte,
and `pnpm dev`, `pnpm build` and `pnpm check` all run it first.

Two releases are the exception and keep a committed `boundaries.topojson`
beside their `meta.json`, because nothing here can rebuild them:
`lsoa/2011-12-w-bgc`, published by ONS as TopoJSON with no GeoJSON to
compile, and `super-output-area/2011-ni`, converted from a shapefile outside
this repository. `scripts/sync-public-data.mjs` copies those two across.

`<geography>` is the `BoundaryType` it belongs to, in kebab case.

- Administrative: `ward`, `county-electoral-division`, `local-authority`,
  `county-and-unitary-authority`, `combined-authority`, `region`, `country`.
- Electoral: `constituency`, `scottish-parliamentary-constituency`,
  `scottish-parliamentary-region`, `senedd-constituency`,
  `senedd-electoral-region`.
- Statistical: `msoa`, `lsoa`, `data-zone`, `super-output-area`, `itl1`,
  `itl2`, `itl3`, `travel-to-work-area`.
- Health: `nhs-england-region`, `integrated-care-board`,
  `sub-integrated-care-board-location`, `local-health-board`.
- Other services: `police-force-area`, `community-safety-partnership`,
  `fire-and-rescue-authority`, `local-planning-authority`, `national-park`,
  `major-town-and-city`.

Most of these back no dataset of the atlas's own. They are here so an uploaded
file can be matched against whatever geography it happens to be keyed by, and
they cost nothing until something asks for them: the app fetches only the
geographies its visible charts can aggregate against.

Adding a geography means adding a family to `CATALOG`, which creates the
`BoundaryType` on its own. Three places still need the new keys spelled out,
because they are unions rather than derivations: the property interfaces in
`lib/types/geometry.ts`, the empty records in
`lib/data/boundaries/codeMapper.ts`, and the fixture in
`tests/hooks/useBoundaryData.test.ts`.

## Naming a release

```
<YYYY>-<MM>-<extent>[-<generalisation>][-v<n>]

2023-05-uk-bgc        wards as published in May 2023
2023-12-uk-bgc        and again in December, which is a different file
2025-05-uk-bgc-v2     the corrected second version of the May 2025 release
2011-ni               a publisher who dates a release to the year alone
```

Date first, so string order is chronological and the newest release is the
last one. The month is there because ONS republishes a geography more than
once a year, and the releases differ: May 2023 wards name each ward's local
authority and December's do not.

`<extent>` is `uk`, `gb`, `ew`, `en`, `w`, `sc` or `ni`. `<generalisation>`
is the publisher's own code — `bgc` generalised and clipped, `bfc` full
resolution and clipped, `nc` not clipped. Both change the geometry, so two
releases that differ only in those are two folders.

The hash the ONS Open Geography Portal appends to a download is deliberately
**not** in the folder name: it differs between two downloads of the same
product, so it identifies nothing. The GeoJSON inside keeps it, because it
keeps the filename the publisher gave it — someone searching for
`Wards_December_2024_Boundaries_UK_BGC` should be able to find this project,
and the stem is stable even where the trailing hash is not.

Coordinate system is not in the name either. Sources arrive in EPSG:4326 or
EPSG:27700 depending on the release; `decode.ts` reprojects British National
Grid on the way in, and every compiled asset is WGS84.

Some products the Open Geography Portal serves only through its API rather
than as a named download. Export those from the feature service, name the
file for the layer, and record the query in `meta.json` — that query is what
reproduces the file, since there is no published filename to fetch by.

## Adding a release

1. Download it into `data/boundaries/<geography>/<release>/`, keeping the
   filename it was published under. A GeoJSON this project converted itself,
   from a shapefile say, never had a published name and is `source.geojson`.
2. Write `meta.json`. Copy a neighbour: the required fields are `id` (equal
   to the folder name), `kind: "boundary"`, `title`, `publisher`,
   `sourceUrl`, `licence`, `spatialCoverage` and `files`. The compiler finds
   the GeoJSON to read through `files`, taking the one entry that is a
   `.geojson` with role `source` or `derived`, so that entry's `path` has to
   match the file on disk.
3. Add it to `BOUNDARY_CATALOG` in `lib/data/boundaries/catalog.ts`, newest
   first within its geography. Read the code and name keys off the file
   rather than copying a neighbour's — they change spelling between
   releases, and `wd19cd` against `WD19CD` is the difference between a
   working release and an asset with no properties at all.
4. `pnpm boundaries:compile`, then `pnpm test:run`.

The tests check the rest: that the asset exists, that it carries the keys
the release declares, that `meta.json` lists exactly the files present, and
that releases stay in order.

## Which release serves a year

Most code still asks for a geography and a year. Where one year has several
releases, the catalogue says which one answers for it:

```ts
aliases: { 2025: "2025-05-uk-bgc-v2", 2023: "2023-12-uk-bgc" },
```

Without an entry the newest release in the year wins. Pin it whenever a year
has more than one, so the choice is a decision in the file rather than a
consequence of list order. `aliases` also maps a year onto another year's
release entirely, which is how 2010 constituencies are served from the 2017
geometry: the areas did not change between them.

A release with no `asset` is held but not served. `data-zone/2011-12-sc-nc`
is the case to look at — the same 2011 areas as the release beside it, but
keyed `DZ11CD` instead of `DataZone`, so serving it would change the codes
datasets join on.
