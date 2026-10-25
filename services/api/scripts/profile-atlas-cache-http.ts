import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [source, output, apiRoot = "services/api"] = process.argv.slice(2);
if (!source || !output)
	throw new Error(
		"Usage: profile-atlas-cache-http.ts SOURCE_ROOT OUTPUT.json [API_ROOT]",
	);
const { readApiCatalogues, createApiServer } = await import(
	pathToFileURL(resolve(source, "services/api/src/server.ts")).href
);
const start = performance.now();
const context = readApiCatalogues(resolve(apiRoot), {
	loadEvidenceDocuments: false,
});
const server = createApiServer(context);
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const startupMs = performance.now() - start;
const address = server.address();
if (!address || typeof address === "string") throw Error("No listening port");
const routes = [
	"/v1/areas?limit=5",
	"/v1/areas?geography=ward&limit=5",
	"/v1/places?q=Manchester",
	"/v1/places?q=Ynys%20Mon",
	"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000003",
	"/v1/locations/greater-manchester/members?release=2023-05-uk-bgc-v2",
	"/v1/postcodes/M11AA",
	"/v1/postcodes/SW1A1AA?view=compact",
	"/v1/data/population?geography=localAuthority",
	"/v1/data/population/value?place=Manchester",
	"/v1/crosswalks",
	"/v1/locations?limit=5",
];
const results = [];
try {
	for (const route of routes) {
		const start = performance.now();
		const response = await fetch(
			`http://127.0.0.1:${address.port}${route}`,
			{ headers: { "accept-encoding": "identity" } },
		);
		const body = Buffer.from(await response.arrayBuffer());
		results.push({
			route,
			status: response.status,
			bytes: body.length,
			hash: createHash("sha256").update(body).digest("hex"),
			etag: response.headers.get("etag"),
			milliseconds: performance.now() - start,
		});
		if (response.status !== 200)
			throw Error(`${route}: ${body.toString()}`);
	}
	writeFileSync(
		output,
		JSON.stringify(
			{ startupMs, rss: process.memoryUsage().rss, results },
			null,
			2,
		) + "\n",
	);
} finally {
	await new Promise<void>((done, reject) =>
		server.close((error?: Error) => (error ? reject(error) : done())),
	);
}
