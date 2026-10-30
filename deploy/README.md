# Server deployment

The current host runs both applications as root from `/root/uk-data-atlas`,
using Node 24 in `/opt/node24/bin`, pnpm 12.5.1, systemd, Nginx and Certbot.
This documents the current root deployment requested for this server.

| Hostname                             | Upstream                 |
| ------------------------------------ | ------------------------ |
| ukdataatlas.com, www.ukdataatlas.com | 127.0.0.1:3000 (Next.js) |
| api.ukdataatlas.com                  | 127.0.0.1:3001 (API)     |

## Build

Clone the repository into `/root/uk-data-atlas` and install Node and pnpm at
those locations before installing the units. The host needs enough disk and
memory for the data download and geometry builds; these can take hours.

```sh
export PATH=/opt/node24/bin:/usr/local/bin:/usr/bin:/bin
cd /root/uk-data-atlas
pnpm install --frozen-lockfile
umask 022
pnpm data:build
pnpm --dir services/api build
pnpm build
install -d -m 0755 /var/www/uk-data-atlas
node --import tsx scripts/link-boundary-tiles.ts /var/www/uk-data-atlas
```

The data build downloads raw inputs and builds all API and website data.
Then build the API runtime and Next.js app from the same checkout.
Run these steps serially. Neither server needs to be running during the build.
The API data build checks the source release pinned by `data-release.json` and
writes generated catalogues to `data/build/artifacts/` and the terrain catalogue
payload to `data/build/atlas.sqlite`. API observation payloads, including shared
census tables, also live in this database. After updating the code, run
`pnpm data:build` before restarting the API to populate the observation tables
and regenerate compatibility, validation, and exports.
Keep `data/build/atlas.sqlite` under the repository root when deploying either
server. Both read it in read-only mode.
`pnpm data:build` builds missing or stale dependencies, writes atlas lookups
and pages into the shared release, then writes browser data and SEO files to
`public/data/`.
Neither output directory is tracked in Git.
`pnpm build` verifies local generated data, generates map headlines and rankings,
then runs Next.js. A nonzero
exit from any command means that step failed; stop before the next step.
The build writes an initial atlas manifest before evidence documents, then
writes the final manifest afterwards so a fresh build has the required inputs.

`pnpm data:build` builds all data, including boundaries, PMTiles and SEO.
`pnpm --dir services/api build` bundles the API server, and `pnpm build` builds
the Next.js app from generated data.
Stages whose inputs and outputs are unchanged since they last ran are skipped
(see "One data build" in `ARCHITECTURE.md`); add `--no-cache` to run them all.
To inspect the complete local data build without executing commands, run:

```sh
pnpm data:build --plan
```

After a complete build, rebuild a named stage and every affected downstream
stage with `--from`. Preview the selection before running it:

```sh
pnpm data:build --from crosswalk-inventory --plan
pnpm data:build --from crosswalk-inventory
```

Stage names appear in the plan alongside their commands and dependencies.
`--from` reuses existing upstream artifacts and leaves unrelated stages out.
`--only <stage>` builds the named stage and its prerequisites, including
downloads when required. It reuses valid cached results.
If upstream inputs changed, select their stage instead, or run
`pnpm data:build` for the complete build.
The runner executes serially and stops at the first failure. Individual builders
retain their existing artifact reuse checks. Use `--from` when downstream
outputs also need to be refreshed.

`atlas-release-initial` writes the manifest consumed by evidence documents.
`documents` rebuilds those documents and then the downstream `atlas-release`
stage pins them in the final manifest. Both manifest stages use the existing
`services/api/scripts/build-atlas-release.ts` script. `atlas-pages` compiles the website place profiles, facts and docs catalogue.
The `datasets` stage runs after `download` and compiles every catalogue dataset
once into `data/build/datasets/`, for both products (see `data/build/README.md`).
`atlas-sqlite` stores catalogue payloads in `data/build/atlas.sqlite` for the
API catalogue compiler, atlas pages and Next.js dataset route. `api-datasets` builds gazetteer core
and boundary assets under `data/build/artifacts/source-data/` for named
locations and atlas pages. The data build does not need website output in
`public/data/`.

Pages and lookups are release assets under `data/build/atlas-assets/`. The
`pipeline/` workspace assembles their bytes into SQLite in the `website-lookups`
stage. Deploy `atlas-assets/` alongside SQLite for API page and lookup routes.
Next.js builds only read SQLite, so website deployment needs neither API build
output nor a running API. Other files under `data/build/artifacts/` remain in
place while the compiler groups move out of the API.

## systemd

The checked-in units mirror the host. Adjust paths if Node or the repository
moves. Both listeners bind to loopback. The API trusts one proxy hop (Nginx).

```sh
install -m 0644 deploy/uk-data-atlas-api.service /etc/systemd/system/
install -m 0644 deploy/uk-data-atlas-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now uk-data-atlas-api uk-data-atlas-web
```

Optional API settings, including `ATLAS_METRICS_TOKEN`, can be supplied through
a local systemd override. Keep secrets out of Git; metrics are disabled until
a token is configured. The units require no environment file.

The API unit writes daily usage counts, with no personal data, to
`/var/lib/uk-data-atlas/usage` (`StateDirectory=`), outside the repository and
the build caches. Read them with `pnpm --dir services/api usage:report`, run
with `ATLAS_USAGE_DIR=/var/lib/uk-data-atlas/usage`. See
`services/api/DEPLOYMENT.md#usage-counts`.

## DNS, Nginx and HTTPS

Point all three hostnames at the server (currently `128.140.0.185`); configure
AAAA only when IPv6 reaches this host. Permit TCP 22, 80 and 443 through UFW,
including the active SSH port before enabling the firewall. Keep Node ports
3000 and 3001 private. The current host also runs Fail2ban for SSH.

`nginx.conf` defines the deployment default site. It belongs in
`/etc/nginx/sites-available/default` with the standard sites-enabled symlink.
`atlas-tls.conf` belongs in `/etc/nginx/snippets/atlas-tls.conf`.
`atlas-pmtiles.conf` belongs in `/etc/nginx/snippets/atlas-pmtiles.conf`.
Install the PMTiles snippet before loading either HTTP or HTTPS server blocks.
It serves website boundary archives directly at content-hashed URLs and retains
the stable aliases for one release.
Other website requests and all API requests retain their proxy routes.

```sh
install -d -m 0755 /etc/nginx/snippets
install -m 0644 deploy/atlas-pmtiles.conf /etc/nginx/snippets/atlas-pmtiles.conf
```

For a new host, install Nginx and Certbot and first serve only the HTTP blocks
from `nginx.conf`: the HTTPS blocks require certificates that do not yet
exist. Create `/var/www/letsencrypt` and use the included HTTP ACME location.
Then obtain certificates:

```sh
certbot certonly --webroot -w /var/www/letsencrypt -d ukdataatlas.com -d www.ukdataatlas.com
certbot certonly --webroot -w /var/www/letsencrypt -d api.ukdataatlas.com
```

Once both certificates exist, install the complete configuration and the
renewal hook:

```sh
install -m 0644 deploy/atlas-tls.conf /etc/nginx/snippets/atlas-tls.conf
install -m 0644 deploy/nginx.conf /etc/nginx/sites-available/default
install -m 0755 deploy/reload-nginx /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
```

Domain HTTP requests redirect to HTTPS. Direct IP HTTP requests continue to
serve the website. Certificates and their private keys stay on the host.

## Updates and operation

Build the intended revision, then refresh the Nginx archive links and restart
the affected service:

```sh
node --import tsx scripts/link-boundary-tiles.ts /var/www/uk-data-atlas
```

Nginx reads archives from `/var/www/uk-data-atlas/boundaries/`. The export uses
hard links to `data/build/boundaries/`, so archives still occupy one file's worth
of storage. Both paths must be on the same filesystem. A failed cross-filesystem
link stops the command. Adjust the export destination and snippet alias together
if this deployment uses a different serving directory. Re-run the link command
after each tile rebuild or deployment so replaced archives are republished.

`umask 022` during the build makes exported directories traversable and files
readable by Nginx workers. For older builds made with restrictive permissions:

```sh
find /var/www/uk-data-atlas/boundaries -type d -exec chmod 0755 {} +
find /var/www/uk-data-atlas/boundaries -type f -name '*.pmtiles' -exec chmod 0644 {} +
```

The link step streams each archive through SHA-256 and publishes
`/data/boundaries/<family>/<release>/<sha256>.pmtiles`. The public `tiles.json`
manifest selects these URLs. Publish archives and the manifest before restarting
the website. The private build manifest and archive filenames remain unchanged,
so existing outputs can be republished without recompiling geometry.

Hashed PMTiles responses support byte ranges and use
`Cache-Control: public, max-age=31536000, immutable`. Hashes identify the archive
bytes independently of the app version, preventing mixed generations of ranges.
Whole-file gzip is disabled. Next.js uses the same cache policy locally.
The manifest revalidates so new clients discover the current archive hashes.

Keep `/boundaries.pmtiles` aliases for the first content-hashed release. They use
`Cache-Control: public, max-age=0, must-revalidate` for existing clients. The link
step retains previously published hash files across updates. Preserve them when
transferring deployments, and do not prune them while clients may still request
their ranges. Hard links keep unchanged generations from duplicating storage.
Older archived generations consume disk until an operator retires them.

After deployment, inspect a hashed URL from `/data/boundaries/tiles.json`:

```sh
curl -I https://ukdataatlas.com/data/boundaries/<family>/<release>/<sha256>.pmtiles
curl -H 'Range: bytes=0-126' https://ukdataatlas.com/data/boundaries/<family>/<release>/<sha256>.pmtiles
```

Expect the immutable header and a 206 response with Content-Range. In the browser,
load a map, repeat the same range fetch, and confirm the second request adds no
Nginx access-log entry. Leave browser cache enabled during this check.

Build and restart the affected services as needed. The generated
API files are read at runtime; for a full data rebuild, stop the API first or
build in a separate staging checkout and switch it into place when complete.
The API drains active requests on SIGTERM.

```sh
systemctl restart uk-data-atlas-api uk-data-atlas-web
journalctl -u uk-data-atlas-api -u uk-data-atlas-web -f
```

Useful verification commands after deployment:

```sh
pnpm --dir services/api smoke https://api.ukdataatlas.com
curl -f https://ukdataatlas.com/
certbot renew --dry-run
```

Do not commit downloaded source data, generated API data, logs, credentials,
certificates or swap files. The data build compiles the website docs catalogue and place artifacts.

The website serves atlas lookups and pages from `data/build/atlas.sqlite` and
never fetches them from the API. Include `data/build/atlas-assets/` when deploying
the API, which serves the gzip files directly. Restart
the API and website in either order. On a memory-constrained local machine,
stop the API before `pnpm data:build`.

API PMTiles and map feature downloads live in `data/build/map-resources/`.
Include this directory alongside `data/build/atlas.sqlite` in API deployments.
For an asset CDN, upload it under the `map-resources/` prefix. Website builds
hard-link `data/build/boundaries/` archives into `public/data/boundaries/` for static
serving. Every website boundary release is served as PMTiles with a properties sidecar.
TopoJSON in `data/build/website-boundaries/` is a build intermediate and is not
needed by the running website. Before the first build, run `pnpm data:download` if the checkout lacks the complete pinned source release. Publication removes legacy public TopoJSON and
regional geometry chunks after validating the complete generation.
Both paths share one file on disk. These directories must be on the same
filesystem; the build fails rather than falling back to copying archives.
Deploy from the built checkout. When transferring a built tree, preserve hard links
with `rsync -aH` or recreate them with
`node --import tsx scripts/link-boundary-tiles.ts` on the destination before starting
Next.js. Re-run that command after replacing archives independently of an app build. Source release publishing still packages only `data/source/`.

### Local SQLite cache

Deploy `data/build/atlas.sqlite` and `data/build/atlas-cache.sqlite` from the
same release. The pipeline builds and stamps the cache, and `pnpm data:download`
restores both files. Compose mounts them read-only. The API checks the stamp and
required dataset payloads at startup and fails readiness if they are missing or
mismatched. It does not rebuild the cache.
