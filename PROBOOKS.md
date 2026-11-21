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
