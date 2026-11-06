import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import {
	comparableCompiled,
	generatedFromRows,
	payloadDifference,
	servedFromRows,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { atlasCachePath } from "@uk-data-atlas/atlas-runtime/storage";

/**
 * Checks that every dataset the atlas serves from statistics rows has the
 * values its compiler wrote. The atlas build already regenerates each such
 * payload once, gzipped into `dataset_payload` in the atlas cache, so this
 * reads that copy back instead of rebuilding a second one.
 *
 * Throws at the first dataset that differs, and returns how many it checked.
 */
export function verifyDatasetPayloads(repositoryRoot: string): number {
	const datasets = join(repositoryRoot, "data/build/datasets");
	const manifest = JSON.parse(
		readFileSync(join(datasets, "dataset-manifest.json"), "utf8"),
	) as { datasets: { type: string; output: string }[] };
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
			const generated: unknown = JSON.parse(
				gunzipSync(row.gzip).toString("utf8"),
			);
			const compiled: unknown = JSON.parse(
				readFileSync(join(datasets, `${entry.output}.json`), "utf8"),
			);
			if (generatedFromRows(entry.type)) {
				const difference = payloadDifference(
					generated,
					comparableCompiled(entry.type, compiled),
				);
				if (difference)
					throw new Error(
						`${entry.type}: statistics rows do not match compiled dataset values at ${difference}`,
					);
			} else if (!isDeepStrictEqual(generated, compiled))
				throw new Error(
					`${entry.type}: statistics rows differ from the compiled dataset`,
				);
			checked += 1;
		}
	} finally {
		cache.close();
	}
	return checked;
}
