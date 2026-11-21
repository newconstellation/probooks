# ProBooks

ProBooks is a customized copy of [Bigcapital](https://github.com/bigcapitalhq/bigcapital), an open-source accounting app.

## Where the code came from

- Upstream: `bigcapitalhq/bigcapital`, `develop` branch
- Snapshot commit: `3222415` (2026-11-21, "Merge pull request #1713 from bigcapitalhq/feat/require-item-batch-allocations")
- License: GNU AGPL v3 (see `LICENSE`). Changes we make stay under the same license. If ProBooks is ever offered to people outside the owner's own businesses over a network, they must be able to get its source code.

To pull in later upstream changes, add the upstream remote and merge from the snapshot commit onward:

```sh
git remote add upstream https://github.com/bigcapitalhq/bigcapital
git fetch upstream develop
```

## Planned changes

1. Receipt capture from a phone: photo, business, category and tax tag, saved as an expense with the image attached.
2. Later: tax prep features.

Keep the modern look and feel of the existing app in anything added.

## Hosting

ProBooks runs on one Hetzner server managed by Coolify, with the domain on Cloudflare.

- `.github/workflows/probooks-images.yml` builds the server and webapp images on every push to `main` and publishes them to `ghcr.io/newconstellation/probooks-server` and `probooks-webapp`.
- `docker-compose.coolify.yml` is the whole app. In Coolify, add it as a Public Repository resource with the Docker Compose build pack and give the `webapp` service the domain. Passwords come from Coolify's generated `SERVICE_PASSWORD_*` values, and receipt storage (Garage) sets itself up on first start.
- After the first account is created, set `SIGNUP_DISABLED=true` in Coolify so nobody else can sign up.
- To ship a change: merge to `main`, wait for the images workflow, then click Redeploy in Coolify.
