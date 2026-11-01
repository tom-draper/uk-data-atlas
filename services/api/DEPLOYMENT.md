# Deploy the API

Build the API data on a build machine with the pinned Node and pnpm versions:

```sh
pnpm data:build
pnpm --dir services/api build
```

The container compiles the server to a JavaScript bundle. Production runs with
Node and needs no TypeScript loader or dependency installation. Build from the
repository root:

```sh
docker build -f services/api/Dockerfile -t uk-data-atlas-api .
docker compose -f services/api/compose.yaml up -d
curl --fail http://127.0.0.1:3001/readyz
```

Compose mounts `data/build/artifacts/`, `data/build/atlas.sqlite`,
`data/build/atlas-cache.sqlite`, `data/build/atlas-assets/`, and
`data/build/map-resources/` read-only. Deploy
these matching release outputs with the code, then replace the container. The data build is separate from the image build. API public
files contain the geometry store and manifests; SQLite contains observation
tables and indexes. Raw sources are not required for a
current geometry store. Serving never falls back to raw source files. Startup
validates compiled metadata for every release in the geometry source registry
and refuses missing, stale or invalid stores. If a later release load finds an
unusable file, the request fails instead of parsing raw boundaries.

Remove an unusable compiled file if present, then rebuild on the build machine:

```sh
pnpm data:build --only geometry-store
```

Deploy the rebuilt store with its matching `geometry-sources.json` registry and
restart the worker. Validation compares registered source metadata. It does not
rehash raw boundary files or decode every geometry during startup.

Put a TLS reverse proxy in front of port 3001. The compose configuration binds
the host port to localhost. Configure the proxy's request-body limit to 8 MB,
matching the API. `/healthz` reports liveness and `/readyz` reports readiness.
SIGTERM drains requests for ten seconds, and compose allows fifteen seconds.

When one reverse proxy connects directly to the API, set the trusted hop count:

```sh
ATLAS_TRUSTED_PROXY_HOPS=1 docker compose -f services/api/compose.yaml up -d
```

Set `ATLAS_TRUSTED_PROXY_HOPS` to the actual number of trusted proxies between
the client and the API. Keep the default `0` for direct connections without a
proxy. With `0`, clients behind a proxy share that proxy's rate-limit bucket.

Configure each trusted proxy to append its incoming connection's remote address
to `X-Forwarded-For`, or configure the public-facing proxy to overwrite the
header with the client's address. Only trusted proxies may connect to the API
when the hop count is nonzero. An incorrect count or an untrusted path to the
API can let clients spoof their rate-limit identity.

## Map files on object storage

Upload the files named by `map-resources.json` to a release-specific object
storage prefix, preserving their artifact paths. These are the PMTiles archives. Set
`ATLAS_MAP_ASSET_BASE_URL` to the HTTPS CDN URL for that prefix. For example:

```sh
export ATLAS_MAP_ASSET_BASE_URL=https://maps.example.com/releases/2026-10-12
```

With this setting, tile descriptors link to the CDN and PMTiles download routes
redirect to it. The API does not open local PMTiles archives, so map files can be omitted
from its volume. Keep `map-resources.json` on the volume.

Whole-release GeoParquet and GeoJSON downloads have no artifact. The API
builds them from the geometry store on request and verifies their published
SHA-256 before serving them. PMTiles remain stored and can use the CDN.
The process keeps up to 64 MiB of recently generated download bytes in memory;
larger files are served without retention. Concurrent requests for the same
file share a build, and generation is serialized across releases. A cold
simplified download runs shared-arc generalisation and can delay other requests
while that CPU work runs. Warm downloads use the byte cache. Restarting the API
clears this cache. Keep the geometry store and release manifest from the same
build, or generation returns 503 rather than serving bytes under a stale hash.
Rebuilding map resources removes the obsolete simplified download files.

PMTiles clients can read archives directly with HTTP range requests. Configure
the CDN to support Range, GET, HEAD and CORS, and expose `ETag`, `Content-Range`
and `Accept-Ranges`. Serve stored `.geojson.gz` objects with
`Content-Type: application/geo+json` and `Content-Encoding: gzip`. Use immutable
cache headers only under a release-specific prefix.

For clients using individual MVT tiles or TileJSON, deploy a PMTiles tile service
against that object store and set `ATLAS_MAP_TILE_BASE_URL`. It must serve
`{base}/{geography}/{release}/tiles/{z}/{x}/{y}.mvt`. TileJSON then points there,
and API tile routes redirect there. Without this setting, remote-asset deployments
serve PMTiles downloads but report that individual tiles are unavailable.

## Processes and memory

`ATLAS_WORKERS` defaults to two independent worker processes sharing a listening
port through Node's cluster scheduler. A synchronous request blocks its worker;
the other can continue. The primary restarts failed workers after one second.
Use the deployment supervisor to restart the primary process. Rate limits,
response caches and metrics are per worker. Multiply rate-limit capacity by the
worker count when choosing a public quota. Each successful metrics scrape
collects all current workers over cluster IPC on the shared API port. Samples
carry a `worker` label, so process gauges and counter resets stay distinct.
Worker loss or an incomplete collection returns `503` instead of partial
metrics. Allow more than 1.5 seconds for scraping. See the
[metrics reference](README.md#endpoints) for collection deadlines and PromQL
aggregation examples.

A startup-only run on 2026-10-12 used about 266 MB RSS per process before requests,
down from about 789 MB in the same checkout before lazy loading. These are single
measurements, not a loaded-instance sizing guarantee. Spatial warmup and first
requests allocate more memory. Start with a 2 GB instance for two workers, then
measure a representative mix of postcode, search, value and geometry requests
before reducing the instance size. `ATLAS_GEOMETRY_CACHE_RELEASES` and
`ATLAS_RESPONSE_CACHE_MB` bound the geometry and response caches.

Run `pnpm --dir services/api profile:startup` to collect stage timings and a heap
snapshot. Set `ATLAS_HEAP_SNAPSHOT_PATH` to a disk with room, or set
`ATLAS_HEAP_SNAPSHOT=off` for a startup-only measurement without the snapshot.

## Usage counts

The API can keep daily counts of what it is asked, to show which datasets and
archives to fill first. Set `ATLAS_USAGE_DIR` to a writable directory and each
worker adds its counts to `usage.sqlite` there. Unset, nothing is written and
`/metrics` is the only record. Compose and the systemd unit set it to a path
outside the release and the caches (the `atlas-usage` volume, and
`/var/lib/uk-data-atlas/usage`), so a deploy neither replaces nor invalidates
it.

A row is a count for one UTC day and one combination of route template,
outcome (`2xx`, `4xx`, `5xx`), problem code, measure id, geography, release
and kind of absence (unknown measure, unknown release, unresolved place and so
on). Workers keep counts in memory and write them every
`ATLAS_USAGE_FLUSH_SECONDS` (default 60) and on shutdown, so a request never
waits on the disk. The write adds to the existing row, so workers and restarts
combine without coordinating. A process that is killed rather than stopped
loses at most one interval. Days older than `ATLAS_USAGE_RETENTION_DAYS`
(default 400) are deleted when a worker starts. If the directory cannot be
opened the API logs `usage.store_unavailable` and carries on without it.

Read the counts on the host that holds the directory. There is no HTTP route
for them:

```sh
pnpm --dir services/api usage:report --days 30            # from a checkout
docker compose -f services/api/compose.yaml exec api node dist/usage-report.mjs --days 30
```

It prints the top routes, measures, geographies with releases, and not-found
requests. `--limit` sets the rows per table (default 10). A value shown as
`unknown` is an id the catalogue does not hold, such as a measure that does
not exist; how often it is asked for is the signal, not what was typed.

The same dimensions are exported as `atlas_api_usage_outcomes_total`,
`atlas_api_usage_measures_total`, `atlas_api_usage_areas_total` and
`atlas_api_usage_not_found_total` on `/metrics`. Those reset on restart and
are per worker like the other counters.

### Privacy

Usage counts hold no personal data, by construction:

- Never stored: IP addresses, user agents, headers, full URLs, query strings,
  postcodes, place names, coordinates, area codes or request ids.
- Stored: the OpenAPI route template (`/v1/postcodes/{postcode}`, never the
  concrete path), the outcome class, a problem code, and measure, geography
  and release ids that exist in our own catalogue, plus a count and a day.
- An id that is not in the catalogue is stored as `unknown`, so a typed
  name or guessed id cannot reach a label and the number of distinct values is
  bounded by the catalogue.
- The store rejects any label that is not shaped like a template or id and
  writes `other` instead.

The JSON access log (`ATLAS_ACCESS_LOG`) is separate from usage counts. It
records each request's path, so a postcode lookup appears there; turn it off
or keep it short-lived if that matters for your deployment.

## Measure request memory

Build the API data first, then run the local workload from the repository root:

```sh
pnpm --silent --dir services/api profile:memory > /tmp/atlas-memory.json
```

The command runs one fresh API worker for each scenario in
`benchmarks/memory-workload.json`. It uses local compiled assets and warms the
same default postcode releases as serving. The load generator runs in a separate
process and consumes response streams without collecting whole bodies. Worker
cache, concurrency and rate-limit settings come from the usual environment
variables. The command uses a 1,024 MiB V8 heap limit and exposes garbage collection.

The JSON report records the release, Node version, runtime flags, resource
settings, OS peak RSS, sampled heap and RSS, memory after requests and garbage
collection, latency, decoded response bytes, HTTP statuses and transport failures.
Peak RSS includes startup and is not reset between startup and requests. The
20 ms samples can miss allocations during synchronous handlers. A 1,024 MiB heap
limit is not an RSS limit. These local measurements do not establish production
instance sizing.

Copy the workload JSON and pass its path to select your own releases and loads:

```sh
pnpm --silent --dir services/api profile:memory /absolute/path/workload.json > /tmp/atlas-memory.json
```

Each scenario has a unique `name`, a `/v1/` `path`, `requests` from 1 to 10,000,
and `concurrency` from 1 to 64. `method` defaults to `GET`; `POST` accepts a
JSON string in `body`. `encoding` is `identity` by default or `gzip`.
`expectedStatuses` defaults to `[200]`. List an expected refusal such as `422`
or `503` explicitly when measuring a budget boundary. Requests time out after
30 seconds. A worker has 120 seconds to become ready or return its final report.

The command exits nonzero if a response has an unexpected status, a transport
failure occurs, or a worker cannot start. Inspect status and failure counts
before comparing memory. Compare identical workloads, artifacts, settings and
Node versions. Each scenario starts with fresh caches, then repeat requests can
use them. The supplied short workload is a starting point, not a sustained-load
or production traffic model.

If startup reports stale generated inventories, rebuild their declared inputs
and dependent inventories on the build machine. For example, after rebuilding
analysis support, rebuild `analysis-geography-validation.json` too. Rebuild
`operations.json` whenever `openapi.yaml` changes. Do not bypass startup validation.

## Website place and catalogue artifacts

The `atlas-pages` and `atlas-lookups` stages write manifests and gzipped files
under `data/build/atlas-assets/`. Include this directory alongside
`data/build/atlas.sqlite` in the deployed API volume, preserving paths relative
to the repository root. Page and lookup routes read these release files.
Other API outputs stay under `data/build/artifacts/` during the compiler migration.

The `pipeline/` workspace's `website-lookups` stage stores the same gzip bytes in
SQLite before the final release manifest. Next.js builds and servers read those
rows directly. They need neither API public files nor a running API, so the
website and API can deploy independently after the release is built. These
artifact shapes follow the website; clients needing stable responses should use
the area and catalogue routes.

## Crosswalk compilation

Crosswalk builds reuse validated artifacts and log each newly compiled crosswalk's
method and elapsed time. New artifacts are published atomically as checkpoints.
If a build fails, restart it to reuse completed checkpoints.

Compilation defaults to at most two workers, limited by CPU count and available
memory. The budget reserves 2 GiB for the parent plus 6 GiB per worker. Each child
has a 4 GiB V8 heap limit. These are scheduling budgets, not hard RSS limits.
Machines below the parallel budget use the serial compiler.

Set `CROSSWALK_WORKERS=1` to force serial compilation. Request more workers only
when the machine has enough available memory and CPUs:

```sh
CROSSWALK_WORKERS=2 pnpm data:build --only crosswalk-inventory
```

Each worker owns its geometry caches. Population crosswalks start after their
area-overlap dependency is available and verify its content hash. The final
inventory follows adapter order regardless of completion order.

To force selected crosswalks to compile without replacing build outputs, run:

```sh
pnpm exec tsx --max-old-space-size=4096 pipeline/src/profile-crosswalks.ts --workers=1 <crosswalk-id>
```

The profiler includes population dependencies, writes to a temporary directory,
and reports per-crosswalk timings, record counts and content hashes. It rejects
results that differ from an existing stored baseline. Its summary reports wall
time and the parent's peak RSS, which excludes child memory in parallel mode.
Raw sources, area artifacts and the geometry source registry must already exist.
