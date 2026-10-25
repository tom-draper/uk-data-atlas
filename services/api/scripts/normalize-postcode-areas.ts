import { DatabaseSync } from "node:sqlite";
import { inflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { storePostcodeAreas } from "./store-postcode-derived";
import type { PostcodeAreasArtifact } from "../src/postcodeAreas";

export function normalizePostcodeAreas(root: string) {
	const database = new DatabaseSync(
		resolve(root, "data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const artifact: PostcodeAreasArtifact = JSON.parse(
			String(
				database
					.prepare(
						"SELECT payload FROM payloads WHERE id = 'postcode-areas'",
					)
					.get()!.payload,
			),
		);
		const read = database.prepare(
			"SELECT payload FROM postcode_area_shards WHERE path = ?",
		);
		return storePostcodeAreas(root, artifact, (path) => {
			const row = read.get(path);
			if (!(row?.payload instanceof Uint8Array))
				throw new Error(`Missing postcode area shard ${path}`);
			return inflateSync(row.payload).toString("utf8");
		});
	} finally {
		database.close();
	}
}

const script = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === script) {
	console.log(normalizePostcodeAreas(resolve(dirname(script), "../../..")));
}
