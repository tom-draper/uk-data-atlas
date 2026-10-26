# @uk-data-atlas/client

A typed TypeScript client for the [UK Data Atlas API](../../services/api/README.md).
`src/generated/schema.ts` is written by
[openapi-typescript](https://openapi-ts.dev) from
[`services/api/openapi.yaml`](../../services/api/openapi.yaml): the path,
parameter and response types of every route. Requests go through
[openapi-fetch](https://openapi-ts.dev/openapi-fetch/), a 6 kB wrapper around
`fetch`, so there is no generated runtime code. `src/index.ts` is a small
hand-written layer over it for the front-door questions.

It is not published to npm. Install it from this checkout.

## Install from source

Needs Node 20 or newer. Build the package and install the tarball into your
project:

```sh
pnpm install
pnpm --dir clients/typescript build
pnpm --dir clients/typescript pack --pack-destination /tmp
npm install /tmp/uk-data-atlas-client-0.1.0.tgz   # in your project
```

Inside this repository the package is a workspace package, so code here can
import `@uk-data-atlas/client` after declaring `"@uk-data-atlas/client":
"workspace:*"`.

## Ask the front-door questions

`createAtlasClient()` talks to `https://api.ukdataatlas.com/v1`. Pass
`baseUrl` to use another server, such as `http://127.0.0.1:3001/v1` after
`pnpm start` in `services/api`. Each helper returns the response envelope,
`{ data, atlasRelease, meta }`, and throws an `AtlasError` on a refusal.

### What's the population of North West?

```ts
import { createAtlasClient } from "@uk-data-atlas/client";

const atlas = createAtlasClient();

const { data, atlasRelease } = await atlas.value("population", "North West");
const { answer } = data as {
	answer: { value: number; unit: string; period: string };
};
console.log(answer.value, answer.unit, answer.period); // 7526285 people 2022
console.log(atlasRelease); // the build that answered
```

Leaving `period` out takes the latest, and the answer says so
(`periodDefaulted`). Ask for another with
`atlas.value("population", "North West", { period: "2021" })`.

### Which measures are about house prices?

```ts
const { data } = await atlas.measures("house prices");
for (const measure of data as { id: string; label: string }[])
	console.log(measure.id, "-", measure.label);
```

### What's at this postcode?

```ts
const lookup = await atlas.postcode("SW1A 1AA");
for (const result of lookup.data?.results ?? [])
	console.log(
		result.geography,
		result.matches.map((match) => match.name),
	);
```

The spec describes this route's `data`, so it is fully typed. A route whose
spec names only the bare envelope, as `value` and `measures` do, types `data`
as `unknown`, which is why the first two examples say what they expect.

### What went wrong, and what can I do about it?

A refusal is an `AtlasError` carrying the API's problem details, with a stable
`code` to branch on. A name that means several places is one:

```ts
import { AtlasError } from "@uk-data-atlas/client";

try {
	await atlas.value("population", "Newport");
} catch (error) {
	if (error instanceof AtlasError && error.code === "ambiguous_place")
		for (const choice of error.problem?.choices ?? []) console.log(choice); // { place, name, geography, code, ask, ... }
	else throw error;
}
```

Pass a `place` reference from `atlas.places("Newport")` to ask about one of them.

## Every other route

`atlas.client` is the typed [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
client. Paths, parameters and responses are checked against the spec, and it
returns `{ data, error, response }` rather than throwing:

```ts
const { data, error } = await atlas.client.GET(
	"/areas/{geography}/{release}/{code}",
	{
		params: {
			path: {
				geography: "localAuthority",
				release: "2025-12-uk-bgc",
				code: "E08000003",
			},
		},
	},
);
```

The types are also exported as `paths`, `components` and `operations`.

## Develop

`src/generated/` and `../generated.lock.json` are regenerated together with the
Python client, from the repository root:

```sh
pnpm --dir services/api generate:clients
```

`pnpm typecheck` checks this package with the rest of the repository. Its
tests are in [`tests/clients`](../../tests/clients).
