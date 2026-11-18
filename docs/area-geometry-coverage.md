# Area geometry coverage audit

The following is an audit of the existing `data/build/atlas.sqlite` and
`data/build/artifacts/geometry-store` in the main checkout on 18 November
2026. It is a snapshot, not a promise about later builds. The database was
copied to scratch before inspection. Each area version's geography, release
and code was compared with the code list in the corresponding compiled
geometry store header. A matching code does not by itself prove that its
polygon is valid or that a representative point can be computed.

| Geography | Release | Area versions without a geometry code |
| --- | --- | ---: |
| countyElectoralDivision | 2017-05-en-names | 1,720 |
| historicalConstituency | 1918-uk | 697 |
| historicalConstituency | 1945-uk | 620 |
| historicalConstituency | 1950-uk | 625 |
| historicalConstituency | 1955-uk | 630 |
| historicalConstituency | 1974-uk | 635 |
| historicalConstituency | 1983-uk | 651 |
| historicalConstituency | 1997-uk | 659 |
| historicalConstituency | 2005-uk | 646 |
| **Total** | | **6,883** |

All 32,844 versions marked `in_inventory = 0` had matching geometry codes in
this snapshot. In total, 1,013,570 versions were checked across 115 available
releases. Named places, polygon validity and centroid generation were not
covered by this audit. A build-time check must calculate its own gaps from
its own inputs rather than rely on these counts.
