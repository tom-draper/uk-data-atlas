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
  changes. No further restrictions may be placed on it.

These licences do not automatically cover personal data, third-party rights,
logos, trade marks, or other material that the original provider was not
authorised to license. A source-specific licence or notice takes precedence
over this summary.

Nothing in this project limits what a source licence allows. Anyone may
download the sources and build the data themselves with the code in this
repository.

## The curated database

The project compiles the sources into a curated database: cleaned, repaired,
standardised and joined to the correct boundary releases, with provenance on
every series. The project offers this database, and regular updates to it, as
a paid product. A purchase is a licence to use the database files, under the
customer terms supplied with the purchase. It is not a transfer of rights in
the source data.

- **What customers pay for.** Access to the compiled files, the topic modules
  chosen, the updates published during the subscription, and support. Files
  downloaded during a subscription may be used after it ends.
- **Sharing.** The customer terms ask customers not to redistribute the
  database files as delivered, in whole or in substantial part, outside their
  organisation. This is a contractual term, not a technical restriction.
- **What stays open.** The terms do not restrict any use that a source
  licence permits for the source data itself, including extracting, reusing
  and publishing individual values with the attribution the source requires.
- **CC BY-SA material.** Material derived from CC BY-SA sources is exempt from
  the sharing term and stays under CC BY-SA, as that licence requires.
- **Licence record.** Each delivered file contains a `licence` table naming
  the customer, the order, the release and a summary of these terms.
- **Attribution.** Each delivered file carries the source, publisher, licence
  and method of every series, so customers can meet the attribution terms of
  the sources.

Any rights the project holds in the selection, arrangement and verification
of the curated database, including database right, are reserved and licensed
to customers under the customer terms. Copies of project data obtained before
this policy took effect keep the terms they were released under.

## Website and API

Values shown on the website, and data returned by the free API, may be reused
under the licence of their source, with attribution to both the source and the
UK Data Atlas. Bulk access, higher API quotas and other paid features are
governed by separate service terms.

## Private or paid datasets

Datasets whose terms do not permit public redistribution must not be committed
to this public repository or included in public build artifacts. They should be
stored privately and ingested under a separate commercial agreement. A dataset
whose terms restrict commercial use or redistribution, such as some Northern
Ireland postcode data, must not be included in a paid database without a
licence that permits it.

## Code

The API and website code are AGPL-3.0 licensed. A commercial licence for the
code is available separately; see the [README](./README.md#licence).

This file is a project policy and licence summary, not legal advice.

### Source licences in SQLite

The `licence` table describes known source licences and their commercial-use
and ShareAlike flags; it does not record a customer's order or contractual
terms. `source_licence` associates each identified source with its licences.
A source without an association has not been classified, rather than being
unlicensed. The mixed local-election source has both licences: use
`election_licence` for the licence applicable to an individual election.

`boundary_release_source` connects boundary releases to their source records.
`crosswalk_provenance_source` connects crosswalks to boundary inputs that can
be identified from their provenance paths. Other inputs, including postcode
and population inputs, are not necessarily represented there; consult the
crosswalk header and weighting provenance as well. The tables describe source
terms, not customer entitlement or a complete attribution for derived data.
