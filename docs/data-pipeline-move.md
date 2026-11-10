# Data pipeline

The data pipeline lives in `pipeline/`. Shared runtime readers are in the domain packages, composition is in
`packages/atlas-loader/`, and the API is in `services/api/`. The former
`atlas-runtime` package was split into domain packages and `atlas-db`; package
entry points and dependencies are listed in [the architecture](../ARCHITECTURE.md#layout).

`pnpm data:build --plan` lists the stages in dependency order. Dataset
compilers write `data/build/datasets/`, and `atlas-sqlite` writes statistics
rows to `atlas-base.sqlite`. The data catalogue stage writes the catalogue.

The `statistics-read-path` stage derives selectors from the statistics registry
and declared rules. Export, compatibility and analysis geography validation
stages use those selectors. `assemble-atlas` combines the base, postcode, geography and website
components into `atlas.sqlite`.

The API reconstructs observations from the statistics rows. Fixture tests cover the selection rules.
See `data/build/README.md` for the full build layout and database schema.

Data stages run from the repository root, and pipeline and shared data readers
take the repository root. API configuration and `openapi.yaml` stay under the
API project directory. Pipeline-only tests live in `pipeline/tests/`, with
built tests in `pipeline/tests/built/`; `pnpm check:full` runs them.
