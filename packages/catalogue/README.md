# @uk-data-atlas/catalogue

Data catalogue code shared by the atlas and the API. It holds the
register of corrections: the reviewed changes the API makes to what
publishers supplied, which the API serves at `/v1/corrections` and the atlas
docs list beside each measure.

`sourceMetadataCorrections` records reviewed classification changes to the
immutable source metadata. The ONS Scottish 2011 data-zone names-and-codes
table is a lookup, despite its original metadata calling it a boundary.
The API applies that correction to its source inventory and excludes the
table from its boundary registry. The original metadata hash stays available.

Like `@uk-data-atlas/geography`, it holds code only, reads no files and is
safe to bundle into the browser. Its tsconfig has no DOM or Node types and no
path aliases, and `tests/packages/packageImports.test.ts` fails if it imports
anything its package.json does not declare.

The package also exports the place profile format, place fact calculations,
compact dataset codecs and the API contract fingerprint. These modules read
no files and can run in the browser.
