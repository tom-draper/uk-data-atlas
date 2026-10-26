# uk-data-atlas-client

A typed Python client for the [UK Data Atlas API](../../services/api/README.md).
Everything under `src/uk_data_atlas_client/generated/` is written by
[openapi-python-client](https://github.com/openapi-generators/openapi-python-client)
from [`services/api/openapi.yaml`](../../services/api/openapi.yaml): one typed
function and one model per route and schema. `AtlasClient` in `client.py` is a
small hand-written layer over it for the front-door questions.

It is not published to PyPI. Install it from this checkout.

## Install from source

Needs Python 3.11 or newer. From the repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install ./clients/python
```

## Ask the front-door questions

`AtlasClient()` talks to `https://api.ukdataatlas.com/v1`. Pass another base
URL to use a local server (`AtlasClient("http://127.0.0.1:3001/v1")` after
`pnpm start` in `services/api`). Each helper returns the response envelope,
whose `["data"]` is the payload and `atlas_release` names the exact build that
answered, and raises `AtlasError` on a refusal.

### What's the population of North West?

```python
from uk_data_atlas_client import AtlasClient

atlas = AtlasClient()

result = atlas.value("population", "North West")
answer = result["data"]["answer"]
print(answer["value"], answer["unit"], answer["period"])  # 7526285 people 2022
print(result["data"]["method"], result.atlas_release)
```

Leaving `period` out takes the latest, and the answer says so
(`periodDefaulted`). Ask for another with `atlas.value("population", "North
West", period="2021")`.

### Which measures are about house prices?

```python
for measure in atlas.measures("house prices")["data"]:
    print(measure["id"], "-", measure["label"])
```

### What's at this postcode?

```python
lookup = atlas.postcode("SW1A 1AA")
for result in lookup.data.results:
    print(result.geography, [match.name for match in result.matches])
```

The spec describes this route's `data`, so the result is a typed model with
attributes. A route whose spec names only the bare envelope, as `value` and
`measures` do, keeps `data` as the plain dict it arrived as.

### What went wrong, and what can I do about it?

A refusal is an exception carrying the API's problem details, with a stable
`code` to branch on. A name that means several places is one:

```python
from uk_data_atlas_client import AtlasError

try:
    atlas.value("population", "Newport")
except AtlasError as refusal:
    if refusal.code == "ambiguous_place":
        for choice in refusal.problem["choices"]:
            print(choice["place"], choice["name"])
    else:
        raise
```

Pass a `place` reference from `atlas.places("Newport")` to ask about one of them.

## Every other route

`atlas.client` is the generated `Client`. Each route is a module under
`uk_data_atlas_client.generated.api`, grouped by the API's tags, with `sync`,
`sync_detailed`, `asyncio` and `asyncio_detailed` functions. They return the
parsed model, or a `Problem` for a refusal, rather than raising.

```python
from uk_data_atlas_client.generated.api.geography import get_area

area = get_area.sync("localAuthority", "2025-12-uk-bgc", "E08000003", client=atlas.client)
```

Some responses are left out of the generated functions because the generator
has no model for them: the YAML, PMTiles and vector tile downloads, and the
CSV request bodies of `:join`, `:validate` and `:convert`. Fetch downloads from
the URLs the API links, and send those requests as JSON.

## Develop

The generated code and `../generated.lock.json` are regenerated together for
both clients, from the repository root:

```sh
pnpm --dir services/api generate:clients
```

The tests run offline against a mocked transport:

```sh
python3 -m venv .venv-test
.venv-test/bin/pip install -e './clients/python[test]'
.venv-test/bin/python -m pytest clients/python
```
