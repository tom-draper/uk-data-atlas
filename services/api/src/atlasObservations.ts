import { observationArtifactName, type DataCatalog } from "./dataCatalog";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "./contentHash";

export const observationDatabasePath = (apiRoot: string) =>
	resolve(apiRoot, "../../data/build/atlas.sqlite");

/** Read the small inventory without loading observation payloads. */
export function readObservationInventory(path: string) {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		if (
			!database
				.prepare(
					"SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'observation_catalogue'",
				)
				.get()
		)
			throw new Error(
				"Missing SQLite observation catalogue. Run pnpm data:build --from data-catalog.",
			);
		const metadata = database
			.prepare(
				"SELECT dataCatalogHash, generationHash FROM observation_catalogue",
			)
			.get();
		if (
			typeof metadata?.dataCatalogHash !== "string" ||
			typeof metadata?.generationHash !== "string"
		)
			throw new Error(
				"Missing SQLite observation catalogue. Run pnpm data:build --from data-catalog.",
			);
		const names = new Set(
			database
				.prepare("SELECT id FROM observation_artifacts")
				.all()
				.map((row) => String(row.id)),
		);
		return {
			dataCatalogHash: metadata.dataCatalogHash,
			generationHash: metadata.generationHash,
			names,
		};
	} finally {
		database.close();
	}
}

/** Exact artifact bytes are shared by query views and JSON/CSV/Parquet exports. */
export function readObservationText(
	path: string,
	id: string,
	expectedGeneration?: string,
): string {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		if (
			expectedGeneration !== undefined &&
			database
				.prepare("SELECT generationHash FROM observation_catalogue")
				.get()?.generationHash !== expectedGeneration
		)
			throw new Error(
				"SQLite observations changed while serving. Restart the API after the data build.",
			);
		const row = database
			.prepare(
				"SELECT payload, payloadHash FROM observation_artifacts WHERE id = ?",
			)
			.get(id);
		if (typeof row?.payload !== "string")
			throw new Error(`Missing SQLite measure observations: ${id}`);
		if (sha256(row.payload) !== row.payloadHash)
			throw new Error(`Corrupt SQLite measure observations: ${id}`);
		return row.payload;
	} finally {
		database.close();
	}
}

export function assertObservationCatalogue(path: string, catalog: DataCatalog) {
	const inventory = readObservationInventory(path);
	if (inventory.dataCatalogHash !== catalog.contentHash)
		throw new Error(
			"SQLite observations were compiled from another data catalogue. Run pnpm data:build --from data-catalog.",
		);
	for (const measure of catalog.measures)
		for (const source of measure.sources) {
			const id = observationArtifactName(measure.id, source);
			if (!inventory.names.has(id))
				throw new Error(`Missing SQLite measure observations: ${id}`);
		}
	return inventory;
}
