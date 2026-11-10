import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { openReadOnlyDatabase, unpackText } from "@uk-data-atlas/atlas-db";
import { rebuildDatasetPayload } from "@uk-data-atlas/catalogue/node";

/** Rebuild a catalogue input from the base database and its matching cache. */
export function readBaseDatasetInput(root: string, output: string): string {
	const db = openReadOnlyDatabase(join(root, "data/build/atlas-base.sqlite"));
	try {
		if (output === "dataset-manifest") {
			const text = unpackText(
				db
					.prepare("SELECT payload FROM payloads WHERE id = ?")
					.get(output)?.payload,
			);
			if (text === undefined)
				throw new Error(
					"Missing dataset manifest in atlas-base.sqlite",
				);
			return text;
		}
		const row = db
			.prepare(
				"SELECT compiled_type, compiled_sha256, payload_id FROM dataset WHERE slug = ? AND compiled_type IS NOT NULL",
			)
			.get(output);
		if (!row || typeof row.compiled_type !== "string")
			throw new Error(`Missing dataset ${output} in atlas-base.sqlite`);
		if (typeof row.payload_id === "string") {
			const text = unpackText(
				db
					.prepare("SELECT payload FROM payloads WHERE id = ?")
					.get(row.payload_id)?.payload,
			);
			if (text === undefined)
				throw new Error(`Missing payload ${row.payload_id}`);
			return text;
		}
		let text: string | undefined;
		const cachePath = join(root, "data/build/atlas-cache.sqlite");
		if (existsSync(cachePath)) {
			const cache = openReadOnlyDatabase(cachePath);
			try {
				const cached = cache
					.prepare(
						"SELECT source_sha256, sha256, bytes, gzip FROM dataset_payload WHERE output = ?",
					)
					.get(output);
				if (
					cached?.source_sha256 === row.compiled_sha256 &&
					cached.gzip instanceof Uint8Array
				) {
					const decoded = gunzipSync(cached.gzip);
					if (
						decoded.byteLength !== cached.bytes ||
						createHash("sha256").update(decoded).digest("hex") !==
							cached.sha256
					)
						throw new Error(`Corrupt cached dataset ${output}`);
					text = decoded.toString("utf8");
				}
			} finally {
				cache.release();
			}
		}
		text ??= rebuildDatasetPayload(db, row.compiled_type, output);
		if (output !== "local-election" && output !== "road-collisions")
			return text;
		const parts = JSON.parse(text) as Record<
			string,
			Record<string, unknown>
		>;
		const gaps = db
			.prepare(
				"SELECT g.edition, g.kind, g.area_code, g.area_name, g.parent_name, g.reason, g.count FROM dataset_coverage_gap g JOIN dataset d ON d.id = g.dataset_id WHERE d.slug = ? ORDER BY g.edition, g.kind, g.position",
			)
			.all(output);
		for (const gap of gaps) {
			const part = parts[String(gap.edition)];
			if (!part)
				throw new Error(
					`Coverage gap names missing edition ${output}/${String(gap.edition)}`,
				);
			if (gap.kind === "election-ward") {
				const excluded = (part.excludedWards ??= []) as Array<
					Record<string, unknown>
				>;
				excluded.push({
					wardName: gap.area_name,
					ladName: gap.parent_name,
					...(gap.area_code === null
						? {}
						: { wardCode: gap.area_code }),
					reason: gap.reason,
				});
			} else if (gap.kind === "collision-area") {
				const excluded = (part.excluded ??= []) as Array<
					Record<string, unknown>
				>;
				excluded.push({ code: gap.area_code, collisions: gap.count });
			} else if (gap.kind === "collision-without-lsoa") {
				const missing = (part.withoutLsoa ??= {}) as Record<
					string,
					unknown
				>;
				missing[String(gap.area_code)] = gap.count;
			}
		}
		return JSON.stringify(parts);
	} finally {
		db.release();
	}
}
