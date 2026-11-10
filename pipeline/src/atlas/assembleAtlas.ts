import { statisticsReadPathTables } from "../storage/statisticsReadPathTables.ts";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import type { StatisticsReadPath } from "@uk-data-atlas/measures";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	artifactDirectory,
	closeReadOnlyDatabase,
	packText,
	unpackText,
} from "@uk-data-atlas/atlas-db";
import { publishVacuumed, writePostcodeAreas } from "../storage/index.ts";
import { crosswalkSetHash } from "../crosswalk-weights/crosswalkSetHash.ts";
import { crosswalkWeightsPath } from "../crosswalk-weights/paths.ts";
import { convertedSeriesPath } from "../conversion/paths.ts";
import { copyConvertedSeries } from "../conversion/storeConverted.ts";
import type { PostcodeAreasArtifact } from "@uk-data-atlas/geography";
import {
	postcodeAreasDirectory,
	readPostcodeAreaComponent,
} from "../postcodes/storePostcodeAreas.ts";
import { loadIdRegistries } from "../ids/idRegistries.ts";
import { geographyCatalogues } from "@uk-data-atlas/areas";
import { readJsonSync } from "../lib/json.ts";

/**
 * `crosswalkWeights: false` leaves crosswalks with only their own weights, for
 * fixtures whose roots hold no census counts and place no real releases. The
 * converted series are built through those weights, so they go with them.
 */
export function assembleAtlas(
	root: string,
	{
		crosswalkWeights = true,
		convertedSeries = crosswalkWeights,
	}: { crosswalkWeights?: boolean; convertedSeries?: boolean } = {},
) {
	const directory = join(root, "data/build");
	const path = join(directory, "atlas.sqlite");
	const components = [
		join(directory, "atlas-base.sqlite"),
		join(directory, "postcode-index.sqlite"),
	] as const;
	for (const component of components)
		if (!existsSync(component))
			throw new Error(`Missing atlas component ${component}`);
	const payloads = readJsonSync(
		join(directory, "geography-payloads.json"),
	) as Array<{ id: string; payload: string }>;
	const postcodeAreas = readJsonSync(
		join(postcodeAreasDirectory(root), "manifest.json"),
	) as PostcodeAreasArtifact;
	// The areas that only a postcode lookup names take ids here, so these
	// registries are the ones the base database was built with.
	const ids = loadIdRegistries(root);
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		copyFileSync(components[0], temporary);
		const database = new DatabaseSync(temporary);
		try {
			database
				.prepare("ATTACH DATABASE ? AS postcode_component")
				.run(components[1]);
			if (crosswalkWeights)
				database
					.prepare("ATTACH DATABASE ? AS weights_component")
					.run(crosswalkWeightsPath(root));
			if (convertedSeries)
				database
					.prepare("ATTACH DATABASE ? AS converted_component")
					.run(convertedSeriesPath(root));
			database.exec(
				"PRAGMA foreign_keys = OFF; PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; BEGIN",
			);
			const insertStored = database.prepare(
				"INSERT OR REPLACE INTO payloads (id, payload) VALUES (?, ?)",
			);
			const insertPayload = (id: string, text: string) =>
				insertStored.run(id, packText(text));
			for (const { id, payload } of payloads) insertPayload(id, payload);
			writeSqliteTables(
				database,
				statisticsReadPathTables(
					readJsonSync(
						join(directory, "statistics-read-path.json"),
					) as StatisticsReadPath,
				),
			);
			const postcode = database
				.prepare(
					"SELECT payload FROM postcode_component.payloads WHERE id = 'postcode-index'",
				)
				.get();
			if (!postcode) throw new Error("Missing postcode index payload");
			const schema = database
				.prepare(
					"SELECT sql FROM postcode_component.sqlite_schema WHERE type = 'table' AND name = 'postcodes'",
				)
				.get();
			if (!schema?.sql) throw new Error("Missing postcode index table");
			database.exec(String(schema.sql));
			database.exec(
				"INSERT INTO main.postcodes SELECT * FROM postcode_component.postcodes",
			);
			insertPayload("postcode-index", unpackText(postcode.payload)!);
			database.exec("COMMIT; PRAGMA foreign_keys = ON; BEGIN");
			writePostcodeAreas(
				database,
				postcodeAreas,
				(name) => readPostcodeAreaComponent(root, name),
				ids,
			);
			insertPayload("postcode-areas", JSON.stringify(postcodeAreas));
			if (crosswalkWeights) {
				const component = database
					.prepare(
						"SELECT value FROM weights_component.meta WHERE key = 'crosswalk_inventory_hash'",
					)
					.get();
				if (component?.value !== crosswalkSetHash(database))
					throw new Error(
						"The crosswalk weights were computed for other crosswalks: rebuild crosswalk-weights",
					);
				// The crosswalks' own weights stay; these are the bases beside them.
				database.exec(
					"INSERT INTO main.crosswalk_weight SELECT * FROM weights_component.crosswalk_weight",
				);
			}
			// Every converted series is marked as one, and none of its values
			// as observed, or the copy fails.
			if (convertedSeries) copyConvertedSeries(database, ids);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		// The build's one vacuum of atlas.sqlite: written once beside the
		// release, then renamed over it.
		publishVacuumed(temporary, path, {
			// Readers in this process must not keep the file about to be replaced.
			beforeReplace: () => closeReadOnlyDatabase(path),
		});
		ids.save();
	} finally {
		rmSync(temporary, { force: true });
	}
	for (const id of geographyCatalogues)
		rmSync(join(artifactDirectory(root), `${id}.json`), { force: true });
	const publicRoot = artifactDirectory(root);
	for (const name of ["postcodes", "postcode-areas"])
		rmSync(join(publicRoot, name), { recursive: true, force: true });
	for (const filename of [
		"postcode-index.json",
		"postcode-index.json.gz",
		"postcode-areas.json",
		"postcode-areas.json.gz",
	])
		rmSync(join(publicRoot, filename), { force: true });
	for (const name of ["atlas-lookups", "atlas-pages", "precompiled"])
		rmSync(join(root, "public/data", name), {
			recursive: true,
			force: true,
		});
	return path;
}
