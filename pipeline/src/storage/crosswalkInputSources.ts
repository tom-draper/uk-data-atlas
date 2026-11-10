import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { IdRegistries } from "../ids/idRegistries.ts";
import { onspdEdition } from "../crosswalk-weights/atoms.ts";

/** Inputs used to construct postcode atoms, including their placement and counts. */
export function weightInputPaths(root: string): string[] {
	const edition = relative(join(root, "data/source"), onspdEdition(root));
	return [
		`${edition}/onspd-permitted.csv.gz`,
		`${edition}/onspd-output-areas.csv.gz`,
		"demographics/census-2021-small-area/ts001/census2021-ts001-oa.csv",
		"demographics/census-2021-small-area/ts003/census2021-ts003-oa.csv",
		"demographics/population/census-2022-scotland-output-area/outputarea2022_usualresidentpopulation.csv",
		"demographics/population/census-2022-scotland-output-area/census_2022_UV406_Household_size_OA.csv",
		"geography/population-weighted-centroids/oa-2021-ew-v4/oa-2021-ew-pwc.csv",
		"geography/population-weighted-centroids/oa-2022-sc/oa-2022-sc-pwc.csv",
		"lookups/output-area-to-lsoa/2021-12-ew/OA_LSOA_MSOA_EW_DEC_2021_LU_v3.geojson",
		"housing/council-tax-stock/2026/CTSOP1_1_2026_03_31.csv",
	];
}

type Metadata = {
	publisher: string;
	sourceUrl: string;
	licence: { name: string; url?: string };
	attribution?: string[];
};
function inputMetadata(root: string, input: string): Metadata {
	const base = join(root, "data/source");
	let directory = dirname(join(base, input));
	while (directory.startsWith(`${base}/`)) {
		const path = join(directory, "meta.json");
		if (existsSync(path)) {
			const meta = JSON.parse(readFileSync(path, "utf8")) as Metadata;
			if (!meta.publisher || !meta.sourceUrl || !meta.licence?.name)
				throw new Error(`Incomplete source metadata: ${path}`);
			return meta;
		}
		directory = dirname(directory);
	}
	throw new Error(`No source metadata for ${input}`);
}

/** Source inputs used in population overlap and the postcode atom calculation. */
export function crosswalkInputSourceTables(
	root: string,
	ids: IdRegistries,
): Record<string, SqliteTable> {
	return {
		crosswalk_input_source: {
			strict: true,
			columns: [
				"input TEXT NOT NULL",
				"source_id INTEGER NOT NULL REFERENCES source(id)",
			],
			key: ["input"],
			rows: function* (db) {
				const inputs = new Set(weightInputPaths(root));
				for (const row of db
					.prepare("SELECT header FROM crosswalk")
					.iterate()) {
					const p = JSON.parse(String(row.header)).provenance;
					if (typeof p?.population?.input === "string")
						inputs.add(p.population.input);
				}
				const insert = db.prepare(
					"INSERT OR IGNORE INTO source (id, publisher, url, licence, licence_url, citation) VALUES (?, ?, ?, ?, ?, ?)",
				);
				const associate = db.prepare(
					"INSERT OR IGNORE INTO source_licence VALUES (?, ?)",
				);
				for (const input of [...inputs].sort()) {
					const meta = inputMetadata(root, input);
					const id = ids.source.assign(
						JSON.stringify([
							meta.publisher,
							meta.sourceUrl,
							meta.licence.name,
						]),
					);
					insert.run(
						id,
						meta.publisher,
						meta.sourceUrl,
						meta.licence.name,
						meta.licence.url ?? null,
						meta.attribution?.join("\n") ?? null,
					);
					if (meta.licence.name === "Open Government Licence v3.0")
						associate.run(id, "ogl-3.0");
					else if (meta.licence.name === "Open Parliament Licence")
						associate.run(id, "open-parliament");
					else
						throw new Error(
							`Unclassified crosswalk input licence ${meta.licence.name}: ${input}`,
						);
					yield [input, id];
				}
			},
		},
		crosswalk_count_source: {
			strict: true,
			columns: [
				"crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id)",
				"input TEXT NOT NULL REFERENCES crosswalk_input_source(input)",
			],
			key: ["crosswalk_id", "input"],
			rows: function* (db) {
				const atoms = weightInputPaths(root);
				for (const row of db
					.prepare("SELECT id, method, header FROM crosswalk")
					.iterate()) {
					const provenance = JSON.parse(
						String(row.header),
					).provenance;
					const inputs =
						row.method === "postcode-overlap"
							? atoms
							: typeof provenance?.population?.input === "string"
								? [provenance.population.input]
								: [];
					for (const input of inputs) yield [row.id as number, input];
				}
			},
		},
	};
}
