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
pnpm data:download
pnpm --dir services/api build
```

Then build the website from the same checkout. It does not need the API
running:

```sh
pnpm data:compile --target website
pnpm build
```

The build order is raw data download, API data and runtime build, website
website data build, then website build. Run these steps serially.
The API build also checks the source release pinned by `data-release.json` and
writes generated catalogues to `services/api/public/` and the terrain catalogue
payload to `compiled/atlas.sqlite`. Keep `compiled/atlas.sqlite` under the repository
root when deploying either server. Both read it in read-only mode.
`pnpm data:compile --target website` builds missing or stale dependencies, copies
the atlas lookups and pages from the API's build output with `pnpm atlas-data:copy`, then writes browser data to `public/data/`.
Neither output directory is tracked in Git.
`pnpm build` copies the atlas lookups and pages again, verifies local
precompiled data, generates map headlines and rankings with `pnpm seo:build`,
then runs Next.js. A nonzero
exit from any command means that step failed; stop before the next step.
Keep `services/api/public/atlas-releases/` on persistent storage during updates.
The build writes an initial atlas manifest before evidence documents, then
writes the final manifest afterwards so a fresh build has the required inputs.

`pnpm --dir services/api build:data` runs `pnpm data:compile --target api`.
`pnpm data:compile --target website` runs only the stages the website's data
needs, ending with the website's datasets, and `pnpm data:compile` runs both.
Stages whose inputs and outputs are unchanged since they last ran are skipped
(see "One data build" in `ARCHITECTURE.md`); add `--no-cache` to run them all.
To inspect the complete local data build without executing commands, run:

```sh
pnpm data:compile --plan
```

After a complete build, rebuild a named stage and every affected downstream
stage with `--from`. Preview the selection before running it:

```sh
pnpm --dir services/api build:data --from crosswalk-inventory --plan
pnpm --dir services/api build:data --from crosswalk-inventory
```

Stage names appear in the plan alongside their commands and dependencies.
`--from` reuses existing upstream artifacts and leaves unrelated stages out.
Downloads run only when you select `download` or run the complete build.
If upstream inputs changed, select their stage instead, or run
`pnpm --dir services/api build:data` for the complete build.
The runner executes serially and stops at the first failure. Compilers retain
their existing artifact reuse checks. Existing per-stage scripts still work,
but only `build:data --from` also regenerates affected downstream artifacts.

`atlas-release-initial` writes the manifest consumed by evidence documents.
`documents` rebuilds those documents and then the downstream `atlas-release`
stage pins them in the final manifest. Both manifest stages use the existing
`build:atlas-release` script. `atlas-pages` compiles the website place profiles, facts and docs catalogue.
The `datasets` stage runs after `download` and compiles every catalogue dataset
once into `compiled/datasets/`, for both products (see `compiled/README.md`).
`atlas-sqlite` stores catalogue payloads in `compiled/atlas.sqlite` for the
API catalogue compiler, atlas pages and Next.js dataset route. `api-datasets` builds gazetteer core
and boundary assets under `services/api/public/source-data/` for named
locations and atlas pages. The API build does not need website output in
`public/data/`.

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

## DNS, Nginx and HTTPS

Point all three hostnames at the server (currently `128.140.0.185`); configure
AAAA only when IPv6 reaches this host. Permit TCP 22, 80 and 443 through UFW,
including the active SSH port before enabling the firewall. Keep Node ports
3000 and 3001 private. The current host also runs Fail2ban for SSH.

`nginx.conf` mirrors the live default site. It belongs in
`/etc/nginx/sites-available/default` with the standard sites-enabled symlink.
`atlas-tls.conf` belongs in `/etc/nginx/snippets/atlas-tls.conf`.

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

Build the intended revision, then restart the affected service. The generated
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
certificates or swap files. The API build compiles the website docs catalogue and place artifacts.

The website serves its own copy of the atlas lookups and pages from
`public/data/` and never fetches from the API. Restart
the API and website in either order. On a memory-constrained local machine,
stop the API before `pnpm data:compile --target website`.
