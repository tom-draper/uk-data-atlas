import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Download an ONS Open Geography Portal lookup table as GeoJSON, with the
 * meta.json every source under data/ carries. The feature service returns at
 * most a thousand rows a request, so the table is paged in ObjectId order and
 * written in that order, which keeps a re-download byte-identical when the
 * publisher has not changed it.
 */
const SERVICES =
	"https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services";
const PAGE = 1000;

export type LookupSource = {
	service: string;
	/** Directory under data/lookups, such as `local-authority-to-county/2025-04-uk`. */
	directory: string;
	title: string;
	description: string;
	temporalCoverage: string;
};

type Feature = { properties: Record<string, unknown> };

const fetchJson = async (url: string) => {
	for (let attempt = 1; ; attempt += 1) {
		const response = await fetch(url);
		if (response.ok) return (await response.json()) as Record<string, any>;
		if (attempt === 3)
			throw new Error(
				`${response.status} ${response.statusText} for ${url}`,
			);
		await new Promise((done) => setTimeout(done, attempt * 2000));
	}
};

export const fetchOnsLookup = async (
	repositoryRoot: string,
	source: LookupSource,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const layer = `${SERVICES}/${source.service}/FeatureServer/0`;
	const { count } = await fetchJson(
		`${layer}/query?where=1%3D1&returnCountOnly=true&f=json`,
	);
	if (typeof count !== "number")
		throw new Error(`${source.service}: no row count`);
	const features: Feature[] = [];
	for (let offset = 0; offset < count; offset += PAGE) {
		const page = await fetchJson(
			`${layer}/query?where=1%3D1&outFields=*&orderByFields=ObjectId&resultOffset=${offset}&resultRecordCount=${PAGE}&f=geojson`,
		);
		if (!Array.isArray(page.features))
			throw new Error(
				`${source.service}: page at ${offset} has no features`,
			);
		features.push(...page.features);
	}
	if (features.length !== count)
		throw new Error(
			`${source.service}: expected ${count} rows, received ${features.length}`,
		);
	const directory = join(repositoryRoot, "data", "lookups", source.directory);
	mkdirSync(directory, { recursive: true });
	const file = `${source.service}.geojson`;
	writeFileSync(
		join(directory, file),
		JSON.stringify({ type: "FeatureCollection", features }),
	);
	writeFileSync(
		join(directory, "meta.json"),
		`${JSON.stringify(
			{
				id: source.directory.split("/").at(-1),
				kind: "lookup",
				title: source.title,
				description: source.description,
				publisher: "Office for National Statistics",
				sourceUrl: `${layer}/query?where=1%3D1&outFields=*&f=geojson`,
				retrieved,
				temporalCoverage: source.temporalCoverage,
				licence: {
					name: "Open Government Licence v3.0",
					url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
				},
				files: [
					{
						path: file,
						role: "source",
						note: `Exported from the ONS Open Geography Portal feature service, ${count} rows paged in ObjectId order.`,
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	return { path: join(directory, file), rows: count };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const [sourcesPath] = process.argv.slice(2);
	if (!sourcesPath)
		throw new Error(
			"Usage: tsx scripts/fetch-ons-lookup.ts <sources.json>",
		);
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const { readFileSync } = await import("node:fs");
	const sources = JSON.parse(
		readFileSync(sourcesPath, "utf8"),
	) as LookupSource[];
	for (const source of sources) {
		const { path, rows } = await fetchOnsLookup(repositoryRoot, source);
		console.log(`Wrote ${rows} rows to ${path}`);
	}
}
