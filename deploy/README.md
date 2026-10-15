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
pnpm --dir services/api build
pnpm build
```

The API build downloads the source release pinned by `data-release.json` and
writes generated catalogues to `services/api/public/`. The website build
requires the pinned precompiled data to be available; if verification reports
missing precompiled artifacts, run `pnpm precompile` before `pnpm build`.
Keep `services/api/public/atlas-releases/` on persistent storage during updates.
The build writes an initial atlas manifest before evidence documents, then
writes the final manifest afterwards so a fresh build has the required inputs.

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
certificates or swap files. The generated website docs catalogue is tracked.
