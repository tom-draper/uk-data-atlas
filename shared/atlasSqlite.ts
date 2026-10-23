import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Server-only access to the shared compiled release. Connections close before atomic replacements. */
export function readAtlasPayload(repositoryRoot: string, id: string): string {
	const path = join(repositoryRoot, "data/build/atlas.sqlite");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const row = database
			.prepare("SELECT payload FROM payloads WHERE id = ?")
			.get(id);
		if (!row || typeof row.payload !== "string")
			throw new Error(`Missing payload ${id} at ${path}`);
		return row.payload;
	} finally {
		database.close();
	}
}

export function readAtlasDatasetUrls(
	repositoryRoot: string,
): Record<string, string> {
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		return Object.fromEntries(
			database
				.prepare("SELECT output, sha256 FROM datasets")
				.all()
				.map((row) => [
					String(row.output),
					`/data/catalogue/${row.sha256}/${row.output}.json`,
				]),
		);
	} finally {
		database.close();
	}
}

export function readVersionedAtlasDataset(
	repositoryRoot: string,
	output: string,
	sha256: string,
): string | undefined {
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const row = database
			.prepare(
				"SELECT payload FROM datasets JOIN payloads ON payloads.id = datasets.payloadId WHERE output = ? AND sha256 = ?",
			)
			.get(output, sha256);
		return row ? String(row.payload) : undefined;
	} finally {
		database.close();
	}
}
