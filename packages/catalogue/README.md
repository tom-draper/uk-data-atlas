# @uk-data-atlas/catalogue

Data catalogue code shared by the atlas and the API. Today that is the
register of corrections: the reviewed changes the API makes to what
publishers supplied, which the API serves at `/v1/corrections` and the atlas
docs list beside each measure.

Like `@uk-data-atlas/geography`, it holds code only, reads no files and is
safe to bundle into the browser. Its tsconfig has no DOM or Node types and no
path aliases, and `tests/packages/packageImports.test.ts` fails if it imports
anything its package.json does not declare.
