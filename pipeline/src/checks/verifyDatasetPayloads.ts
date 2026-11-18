import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import { servedFromRows } from "@uk-data-atlas/catalogue/node";
import { directPayloadProblem } from "./directPayloadGoldens.ts";
import { atlasCachePath } from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";

/**
 * Checks that every dataset the atlas serves from statistics rows regenerates
 * to its committed golden payload. The atlas build already regenerates each
 * such payload once, gzipped into `dataset_payload` in the atlas cache, so
 * this reads that copy back instead of rebuilding a second one.
 *
 * Throws at the first dataset that differs, and returns how many it checked.
 */
export function verifyDatasetPayloads(repositoryRoot: string): number {
	const datasets = join(repositoryRoot, "data/build/datasets");
	const manifest = readJsonSync(join(datasets, "dataset-manifest.json")) as {
		datasets: { type: string; output: string }[];
	};
	const cache = new DatabaseSync(atlasCachePath(repositoryRoot), {
		readOnly: true,
	});
	let checked = 0;
	try {
		const select = cache.prepare(
			"SELECT gzip FROM dataset_payload WHERE output = ?",
		);
		for (const entry of manifest.datasets) {
			if (!servedFromRows(entry.type)) continue;
			const row = select.get(entry.output);
			if (!(row?.gzip instanceof Uint8Array))
				throw new Error(
					`${entry.type}: the atlas cache holds no payload for ${entry.output}`,
				);
			const text = gunzipSync(row.gzip).toString("utf8");
			const problem = directPayloadProblem(entry.type, text);
			if (problem) throw new Error(problem);
			checked += 1;
		}
	} finally {
		cache.close();
	}
	return checked;
}
