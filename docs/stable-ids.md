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

| Id                                                 | Natural key                                                |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `area_releases.position` (the `release_id` column) | `(geography, id)`                                          |
| `geography.id`                                     | `slug`                                                     |
| `area.id`                                          | `(geography, code)`                                        |
| `area_version.id`                                  | `(geography, release, code)`                               |
| `crosswalk.id`                                     | `slug`                                                     |
| `source.id`                                        | `(publisher, url, licence)`                                |
| `dataset.id`, `measure.id`, `dimension.id`         | `slug`                                                     |
| `dimension_member.id`                              | `(dimension slug, code)`                                   |
| `period.id`                                        | `label`                                                    |
| `series.id`                                        | `key`                                                      |
| `election.id`                                      | `(dataset slug, label)`                                    |
| `contest.id`                                       | `(dataset slug, election label, geography, release, code)` |
| `party.id`                                         | `code`                                                     |
| `status.id`                                        | `slug`; a fixed list in `STATUSES`, only ever appended to  |

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

## How the build uses the registry

`pipeline/ids/<namespace>.txt` lists a namespace's keys. The key on line N
below the header is id `first + N - 1` (`first` is 0 for releases and
crosswalks, 1 for the rest). Lines are only ever added at the end. A line
holds the last field of a key; a `@` line sets the other fields (tab
separated) for the lines after it, which keeps a release's codes to a code and
a newline each.

`atlas-sqlite` reads the registries, gives every key its id, writes the tables,
then checks that every id in the database is the one the registry gives its
key (`verifyStableIds`) before it appends the new keys to the files.
`assemble-atlas` does the same for the areas that only a postcode lookup names.
The build fails when

- a registry lists a key twice, has a blank line, or a key with the wrong
  number of fields;
- an id in the database is not the registry's, or an id is already in use;
- the registry is missing but a database with ids exists, because a rebuild
  would renumber it;
- `ATLAS_IDS_FROZEN=1` and the build meets a key the registry lacks.

Commit the lines a build adds. `ATLAS_IDS_FROZEN=1` is for a build that must
not change them, such as one on a server.

## Commands

```sh
pnpm ids check [--base REF]  # valid, and only added to since REF (default HEAD)
pnpm ids verify DATABASE      # every id in a database against the registry
pnpm ids seed DATABASE        # start empty registries from a database's ids
```

`pnpm check` runs `ids check`. In review, `pnpm ids check --base origin/main`
shows a registry that was rewritten rather than extended.

## Seeding

`pipeline/ids` was seeded with `pnpm ids seed` from the 4 November 2026 build,
so every id in that build is the registry's. Keys added to the data since take
ids above them. To seed from another database, empty `pipeline/ids` first, and
only if no database built from the old files is still in use.

## What is not covered

- `postcode_area_releases.position` and `postcode_area_set.id` number the
  postcode lookup's own layout (manifest order and first-seen postcode), not
  entities. Join through `area_version` instead.
- `position` columns that order the rows of one parent (`candidacy.position`,
  `dimension_member.position`, `named_location_*.position`).
- Ids in `atlas-cache.sqlite`, which is rebuilt from `atlas.sqlite`.
