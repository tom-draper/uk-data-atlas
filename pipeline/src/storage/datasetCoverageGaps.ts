import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

/** Publisher records excluded from an otherwise published coverage partition. */
export function datasetCoverageGapTables(
	directory: string,
	entries: readonly { output: string }[],
): Record<string, SqliteTable> {
	return {
		dataset_coverage_gap: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"edition TEXT NOT NULL",
				"kind TEXT NOT NULL CHECK (kind IN ('election-ward', 'collision-area', 'collision-without-lsoa'))",
				"position INTEGER NOT NULL",
				"area_code TEXT",
				"area_name TEXT",
				"parent_name TEXT",
				"reason TEXT",
				"count INTEGER",
			],
			key: ["dataset_id", "edition", "kind", "position"],
			rows: function* (db) {
				for (const entry of entries) {
					if (
						entry.output !== "local-election" &&
						entry.output !== "road-collisions"
					)
						continue;
					const id = db
						.prepare("SELECT id FROM dataset WHERE slug = ?")
						.get(entry.output)?.id;
					if (typeof id !== "number")
						throw new Error(`Missing dataset ${entry.output}`);
					const parts = JSON.parse(
						readFileSync(
							join(directory, "datasets", `${entry.output}.json`),
							"utf8",
						),
					) as Record<string, Record<string, unknown>>;
					for (const [edition, part] of Object.entries(parts)) {
						if (entry.output === "local-election") {
							const excluded = (part.excludedWards ??
								[]) as Array<Record<string, unknown>>;
							for (const [position, item] of excluded.entries()) {
								if (
									typeof item.wardName !== "string" ||
									typeof item.ladName !== "string" ||
									typeof item.reason !== "string" ||
									(item.wardCode !== undefined &&
										typeof item.wardCode !== "string")
								)
									throw new Error(
										`Invalid excluded ward in ${entry.output}/${edition}`,
									);
								yield [
									id,
									edition,
									"election-ward",
									position,
									item.wardCode ?? null,
									item.wardName,
									item.ladName,
									item.reason,
									null,
								];
							}
						} else {
							const excluded = (part.excluded ?? []) as Array<
								Record<string, unknown>
							>;
							for (const [position, item] of excluded.entries()) {
								if (
									typeof item.code !== "string" ||
									!Number.isSafeInteger(item.collisions) ||
									Number(item.collisions) < 0
								)
									throw new Error(
										`Invalid excluded collision area in ${entry.output}/${edition}`,
									);
								yield [
									id,
									edition,
									"collision-area",
									position,
									item.code,
									null,
									null,
									null,
									item.collisions as number,
								];
							}
							const without = (part.withoutLsoa ?? {}) as Record<
								string,
								unknown
							>;
							for (const [
								position,
								[country, count],
							] of Object.entries(without).entries()) {
								if (
									!Number.isSafeInteger(count) ||
									Number(count) < 0
								)
									throw new Error(
										`Invalid collision coverage count in ${entry.output}/${edition}`,
									);
								yield [
									id,
									edition,
									"collision-without-lsoa",
									position,
									country,
									null,
									null,
									null,
									count as number,
								];
							}
						}
					}
				}
			},
		},
	};
}
