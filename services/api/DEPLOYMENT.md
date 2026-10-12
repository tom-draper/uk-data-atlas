# Deploy the API

Build the API data on a build machine with the pinned Node and pnpm versions:

```sh
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

Keep the compiled `services/api/public` directory on a read-only persistent
volume. Deploy code and data together, then replace the container. The data build
is separate from the image build. The volume must include the geometry store,
observation tables, indexes and manifests. Raw sources are not required for a
current geometry store. To allow source fallback, also mount `data` at
`/app/data`. Rebuild stale stores before deployment.

Put a TLS reverse proxy in front of port 3001. The compose configuration binds
the host port to localhost. Configure the proxy's request-body limit to 8 MB,
matching the API. `/healthz` reports liveness and `/readyz` reports readiness.
SIGTERM drains requests for ten seconds, and compose allows fifteen seconds.

## Map files on object storage

Upload the files named by `map-resources.json` to a release-specific object
storage prefix, preserving their artifact paths. These are the PMTiles archives
and each GeoJSON and GeoParquet download, including untiled releases. Set
`ATLAS_MAP_ASSET_BASE_URL` to the HTTPS CDN URL for that prefix. For example:

```sh
export ATLAS_MAP_ASSET_BASE_URL=https://maps.example.com/releases/2026-10-12
```

With this setting, descriptors link to the CDN and API download routes redirect
to it. The API does not open local PMTiles archives, so map files can be omitted
from its volume. Keep `map-resources.json` on the volume.

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
worker count when choosing a public quota. Metrics scrapes sample one worker.

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
