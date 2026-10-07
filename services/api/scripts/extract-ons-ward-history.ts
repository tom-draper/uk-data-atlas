import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { csvRecords } from "../src/csv";

const SOURCE_URL =
	"https://www.arcgis.com/sharing/rest/content/items/e0bc41722b1a4b76a6ecfff14f91cbb4/data";
const DIRECTORY = "ward-history/2025-12-uk";
const FILE = "ONS_Code_History_Database_June_2026.geojson";
const WARD_ENTITIES = new Set(["E05", "W05", "S13", "N08"]);

const changesCsv = (archive: string) => {
	try {
		return execFileSync("unzip", ["-p", archive, "Changes.csv"], {
			encoding: "utf8",
			maxBuffer: 100 * 1024 * 1024,
		});
	} catch (error) {
		// Some confined build runners report an execution error after `unzip`
		// has nevertheless completed successfully and returned its stdout.
		const result = error as { status?: number; stdout?: unknown };
		if (result.status === 0 && typeof result.stdout === "string")
			return result.stdout;
		throw error;
	}
};

export const extractOnsWardHistory = (
	repositoryRoot: string,
	archive: string,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const rows = csvRecords(changesCsv(archive));
	const [header, ...values] = rows;
	const columns = Object.fromEntries(
		(header ?? []).map((name, index) => [name, index]),
	);
	for (const column of [
		"GEOGCD",
		"GEOGNM",
		"GEOGCD_P",
		"GEOGNM_P",
		"OPER_DATE",
		"ENTITYCD",
	])
		if (columns[column] === undefined)
			throw new Error(`Changes.csv has no ${column} column.`);
	const features = values
		.filter((row) => WARD_ENTITIES.has(row[columns.ENTITYCD!]!))
		.map((row) => ({
			type: "Feature" as const,
			geometry: null,
			properties: {
				PREDECESSORCD: row[columns.GEOGCD_P!]!,
				PREDECESSORNM: row[columns.GEOGNM_P!]!,
				SUCCESSORCD: row[columns.GEOGCD!]!,
				SUCCESSORNM: row[columns.GEOGNM!]!,
				OPER_DATE: row[columns.OPER_DATE!]!,
				ENTITYCD: row[columns.ENTITYCD!]!,
			},
		}))
		.filter(
			(feature) =>
				feature.properties.PREDECESSORCD &&
				feature.properties.PREDECESSORNM &&
				feature.properties.SUCCESSORCD &&
				feature.properties.SUCCESSORNM &&
				feature.properties.PREDECESSORCD !==
					feature.properties.SUCCESSORCD,
		)
		.sort((left, right) =>
			`${left.properties.PREDECESSORCD}|${left.properties.SUCCESSORCD}`.localeCompare(
				`${right.properties.PREDECESSORCD}|${right.properties.SUCCESSORCD}`,
			),
		);
	const directory = join(repositoryRoot, "data", "lookups", DIRECTORY);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, FILE),
		JSON.stringify({ type: "FeatureCollection", features }),
	);
	writeFileSync(
		join(directory, "meta.json"),
		`${JSON.stringify(
			{
				id: "2025-12-uk",
				kind: "lookup",
				title: "Electoral ward predecessor and successor codes",
				description:
					"Official ONS Code History Database changes for English, Welsh, Scottish and Northern Irish electoral wards, normalised with predecessor as source and successor as target.",
				publisher: "Office for National Statistics",
				sourceUrl: SOURCE_URL,
				retrieved,
				temporalCoverage: "2009-01-01/2025-12-31",
				licence: {
					name: "Open Government Licence v3.0",
					url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
				},
				files: [
					{
						path: FILE,
						role: "source",
						note: `Extracted from Changes.csv in the ONS Code History Database; ${features.length} ward change pairs.`,
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	return { path: join(directory, FILE), rows: features.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const [archive] = process.argv.slice(2);
	if (!archive)
		throw new Error(
			"Usage: tsx scripts/extract-ons-ward-history.ts <code-history-database.zip>",
		);
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = extractOnsWardHistory(repositoryRoot, archive);
	console.log(`Wrote ${result.rows} rows to ${result.path}`);
}
