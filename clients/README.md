# API clients

Typed clients for the [UK Data Atlas API](../services/api/README.md), generated
from [`services/api/openapi.yaml`](../services/api/openapi.yaml).

| Client                   | Generator                                                                                                                    | Install and usage              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| [TypeScript](typescript) | [`openapi-typescript`](https://openapi-ts.dev) types and [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) at runtime | [README](typescript/README.md) |
| [Python](python)         | [`openapi-python-client`](https://github.com/openapi-generators/openapi-python-client)                                       | [README](python/README.md)     |

Each has a small hand-written wrapper over the front-door routes (`places`,
`measures`, `postcode`, `value`, `series`) that returns the response envelope
and raises one error type carrying the problem `code`. Every other route is
reachable through the generated code.

Neither package is published. The website and the API do not depend on them.

## Generate

The generated code is not committed. Both directories are ignored by Git:
`typescript/src/generated/` and `python/src/uk_data_atlas_client/generated/`.

```sh
pnpm clients:generate              # both clients
pnpm clients:generate:typescript   # the TypeScript types only, about a second
```

`pnpm typecheck` runs the TypeScript step first, so CI and `pnpm check` need no
other setup. The Python step needs `python3` and network access the first time:
it creates a virtualenv at `python/.venv` and installs the pinned generator
from `python/requirements-generate.txt`. Neither step needs the API or its
data. The generator versions are pinned in `typescript/package.json` and
`python/requirements-generate.txt`. Never edit generated files; they are
overwritten.

`openapi-python-client` cannot read a few constructs the spec uses (string
`const`, an untitled inline enum, inline download maps), so
`python/prepare_spec.py` derives a Python-friendly copy of the spec first.
`openapi.yaml` is not changed.

## What is committed

Only the hand-written parts: the READMEs, `typescript/src/index.ts`,
`python/src/uk_data_atlas_client/client.py`, the package metadata, the Python
generator's `config.yaml` and `prepare_spec.py`, the pinned requirements, the
Python tests, and `scripts/`. A change to `openapi.yaml` therefore changes no
file under `clients/`, and the generated code cannot go stale in the
repository.

## Release

The manual [`Release API clients`](../.github/workflows/clients-release.yml)
workflow generates both clients from the commit it runs on, typechecks and
tests them, and attaches an npm tarball and a Python wheel and sdist to the
run. Publishing to npm and PyPI is left as a commented TODO in the workflow,
because both packages are still private.
