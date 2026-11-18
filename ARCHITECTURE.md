# Architecture

How the repository is laid out, where its data lives, and which way its code
may depend. What the API is for, and what to build next, is in
[services/api/DIRECTION.md](services/api/DIRECTION.md).

## Two products, one geography engine

The repository holds two products:

- **The atlas**, the Next.js website at the root. It is the priority, and it
  runs on the VPS under systemd, behind Nginx.
- **The API**, a Node service in `services/api`. It runs on the same VPS, and
  that server also builds its data. See [deploy/README.md](deploy/README.md).

Both answer geography questions. The API resolves relationships and compiles
place profiles, the docs catalogue, and containment and lineage lookups.
The website fetches these over HTTP and shares browser-safe code through
`packages/`. It never imports API project code.

## Layout

The atlas (Next.js) lives in `app/`, `components/` and `lib/`. Shared packages
export TypeScript source and are imported by their `@uk-data-atlas/` names.

| Package         | Description                                                            | Entries                                                               |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `areas`         | Looks up, resolves, searches and loads boundaries for areas.           | `.`, `./inventory`, `./boundary-resources`                            |
| `artifacts`     | Content hashing and CSV, Parquet and SQLite file formats.              | `.`                                                                   |
| `atlas-db`      | Opens atlas.sqlite and resolves data file locations.                   | `.`                                                                   |
| `atlas-loader`  | Loads a complete atlas release by wiring the domain packages together. | `.`                                                                   |
| `catalogue`     | The catalogue of boundaries, units, corrections and place facts.       | `.`, `./place-facts`, `./compactPayload`, `./place-profile`, `./node` |
| `datasets`      | Declares datasets and compiles their contents.                         | `.`, `./types`                                                        |
| `geography`     | Area codes, kinds, coordinates and geometry primitives.                | `.`                                                                   |
| `geometry`      | Stores, loads and queries area geometry.                               | `.`                                                                   |
| `map-tiles`     | Builds and reads boundary vector tiles and map value arrays.           | `.`, `./node`, `./featureIds`, `./mapValues`                          |
| `measures`      | Measure definitions, quality, reconciliation and unit conversion.      | `.`                                                                   |
| `places`        | Named places, the gazetteer and place membership.                      | `.`, `./gazetteer`                                                    |
| `postcodes`     | Postcode indexes, areas and counts.                                    | `.`                                                                   |
| `relationships` | Crosswalks between areas and translation of values across them.        | `.`                                                                   |
| `search-index`  | Sorted, packed indexes and the lookups that search them.               | `.`, `./node`                                                         |
| `shapefile`     | Reads shapefile geometry and DBF records.                              | `.`                                                                   |
| `terrain`       | Terrain height sources and providers.                                  | `.`                                                                   |

`services/api/` contains the API, `services/mcp/` its HTTP client,
`pipeline/` the data build, and `scripts/` shared orchestration and readers.
Raw data lives in `data/source/`, generated data in `data/build/`, and
website data in `public/data/`.

## Where the data lives

| Where                   | What                                                               | In git      | Made by                                                                                            |
| ----------------------- | ------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| `data/source/`          | Raw files as publishers supplied them                              | No          | `pnpm data:download`, from the release pinned in `data-release.json`                               |
| `data/build/`           | Shared generated datasets, `atlas.sqlite`, `website-assets.sqlite` | README only | `pnpm data:build`                                                                                  |
| `data/build/artifacts/` | Remaining generated API catalogues and downloads                   | No          | `pnpm data:build`                                                                                  |
| `public/data/`          | The atlas's compiled datasets, boundary properties and PMTiles     | No          | `pnpm data:build`, `pnpm data:build --only boundaries` and `pnpm data:build --only boundary-tiles` |

Raw release archives keep their paths relative to the source root. The existing
pinned release restores into `data/source/` without republishing. For an existing
checkout, move its raw folders and `.source-release.json` from `data/` into
`data/source/`, leaving `data/build/` in place.

`map-figures.json`, `ranking-pages.json` and `rankings/*.json` hold map
headlines and ranked areas, compiled by `scripts/build-seo-data.mts` from the datasets. The website owns that
step: `pnpm dev` and `pnpm build` run it, and `data:build` does not.
Rankings read the precomputed `ward-areas` page from SQLite.

The data build compiles website artifacts with `pnpm data:build --only atlas-pages`.
That stage reads only the areas, crosswalks, geometry, named locations and
catalogue manifests it uses, not the API's release manifest. It stores gzipped files and a manifest under
`data/build/atlas-assets/atlas-pages/` and `atlas-pages.json`. The API serves them at
`/v1/atlas-pages/{page-id}.json`. `pnpm data:build --only website-lookups` stores their
precompressed bytes in `data/build/website-assets.sqlite`, a file the API does not read. The website reads them directly
for server rendering and serves browser requests at `/data/atlas-pages/{page-id}.json`:

| Page id               | Contents                                                   |
| --------------------- | ---------------------------------------------------------- |
| `places-index`        | Every place and the boundary release lists                 |
| `places-area-{shard}` | Area profiles, sharded by code                             |
| `places-named-{id}`   | A named place profile                                      |
| `place-facts`         | Median age and ethnicity by code                           |
| `ward-areas`          | Ward areas used by ranking recipes                         |
| `docs-catalogue`      | Datasets, measures, exports and boundary releases for docs |

The website server reads these from disk, once per server instance.
Current councils, constituencies and named places prerender during the website
build; wards render on first visit. Place search fetches the index from the
website on focus. A missing copy fails rendering rather than returning a false
missing place.

The API builds from raw `data/` without `public/data/`. The shared `datasets`
stage compiles every catalogue dataset once into `data/build/datasets/` (see
[data/build/README.md](data/build/README.md)). The `atlas-sqlite` stage stores their
metadata and statistics rows in `data/build/atlas.sqlite`. The payload the
website reads for each dataset is generated from those rows, checked against
the compiled dataset by value, and cached in `data/build/atlas-cache.sqlite`.
The API catalogue
compiler and atlas pages read it directly through the server-only reader in
`packages/catalogue/src/node/atlasPayloads.ts`. The `api-datasets` stage only builds
gazetteer core and boundary assets under `data/build/artifacts/source-data/`.
Named locations consume that gazetteer. The Next.js server also reads SQLite
and passes dataset URLs containing their payload SHA-256 to the browser. Its
`/data/catalogue/<sha256>/<output>.json` route serves exact JSON with one-year
immutable caching and negotiated gzip compression. Neither product fetches
catalogue datasets from the other product.

The Next.js server also answers measure queries at `/data/measures/<measure>`.
It runs the shared `queryMeasureValues` (`packages/measures/src/measureValues.ts`),
the function the API's series selection and aggregation rules also use, over the
same statistics rows, and returns columns of values per area and period with the
measure's value kind, unit and dimensions. It reads `data-catalog.json` and
`atlas.sqlite`; selectors, mappings and vocabulary are stored in the database. See
[docs/website-measure-queries.md](docs/website-measure-queries.md).

The website data build reads `data/build/datasets/` when cutting regional chunks,
without copying the catalogue payloads. `public/data/datasets/` retains
gazetteer, road-safety, chunk and SEO assets and the website build manifest.

The atlas's containment and lineage lookups (`area-lineage`,
`boundary-mappings`, `parish-lad-mappings`, `lsoa-lad-mappings-{year}` and
`constituency-lad-overlaps`) are not in the repository. The data build
compiles them with `@uk-data-atlas/geography` for the boundary releases
`@uk-data-atlas/catalogue` lists. The API serves them at
`/v1/atlas-lookups/{id}.json`. The website never reads them from the API.
The `pipeline/` workspace runs `pnpm data:build --only website-lookups` to import them
from `data/build/atlas-assets/` into the shared database. Page and lookup compiler
entry points still live in API scripts until their shared readers are extracted. The browser fetches them at
`/data/atlas-lookups/{id}.json`, and the precompiler reads the same database rows
when cutting regional chunks. The import also stores place profiles, facts, ward
areas and the docs catalogue. It validates source hashes before replacing rows
in one transaction, leaves unchanged imports untouched, and removes old public
copies after success. The final API release manifest hashes the database after
this import. Building needs the shared release on disk. Next.js builds and servers
read the database without running the importer or needing a running API. The API
serves page and lookup gzip files from `data/build/atlas-assets/`.

Everything in `data/build/artifacts` is build output, so its layout on disk is
the API's own business. Clients reach every file through a route, and a route
can find its file anywhere. What freezes when v1 leaves early access is the routes, their
parameters and what they return.

## Which way code may depend

The package manifests define this dependency order, from lower layers upwards:

- `artifacts`, `geography`, `datasets` and `shapefile` have no workspace dependencies. `search-index` uses `geography`, and `terrain` uses `artifacts`.
- `atlas-db` uses `artifacts`, `geography` and `search-index`. `map-tiles` uses `atlas-db`, `artifacts` and `geography`.
- `geometry` builds on `map-tiles`, `atlas-db`, `artifacts`, `geography` and `shapefile`. `areas` also uses `datasets` and `search-index`.
- `relationships` builds on `areas` and `geometry`. `measures` adds `datasets` and `search-index`, and `catalogue` builds on `measures` and `relationships`.
- `places` uses `catalogue`, `relationships`, `areas` and `geometry` as well as lower layers. `postcodes` depends on `atlas-db`, `artifacts`, `geography` and `search-index`.
- `atlas-loader` composes the domains, including `places`, `postcodes` and `terrain`. It holds only the loaders and the resolvers that need several domains at once (`GeographyResolver`, the areas and catalogue resolvers). Each domain defines the narrow interface it needs from them (for example `AreaReleaseSource`, `PlacedAreaResolver`, `CrosswalkSummarySource`), which the loader's resolvers satisfy structurally. The pipeline, website and API import the packages they need. `services/mcp` accesses the API over HTTP.

`tests/packages/packageImports.test.ts` enforces acyclic package dependencies,
one-line manifest descriptions, explicit exports without `./*`, and the
composition boundary: only `atlas-loader` depends on every atlas domain. Domain
packages may use `atlas-db` but cannot import `node:sqlite` directly. The same
test checks browser-safe main entries and Node-only code behind `./node` where
needed, as well as pipeline, API and MCP boundaries. The browser contract is
also checked by `tests/packages/surfaceFingerprint.test.ts`.

The website reads `services/api/openapi.yaml` for its API reference. Generated
API files live under `data/build/artifacts/`, with locations resolved by
`packages/atlas-db/src/dataLayout.ts`. API configuration and `openapi.yaml`
remain in the API directory.

Import a package by name (`@uk-data-atlas/geography`), never by a relative
path. Packages ship TypeScript source: Turbopack and `tsx` both compile it, so
there is no build step.

Pipeline unit tests live under `pipeline/tests/`, in one folder per
`pipeline/src/` folder they cover (`build/` covers the `build-data*.mjs`
orchestrator). Shared fixtures live in `pipeline/tests/fixtures/`. API tests may import pipeline code only through the fixture
modules explicitly listed in `tests/packages/packageImports.test.ts`. The
pipeline and API suites also use Vitest; `pnpm check` runs each unbuilt suite
once. Pipeline tests that require built data live in `pipeline/tests/built/` and
run through `pnpm check:full`.

## One data build

`pipeline/build-data-graph.mjs` lists every data build stage for both
products, with its dependencies. `pnpm data:build` builds all API and website
data in dependency order, including SQLite and PMTiles. Product targets
are no longer supported. Stages run from the repository root.
Stages that read an intermediate SQLite component pass its database path to
the shared readers directly, without constructing a temporary API directory.

`--plan` lists the stages without running them. `--only <stage>` builds one
stage and its prerequisites, reusing cached results where valid. `--from <stage>` rebuilds
a stage and its downstream consumers using existing upstream outputs.
These two options cannot be combined. For example:

```sh
pnpm data:build --only website-tiles
pnpm data:build --only atlas-sqlite --plan
pnpm data:build --from datasets
```

Independent stages run in parallel. A stage starts once its dependencies have
finished, with at most `--jobs <n>` running (default `DATA_BUILD_JOBS`, else the
CPU count) and their memory within a budget (`DATA_BUILD_MEMORY_MB`, else the
free memory, capped at three quarters of the total). A stage costs its
`--max-old-space-size` value, or 1 GB without one. A stage larger than the whole
budget runs alone. `--jobs 1` runs one stage at a time in plan order.

Stages start in order of the work still ahead of them. When the next stage does
not fit in the memory left, it waits, and a smaller ready stage may start ahead
of it only if that cannot delay it. That holds when the smaller stage is
expected to finish before the waiting stage could start (its last recorded
duration, plus a quarter), or when the budget has room for both even while the
smaller stage still runs. The wait is estimated from the stages already running,
so it needs a usable recorded duration for each of them. A stage with no
recorded duration, a failed last run or a corrupt record is treated as unknown,
and while one is running nothing starts ahead of the waiting stage, as before.
A stage that overruns its record only delays the waiting stage until it
finishes. Dependencies, `--jobs`, the memory budget and the stages that run
alone hold at every start, and none of this changes a stage's key or outputs.

With several jobs, each output line is prefixed with `[stage]`, and `--plan`
ends with the waves of stages that can run together and the critical path.

### Stage ownership

A stage owns the paths it declares, in `writes` beside its `outputs` and
`requiredOutputs`, and writes nothing else. No path has two owners: a file is
written by one stage, and every stage that needs it reads it after that stage
and depends on it. Two stages never share a SQLite file, a manifest or a
folder, so none writes a working copy for others to finish, none leaves a
stamp that stands for part of a file, and the scheduler has no shared paths
to order stages by.

The orchestrator holds every stage to this:

- `pipeline/build-data-ownership.mjs` checks the graph as
  `pipeline/build-data-graph.mjs` loads it. A path declared by two stages, or
  one inside another's, and a stage that declares none, stop the build before
  any stage runs. Only `sources` declares none (it rewrites `data/source`, not
  build outputs), and so it runs alone, as does an `exclusive` stage. The two
  registries are `exclusive`: they rewrite checked-in code that other stages
  import.
- After each stage runs, the runner compares `data/build` and `public/data`
  with how they were when it began. A file the stage changed or removed
  outside its declared paths fails the build with the files named, and the
  stage is not recorded, so it runs again. A file inside the paths of a stage
  that ran at the same time is not blamed on either, since neither can be told
  from the other. `pnpm data:build --verify-outputs` (or
  `DATA_BUILD_VERIFY_OUTPUTS=1`; `--check-writes` is the old name) runs one
  stage at a time, so every change is attributed, adds the raw sources to what
  is compared, and checks the hashes described below.

A new stage declares the files and folders it writes, or the graph does not
load. `pipeline/tests/` and `tests/scripts/` cover both rules on a fixture
graph and on the real one. A full data build needs the pinned source release,
so CI runs only the unit tests that exercise it on a fixture graph. They cover
the parity checks too, and a pipeline run with `CI` set (a fixture build, once
CI has one) runs them and fails on a mismatch.

A stage's outputs are keyed by its inputs. Its record in `.cache/data-build/`
is valid while the hash of its command, code, raw inputs and the output digests
of the stages it reads is unchanged and its own files are as recorded, and its
digest is the hash of those files alone. A stage that rewrites the same bytes
leaves its digest unchanged, and what reads it stays cached.

### Parity checks

Some outputs are produced one way and then rebuilt another way to compare
against it: the datasets served from statistics rows against the compiler's
JSON, and a sample of the postcode areas against a live lookup. These parity
checks are separate stages (`check: true` in the graph, built with `checkStage`
in `pipeline/build-data-graph.mjs`), so the stage that produces an output writes
it once and computes no second copy. Each check reads outputs, writes only a
stamp in `data/build/.stamps/` (the record that it passed), and nothing depends
on it.

| Check stage               | Reads                                                | Compares                                                                        |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `verify-dataset-payloads` | `datasets`, and `dataset_payload` in the atlas cache | The payload generated from statistics rows with the compiler's JSON, by value   |
| `verify-postcode-areas`   | `postcode-areas`, the postcode index, the geometry   | Every 5,000th postcode, and every postcode in several areas, with a live lookup |

A local `pnpm data:build` leaves the checks out and lists them. They run when:

- `pnpm data:build --verify` is given, or `DATA_BUILD_VERIFY=1` is set;
- `CI` is set (GitHub Actions sets it), so a pipeline run in CI always checks;
- `pnpm data:verify` runs, which verifies the published files and then runs
  `pnpm data:build --checks`. That runs only the check stages, against the
  outputs already built, and rebuilds nothing;
- `--only <check>` names one.

Once on, a check is an ordinary cached stage. Its key hashes its own code and
the output digests of the stages it reads, so it is skipped while they are
unchanged and runs again when an output changes or the check's code does. A
producer that reruns but writes identical bytes does not rerun its check. A
local build that skipped a check does not forget it: the next `--verify` build
or `pnpm data:verify` finds its inputs changed and runs it once. A failing check
is never recorded as passed, fails the build with a nonzero exit, and runs
again next time. `--checks --no-cache` runs them all regardless.

`pnpm build` and `pnpm dev` call only `scripts/verify-data.mts`, which checks the
published files. The parity checks read build intermediates that the website
server may not hold, and a failed check is no reason to regenerate data.

`--verify` is not `--verify-outputs`: the latter attributes every change to one
stage and checks the output hashes.
`statistics-read-path` derives selectors from declared rules and the
statistics registry. In particular, datasets partitioned by code year name
that rule explicitly; fixture tests cover it.

When a stage fails, no new stage starts. Stages already running finish, so
their outputs are complete and recorded in the cache, and the build exits with
the first failing status.

The dataset compiler uses DuckDB to read and filter public health source CSVs.
It hashes the source files for cache tracking and passes the selected rows to
the shared Node loader.
For general health and housing tenure, DuckDB selects LSOA rows from census
CSVs before the shared loaders validate counts and calculate percentages.
For planning applications, DuckDB selects the published quarter before the
shared loader validates authority codes and application counts.
It also uses DuckDB to aggregate road collisions directly from the source CSVs,
validating the inputs and tracking their hashes for the dataset cache.
For the school performance datasets, DuckDB filters the source CSVs before
the shared loaders process the selected rows.
The English deprivation dataset uses the same reader to select source columns
before its loader computes the local-authority summaries.
For electricity and gas consumption, DuckDB filters rows without an authority
code or a consumption value before the shared loaders join population figures.
For the 2016 to 2019 local election CSVs, DuckDB selects English and Welsh
rows before the shared loader calculates party votes and winners.

The `area-search-index` stage uses DuckDB to deduplicate and order search
postings after applying the shared name normalisation rules. The standalone API
cache rebuild retains the Node implementation.

The `place-index` stage uses DuckDB to deduplicate and order name postings.
It shares place grouping and index publication with the Node compiler used by
the standalone API cache rebuild.

The `postcode-index` stage uses DuckDB through its Node package to read and
order the compressed source. It compiles and validates one district at a time,
storing temporary shards under `data/build/` until the SQLite database is
published.

The `postcode-counts` stage uses DuckDB through its Node package to aggregate
counts from the canonical SQLite database. It validates the source shards first
and checks that the database remains unchanged during the build. DuckDB must be
able to load its SQLite extension, which it downloads on first use if needed.
The standalone API cache rebuild still uses the Node implementation.

Stage commands live in the graph rather than package scripts. The API package's
`build` command bundles its server only. The root `build` command builds the
Next.js application using existing data and does not assemble release assets. `pnpm dev` verifies website data first and runs the
complete data build only when that verification fails or a rebuild is forced.

The build skips a stage when its inputs and outputs are unchanged. Its key
includes its command, local imports, declared `codeInputs`, shared configuration,
the size and mtime of raw files in `data/source/`, and upstream output digests.
The files it wrote under `data/build/` and `public/data/` must also be
unchanged. A stage's outputs are the files that changed within its declared
paths while it ran, so stages with separate paths can run at once. A stage
without declared paths is tracked across both trees and runs alone.

A stage's output digest hashes the contents of its output files, not their
mtimes. After a stage runs, the runner stats only the paths the stage declares
(`writes`, `outputs`, `requiredOutputs`) to record its files; only a stage with no
declared paths (`sources`) scans both trees. The check that it changed nothing
else scans the output trees once more, which takes a few tens of milliseconds. Each recorded file stores
`{size, mtimeMs, ino, sha256}`. A file is hashed, in streamed chunks, only when
no hash can be trusted for it. Three sources are trusted, each only for a file
whose size, mtime and inode all match the stat taken with the hash:

- the file's own earlier record, so unchanged multi-gigabyte outputs such as
  `atlas.sqlite` are not read again;
- a link to a file already hashed, whichever stage recorded it, so
  `public/data/boundaries` (hard links of `data/build/boundaries`) is not read
  again;
- a hash the stage recorded while writing the file. A stage calls
  `recordOutputHash` or `writeFileHashedSync` from
  `pipeline/src/storage/outputManifest.ts` with the hash of the bytes it wrote
  (`geometry-store` and `map-resource` do). The runner gives each stage a
  manifest path in `DATA_BUILD_OUTPUT_MANIFEST` (under the cache folder, one
  JSON line per file), reads it when the stage finishes, then deletes it. A file
  changed after its hash was recorded no longer matches and is hashed again.

The skip check on later builds compares size and mtime alone. SQLite files are
hashed as files. A stage that rewrites identical bytes therefore keeps its
digest, and its dependants are skipped (early cutoff).

`pipeline/build-data-code.mjs` uses esbuild's dependency metadata to trace local
imports, including workspace package sources, without executing builders.
Keys include runtime-affecting root TypeScript compiler options and the versions
of directly imported external packages resolved from installed manifests. Local
import resolution tracks path mappings. Transitive package versions and dynamic
imports that esbuild cannot see are not tracked, so declare additional files in
`codeInputs` when needed. Runner changes require a key version bump when they
change key semantics or output meaning. API runtime configuration is assigned to
the builders that read each file in `pipeline/build-data-code.mjs`. The source
release is tracked for precompile fingerprinting and when imported or declared. Package manifests, API
documentation and unimported shared code are excluded unless declared.
Ordinary UI files are excluded unless a builder imports them.
Builders that read code or templates directly from disk declare those paths in
`codeInputs` in the build graph. Include worker entry points there too. Added and
removed files under declared directories change the cache key. Generated files
are tracked as stage outputs rather than bundled as code inputs. Unresolved
local imports fail the check rather than reuse a stale result.

Only the `sources` download is never cached, as it can change any raw file and
needs the network. It is skipped, with no command run, when
`data/source/.source-release.json` names the release pinned in
`data-release.json` and every file still has its recorded stamp (the first check
`data:download` makes). Every other stage is cached, so a build where nothing
changed runs no stage.

The catalogue and website registries rewrite checked-in files. Those files are
their `requiredOutputs`, tracked by size, mtime and content like any output, so
deleting or editing one reruns its stage. Their definitions are imported by
path, so the whole definition directories are `codeInputs`. After a registry
writes code, the code hashes of later stages are computed again.

### The atlas cache

`atlas-cache.sqlite` holds five components, and each is built by one stage into
a file only that stage writes, in `data/build/atlas-cache-parts/`:

| Part                     | Component         | Built by            |
| ------------------------ | ----------------- | ------------------- |
| `projections.sqlite`     | `projections`     | `atlas-sqlite`      |
| `datasets.sqlite`        | `datasets`        | `atlas-sqlite`      |
| `place-index.sqlite`     | `place-index`     | `place-index`       |
| `area-search.sqlite`     | `area-search`     | `area-search-index` |
| `postcode-counts.sqlite` | `postcode-counts` | `postcode-counts`   |

A part holds the component's tables, its `payloads` rows, its row of
`cache_generation` and `meta.cacheVersion`. It is built beside its place and
renamed, so a reader sees the old part or the new one. Its generation is that of
the canonical inputs it was built from: `atlas-sqlite` builds from
`atlas-base.sqlite`, since `atlas.sqlite` does not exist yet, and the other
stages from `atlas.sqlite`. A part is the stage's output, so the stage's
readers rerun only when its tables change, and a stage that is skipped keeps its
part.

`assemble-cache` is the only stage that writes `atlas-cache.sqlite`. It checks
that each part holds its component for the `atlas.sqlite` it finds (and fails
naming the part if not), copies the parts into a new file in the order above,
adds the content hash of `atlas.sqlite` as `meta.atlas-sqlite-content-hash`,
vacuums it with `VACUUM INTO` a temporary file beside the cache and renames that
over the cache. Nothing of an earlier cache is carried over, so a cache from
another `cacheVersion` needs no special case. A build that stops leaves the
published cache as it was, because only that rename publishes.

Stages that read a component before the assembly read its part: `requireAtlasCache`
in `packages/atlas-db` returns the part when there is one built for the current
`atlas.sqlite`, else the cache, and `atlasCacheFile` does so for the dataset
payloads, which readers check row by row. A release holds only the assembled
cache, so servers read that. `assemble-cache` waits for `atlas-sqlite`,
`assemble-atlas` and the three late stages, so what reads the assembled cache
(`documents`, `verify-dataset-payloads`) depends on it.

`pipeline/build-data-cache.mjs` stores the cache in
`.cache/data-build/`. The scoped key format and the content-hash record format
each invalidate old entries once.
`--from` and `--no-cache` rerun the stages they select regardless.
Moving stage commands to the repository root also invalidates cached stages
once because the command is part of each key. The cache format remains at
version 4. Each stage record also keeps its latest command and total duration and
finish time, including failed runs. Skips preserve the previous timing.
`last-build.json` in the same directory records the latest build's start, finish,
and stage outcomes and durations. A stage that ran also has `queueMs`, the time
between the scheduler settling it and starting its command, and `memoryWaitMs`,
the part of that spent held back by memory with a job slot free. `totalMs` still
includes the queue, so `totalMs - commandMs` is not wait alone: it also holds
the cache check and recording around the command. The stage record in
`stages.json` keeps the same two fields beside `commandMs` and `totalMs`, and the
scheduler takes `totalMs - queueMs` off such a record as the stage's expected
duration.

`--plan` shows available previous durations and estimates the total for stages
expected to run. The estimate can be partial and actual stages may differ if
rebuilt outputs are unchanged.

After a cache format bump or command change, `pnpm data:build --adopt` records existing outputs
against current keys without running any stage, hashing every adopted file once.
Use `--only <stage>` to select a stage and its prerequisites, or add `--plan` to
validate and preview adoption.
This trusts the user: it checks file presence, not whether the bytes were built
from current code or sources. Use it only when those outputs are known to be
valid. The never-cached `sources` download is skipped. Adoption refuses missing required files, empty declared output folders,
and missing files in the previous cache inventory. Keep the old stages.json
when upgrading: its output paths remain usable even if its version is obsolete.
Without an inventory or declared outputs, build the stage first. Adoption cannot
be combined with `--from` or `--no-cache`.

The `atlas-sqlite` stage writes the terrain catalogue to `data/build/atlas.sqlite`,
alongside catalogue datasets, relational areas, crosswalk source/target rows and
named locations with membership tables and lazy geometry. Indexed location
projections live in the local `atlas-cache.sqlite`. The API reads these
directly. Their JSON outputs remain build and release intermediates. Named
locations compile from area JSON before the shared SQLite database is written.
The statistics vocabulary and read-path stages write JSON under `data/build/`.
The read-path stage derives selectors from declarations and the statistics
registry. Assembly stores the vocabulary and selectors in the database for API
readers. Other API loaders still read their JSON outputs.
Stages after `atlas-sqlite` read the tables they need from `atlas-base.sqlite`
where that is cheaper than the JSON (`relationship-paths` reads each
crosswalk's shape from the edges), and read a crosswalk's JSON one file at a
time where they need every record. See "Compiled intermediates and who reads
them" in [data/build/README.md](data/build/README.md), with the measurements.
See [data/build/README.md](data/build/README.md) for the database schema.

## Rebuilding after a change

| You changed                            | Run                                                     |
| -------------------------------------- | ------------------------------------------------------- |
| Shared datasets or their loaders       | `pnpm data:build --from datasets`                       |
| How the API compiles geography or data | `pnpm data:build`, then `pnpm --dir services/api build` |
| Anything, before a release             | `pnpm check:full`                                       |
| Whether the outputs still agree        | `pnpm data:verify` (the files, then the parity checks)  |

`pnpm check` is the quick set CI runs. It needs no generated data: unit tests
that import a generated dataset get a small sample from `tests/fixtures/datasets`
instead. Tests that read the real generated data, or the raw data in `data/source/`,
live in `tests/built/` and run locally only. First follow the build order in
[deploy/README.md](deploy/README.md), including the website build that generates
SEO artifacts. Then `pnpm check:full` runs the quick checks, verifies local
generated data, and runs the built website and API tests. It needs `data/source/`
restored and both products built, with the API running for the API's own
tests. The check does not build or deploy either product.

## Current-build provenance

`data/build/artifacts/atlas-release.json` identifies the current build. It records
repository-relative paths and SHA-256 hashes of the stored `atlas.sqlite`, API
PMTiles, and JSON catalogues that still have runtime readers. The export and
map catalogues record the hashes of observation and flat boundary downloads. Gzipped files are identified by their stored bytes. The file has no
historical snapshots or per-resource comparison index.

Migrated SQLite data is covered by the database hash. JSON used only by the
SQLite writer is a build intermediate, not a release dependency. Projection
intermediates live under `data/build/location-projections/`. Geography catalogue
intermediates live under `data/build/geography/`; the `geography-catalogues` stage
adds them to the database after analysis compilation. Runtime readers and the
corresponding evidence document endpoints read SQLite. Consumers can keep a
build id for provenance and use download ETags or export lists for syncing.

The derived-boundary and source-inventory JSON summaries had no readers beyond
the old fingerprint builder. Their compilers no longer write them; derived
geometries and the runtime geography catalogue remain.

The pipeline builds search, location projection and postcode-count tables in
`data/build/atlas-cache.sqlite`. Deploy it alongside the canonical database from
the same build. The website's pages and lookups are in `data/build/website-assets.sqlite`,
which only the Next.js server needs. The source data release contains only raw inputs. See
[generated API data](docs/api-generated-data.md).
