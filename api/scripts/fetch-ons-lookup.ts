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
	/**
	 * Keep only these columns, one row per distinct combination, ordered by
	 * the first. A lookup published at a finer level than it is used, such as
	 * one row per Output Area for an LSOA-to-MSOA relationship, is stored at
	 * the level used rather than committing every finer row.
	 */
	distinctColumns?: string[];
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
	if (source.distinctColumns)
		return fetchDistinct(repositoryRoot, source, layer, retrieved);
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
	return writeLookup(repositoryRoot, source, {
		features,
		sourceUrl: `${layer}/query?where=1%3D1&outFields=*&f=geojson`,
		note: `Exported from the ONS Open Geography Portal feature service, ${count} rows paged in ObjectId order.`,
		retrieved,
	});
};

/**
 * The service counts every row whatever columns are asked for, so a distinct
 * projection is paged until a short page, and each row is checked unique.
 */
const fetchDistinct = async (
	repositoryRoot: string,
	source: LookupSource,
	layer: string,
	retrieved: string,
) => {
	const columns = source.distinctColumns!;
	const query = `where=1%3D1&outFields=${columns.join(",")}&returnDistinctValues=true&orderByFields=${columns[0]}`;
	const features: Feature[] = [];
	for (let offset = 0; ; offset += PAGE) {
		const page = await fetchJson(
			`${layer}/query?${query}&resultOffset=${offset}&resultRecordCount=${PAGE}&f=geojson`,
		);
		if (!Array.isArray(page.features))
			throw new Error(
				`${source.service}: page at ${offset} has no features`,
			);
		features.push(...page.features);
		if (page.features.length < PAGE) break;
	}
	const keys = new Set(
		features.map((feature) =>
			JSON.stringify(columns.map((column) => feature.properties[column])),
		),
	);
	if (keys.size !== features.length)
		throw new Error(`${source.service}: distinct rows repeat`);
	return writeLookup(repositoryRoot, source, {
		features,
		sourceUrl: `${layer}/query?${query}&f=geojson`,
		note: `Exported from the ONS Open Geography Portal feature service as the ${features.length} distinct rows of ${columns.join(", ")}, ordered by ${columns[0]}. The finer rows the service publishes are not stored.`,
		retrieved,
	});
};

const writeLookup = (
	repositoryRoot: string,
	source: LookupSource,
	{
		features,
		sourceUrl,
		note,
		retrieved,
	}: {
		features: Feature[];
		sourceUrl: string;
		note: string;
		retrieved: string;
	},
) => {
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
				sourceUrl,
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
						note,
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	return { path: join(directory, file), rows: features.length };
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
