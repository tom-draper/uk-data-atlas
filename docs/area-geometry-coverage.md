# Area geometry coverage audit

The following is an audit of the existing `data/build/atlas.sqlite` and
`data/build/artifacts/geometry-store` in the main checkout on 18 November 2026. It is a snapshot, not a promise about later builds. The database was
copied to scratch before inspection. Each area version's geography, release
and code was compared with the code list in the corresponding compiled
geometry store header. A matching code does not by itself prove that its
polygon is valid or that a representative point can be computed.

| Geography               | Release          | Area versions without a geometry code |
| ----------------------- | ---------------- | ------------------------------------: |
| countyElectoralDivision | 2017-05-en-names |                                 1,720 |
| historicalConstituency  | 1918-uk          |                                   697 |
| historicalConstituency  | 1945-uk          |                                   620 |
| historicalConstituency  | 1950-uk          |                                   625 |
| historicalConstituency  | 1955-uk          |                                   630 |
| historicalConstituency  | 1974-uk          |                                   635 |
| historicalConstituency  | 1983-uk          |                                   651 |
| historicalConstituency  | 1997-uk          |                                   659 |
| historicalConstituency  | 2005-uk          |                                   646 |
| **Total**               |                  |                             **6,883** |

All 32,844 versions marked `in_inventory = 0` had matching geometry codes in
this snapshot. In total, 1,013,570 versions were checked across 115 available
releases. Named places, polygon validity and centroid generation were not
covered by this audit. A build-time check must calculate its own gaps from
its own inputs rather than rely on these counts.

## SQL locations

`area_location` holds one row per `area_version`. For polygons with a usable
interior it records WGS84 longitude and latitude and the western, southern,
eastern and northern bounds. The point uses the polygon interior scanline
method, recorded as `polygon-interior-point`; it is not population weighted.
The 2021 England and Wales output areas instead use published ONS
population-weighted centroids where they lie within the bounds, recorded as
`ons-population-weighted-2021`. In the investigated snapshot, five published
points were outside their stored geometry bounds and use interior points.
Bounds are rounded outward to six decimal places. Rows without a usable
polygon or interior point carry `gap` and null coordinates. Query the file's
own gap rows for its actual coverage:

```sql
SELECT v.geography, v.release, l.gap, count(*) AS areas
FROM area_location l JOIN v_area_version v ON v.area_version_id = l.area_version_id
WHERE l.gap IS NOT NULL
GROUP BY v.geography, v.release, l.gap;
```

```sql
SELECT v.geography, v.release, v.code, l.latitude, l.longitude,
       l.min_longitude, l.min_latitude, l.max_longitude, l.max_latitude, l.method
FROM v_area_version v JOIN area_location l ON l.area_version_id = v.area_version_id
WHERE v.code = 'E08000003';
```

Named places are recorded separately in `place_location`. In the investigated
snapshot, all 249 places with a stored `place_geometry` produced an interior
point; 22 had no stored geometry. To list gaps in any build, run:

```sql
SELECT p.slug, p.kind, l.gap FROM place p
JOIN place_location l ON l.place_id = p.id WHERE l.gap IS NOT NULL;
```

The editorial boxes in `place` are not necessarily polygon envelopes, so they
are not used as substitutes for missing geometry bounds.
