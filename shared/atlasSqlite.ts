import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Server-only access to the shared compiled release. Connections close before atomic replacements. */
export function readAtlasPayload(repositoryRoot: string, id: string): string {
	const path = join(repositoryRoot, "compiled/atlas.sqlite");
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
