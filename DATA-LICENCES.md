# Data licences

The root [`LICENSE`](./LICENSE) applies to the original source code and
documentation of the UK Data Atlas. It does not relicense third-party data,
boundary files, or other source material that the project downloads, cleans,
combines, or reformats.

## Source data

Every dataset and boundary release retains the licence stated by its source.
The current catalogue is primarily made up of:

- Open Government Licence v3.0 data;
- Open Parliament Licence data; and
- local-election material that combines Open Parliament Licence data with
  historical material under CC BY-SA 3.0.

The authoritative source, publisher, coverage and licence for each dataset are
listed in the [dataset catalogue in the README](./README.md) and in the
generated API catalogues. Boundary releases carry the same information in
their release metadata.

Redistributed copies must preserve the applicable source licence, attribution,
source URL and any required notices. Where the project has cleaned, repaired,
standardised, derived or reformatted a source, the published copy should say so
and link back to the original source.

The main licence terms are:

- [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
  permits copying, publishing, distributing, adapting and commercial use,
  subject to attribution and its exclusions.
- [Open Parliament Licence](https://www.parliament.uk/site-information/copyright/open-parliament-licence/)
  permits copying, publishing, distributing, adapting and commercial use,
  subject to Parliamentary attribution and its exclusions.
- [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/legalcode)
  permits adaptation and redistribution, but adapted material must retain
  compatible ShareAlike terms, preserve the required notices and identify
  changes.

These licences do not automatically cover personal data, third-party rights,
logos, trade marks, or other material that the original provider was not
authorised to license. A source-specific licence or notice takes precedence
over this summary.

## Project transformations

Cleaned, repaired, standardised, combined and derived datasets and boundary
files are released under the same licence as the source they come from: data
derived from Open Government Licence sources is released under the Open
Government Licence v3.0, data derived from Open Parliament Licence sources under
the Open Parliament Licence, and data derived from CC BY-SA 3.0 sources under
CC BY-SA 3.0. Where a release combines sources, each source's terms apply to the
parts derived from it. Any rights the project holds in its selection,
arrangement or transformations of the data are licensed on the same terms, so
the published data stays as open as its sources.

The API's provenance and attribution metadata should travel with generated
exports so users can identify both the original source and the Atlas
transformation.

## Private or paid datasets

Datasets whose terms do not permit public redistribution must not be committed
to this public repository or included in public build artifacts. They should be
stored privately and ingested under a separate commercial agreement. Any paid
API or hosted feature must identify its own service terms without claiming
rights over source data that the source licence leaves open for downstream
reuse.

The API and website code are AGPL-3.0 licensed, while hosted access, paid
features, quotas, support and service levels are governed by separate service
terms. This file is a project policy and licence summary, not legal advice.
