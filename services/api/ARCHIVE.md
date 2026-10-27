# Import reviewed ONS boundary releases

Use the pinned source catalogue in `pipeline/src/sources/onsBoundarySources.ts` to acquire
additional boundary releases before building API data. The catalogue currently
covers May 2026 Senedd constituencies, the unthinned 2001 LSOA boundaries, and
the 2001 and 2011 MSOA and output-area boundaries for England and Wales.

Choose release identities explicitly:

```sh
pnpm --dir pipeline fetch:boundaries seneddConstituency/2026-05-w-bgc
pnpm --dir pipeline fetch:boundaries msoa/2001-12-ew-bgc-v2 msoa/2011-12-ew-bgc-v3
pnpm --dir pipeline fetch:boundaries outputArea/2001-12-ew-bgc outputArea/2011-12-ew-bgc-v2
pnpm --dir pipeline fetch:boundaries lsoa/2001-12-ew-bgc-v2
```

The importer pages the official polygon service in object-ID order and requests
WGS84 coordinates. It writes each page to a temporary snapshot, so national
output-area files do not need to fit in one JavaScript string. It checks the
published area count, unique codes, names, polygon presence, and publisher
revision when supplied before publishing the directory atomically. It makes up
to four attempts at a request that drops, times out or meets a server error. It does not repair,
simplify, or otherwise edit coordinates returned by the publisher.

The catalogue pins the reviewed snapshot's SHA-256 as well as its publisher
item and area count. The hash covers the imported FeatureCollection, with each
page's features serialized as JSON in object-ID order. It does not cover the
publisher's HTTP response bytes. A same-count source revision still fails the hash check.
Review any changed source before updating the pinned hash.

Each snapshot contains `source.geojson` and `meta.json`, including its source
item URL, retrieval date, licence, country coverage, publisher revision when
supplied, and SHA-256. Repeating an
unchanged download preserves the snapshot and its original retrieval date. If
the source bytes change, choose a new release directory after reviewing the
publisher's revision. The importer refuses to overwrite the existing snapshot.

After importing, rebuild the API data on the build machine:

```sh
pnpm --dir services/api build
```

Run `pnpm --dir services/api audit:archive` after that build to inspect delivery
and relationship gaps. Acquiring a source does not prove that it is a valid
cross-area coverage or that a reviewed relationship exists for it.

Raw snapshots and API build outputs are ignored by Git. A source-import PR
therefore adds reproducible acquisition and adapter configuration, not a new
deployed data release. Include the imported sources in the next immutable raw
data release using the existing `data:publish` workflow before deploying them
elsewhere. Do not overwrite an existing published raw-data snapshot.

The 2010 Westminster constituency gap remains open. The official items found
so far are a map PDF and a code lookup, neither of which supplies polygons.
Do not relabel a later boundary release as 2010 without verified source evidence.
