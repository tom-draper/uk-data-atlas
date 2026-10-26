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

## Regenerate

```sh
pnpm --dir services/api generate:clients
```

This rewrites `typescript/src/generated/`, `python/src/uk_data_atlas_client/generated/`
and `generated.lock.json`. Never edit generated files by hand. The generator
versions are pinned in `typescript/package.json` and
`python/requirements-generate.txt`. The Python generator runs in a virtualenv
at `python/.venv`, which the command creates.

`openapi-python-client` cannot read a few constructs the spec uses (string
`const`, an untitled inline enum, inline download maps), so
`python/prepare_spec.py` derives a Python-friendly copy of the spec first.
`openapi.yaml` is not changed.

## Generated code is committed

Reviewers see what a spec change does to callers, and users can install from a
checkout without running a generator. The cost is that the code can go stale.
Two checks prevent that:

- `pnpm --dir services/api generate:clients --check` regenerates both clients
  in a scratch directory and compares them with the committed ones.
- `tests/clients/generatedClients.test.ts` runs in `pnpm check`. It needs
  neither the API, its data nor Python. `generated.lock.json` records digests
  of the spec, the generation tooling and each generated tree, and the test
  fails when any of them moves without a regeneration. It also re-runs
  `openapi-typescript` and compares the types.
