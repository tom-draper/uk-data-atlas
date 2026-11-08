# Stable ids

`atlas.sqlite` joins its tables on small integers (`area_version.id`,
`series.id`, the `release_id` columns). Those integers are assigned once, from
a registry committed in `pipeline/ids/`, so a customer's stored ids and joins
survive every rebuild. They used to be positions in an inventory or
declaration list, so adding one release shifted every later id.

## The rule

An id is never changed, reused or removed. A key the registry has not met
takes the next id. A key the build no longer produces keeps its id, unused.

## Public keys

Use the natural key to identify a row outside the database, and the integer
inside it.

| Id                                            | Natural key                                                |
| --------------------------------------------- | ---------------------------------------------------------- |
| `area_releases.id` (the `release_id` columns) | `(geography, release)`                                     |
| `geography.id`                                | `slug`                                                     |
| `area.id`                                     | `(geography, code)`                                        |
| `area_version.id`                             | `(geography, release, code)`                               |
| `crosswalk.id`                                | `slug`                                                     |
| `source.id`                                   | `(publisher, url, licence)`                                |
| `dataset.id`, `measure.id`, `dimension.id`    | `slug`                                                     |
| `dimension_member.id`                         | `(dimension slug, code)`                                   |
| `period.id`                                   | `label`                                                    |
| `series.id`                                   | `key`                                                      |
| `election.id`                                 | `(dataset slug, label)`                                    |
| `contest.id`                                  | `(dataset slug, election label, geography, release, code)` |
| `party.id`                                    | `code`                                                     |
| `status.id`                                   | `slug`; a fixed list in `STATUSES`, only ever appended to  |

Each natural key is unique and indexed. For an area, `v_area_version` gives it
in one place:

```sql
SELECT area_version_id FROM v_area_version
WHERE geography = 'ward' AND release = '2024-12-uk-bgc' AND code = 'E05000026';
```

An edge has no id of its own. It is `(crosswalk_id, from_version_id,
to_version_id)`, stable because its three parts are.

## Order is not the id

An id no longer follows the order of the inventory, so order is stored:

- `area_releases.inventory_position`: the release's place in the area inventory.
- `area_version.inventory_position`: the area's place in its release's
  artifact. Null where `in_inventory` is 0.
- `crosswalk.inventory_position`: the crosswalk's place in the crosswalk
  inventory.

Read these, not the id, to put rows in the order the artifacts have. `series`
has no order column: nothing reads its order beyond a stable tie-break, so
`ORDER BY id` is the order series were first met.

## The registry files

`pipeline/ids/` holds one registry per namespace. Each line that is not a
directive is the last field of one key, and takes the id after the line before
it, from the namespace's first id (0 for releases and crosswalks, 1 for the
rest). A `@` line sets the other fields of the keys after it (tab separated),
which keeps a release's codes to a code and a newline each. An `=N` line sets
the id of the next key, where a file does not continue the one before.

The small namespaces are one file each, `pipeline/ids/measure.txt`, and only
ever have lines added at the end. The two large ones are directories of files
that are each written once and never changed, so a new release adds files and
touches none:

```text
pipeline/ids/area-version/<geography>/<release>.txt   (the release's areas)
pipeline/ids/area/<geography>/<release>.txt           (areas that release first had)
```

Keys met later for a release that has a file go to a new file beside it,
`<release>+<first id>.txt`. The files together must hold every id from the
first to the last exactly once, so a deleted or copied file fails at load.
There are 214 files today.

## How the build uses the registry

`atlas-sqlite` reads the registries, gives every key its id, writes the tables,
then checks that every id in the database is the one the registry gives its
key (`verifyStableIds`) before it writes the new keys to the files.
`assemble-atlas` does the same for the areas that only a postcode lookup names.
The build fails when

- a registry lists a key twice, has a blank line, a key with the wrong number
  of fields, or ids missing or given twice;
- an id in the database is not the registry's, or an id is already in use;
- the registry is missing but a database with ids exists, because a rebuild
  would renumber it;
- the registry files changed while the build ran (another build added ids);
- `ATLAS_IDS_FROZEN=1` and the build meets a key the registry lacks.

The registries are not inputs of the build stages. A build appends to them, so
making them inputs would rerun the stage after every extension. A registry
edited by hand is found by `ids check` and `ids verify`, not by a rebuild.

## Building a release

New keys must be added by an ordinary local build, and committed, before the
release is built:

1. Build locally (`pnpm data:build`). Any key the registries lack is added to
   `pipeline/ids`.
2. Check and commit it: `pnpm ids check --base origin/main`, then commit the
   new files and lines.
3. Build the release with `ATLAS_IDS_FROZEN=1`. It refuses any key the
   committed registry lacks, so no id is assigned that nobody committed.

## Before merging to main

The registries were seeded from a local build, which may not be the file
customers hold. Check the deployed `atlas.sqlite` (on the VPS) against them:

```sh
pnpm ids verify /path/to/deployed/atlas.sqlite
```

It reads either layout of `area_releases`. If it reports a mismatch, the
registry is not that file's: empty `pipeline/ids` and run `pnpm ids seed` on
the deployed file, then `pnpm ids verify` again. No API route returns these ids,
so a reseed from the deployed file is safe.

## Commands

```sh
pnpm ids check [--base REF]  # valid, and unchanged since REF (default HEAD)
pnpm ids verify DATABASE      # every id in a database against the registry
pnpm ids seed DATABASE        # start empty registries from a database's ids
```

`ids check` requires a small registry to have only lines added at its end, and
every file of a segmented one that is in REF to be there, byte for byte the
same. `pnpm check` runs it against `HEAD`. CI runs it against the pull
request's base branch, fetched shallowly.

## Seeding

`pipeline/ids` was seeded with `pnpm ids seed` from the 4 November 2026 build,
so every id in that build is the registry's. Keys added to the data since take
ids above them. The seed writes one file per release, with the areas a crosswalk
or postcode lookup named, and which no release lists, in the file of the release
they were named for.

## What is not covered

These are internal layout. Do not store or join on them.

- `postcode_area_releases.position` and `postcode_area_set.id` number the
  postcode lookup's own layout (manifest order and first-seen postcode), not
  entities. Join through `area_version` instead.
- `position` columns that order the rows of one parent (`candidacy.position`,
  `dimension_member.position`, `named_location_*.position`).
- Ids in `atlas-cache.sqlite`, which is rebuilt from `atlas.sqlite`.
