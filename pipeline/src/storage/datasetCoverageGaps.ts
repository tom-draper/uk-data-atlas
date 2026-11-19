import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import type { DirectGap } from "@uk-data-atlas/datasets";
import type { DirectParts } from "../statistics/directParts.ts";

type Entry = { output: string; type?: string; direct?: boolean };

/** The gaps of a compiled file's part, checked as the build reads them. */
function* compiledGaps(
	output: string,
	edition: string,
	part: Record<string, unknown>,
): Generator<DirectGap> {
	if (output === "local-election") {
		for (const item of (part.excludedWards ?? []) as Array<
			Record<string, unknown>
		>) {
			if (
				typeof item.wardName !== "string" ||
				typeof item.ladName !== "string" ||
				typeof item.reason !== "string" ||
				(item.wardCode !== undefined &&
					typeof item.wardCode !== "string")
			)
				throw new Error(
					`Invalid excluded ward in ${output}/${edition}`,
				);
			yield {
				kind: "election-ward",
				wardName: item.wardName,
				ladName: item.ladName,
				...(item.wardCode === undefined
					? {}
					: { wardCode: item.wardCode }),
				reason: item.reason,
			};
		}
		return;
	}
	for (const item of (part.excluded ?? []) as Array<
		Record<string, unknown>
	>) {
		if (
			typeof item.code !== "string" ||
			!Number.isSafeInteger(item.collisions) ||
			Number(item.collisions) < 0
		)
			throw new Error(
				`Invalid excluded collision area in ${output}/${edition}`,
			);
		yield {
			kind: "collision-area",
			code: item.code,
			collisions: item.collisions as number,
		};
	}
	for (const [country, count] of Object.entries(
		(part.withoutLsoa ?? {}) as Record<string, unknown>,
	)) {
		if (!Number.isSafeInteger(count) || Number(count) < 0)
			throw new Error(
				`Invalid collision coverage count in ${output}/${edition}`,
			);
		yield {
			kind: "collision-without-lsoa",
			country,
			collisions: count as number,
		};
	}
}

/**
 * Publisher records excluded from an otherwise published coverage partition.
 * A direct-only dataset has no compiled file, so its gaps are the ones its
 * source reading returned beside its rows.
 */
export function datasetCoverageGapTables(
	directory: string,
	entries: readonly Entry[],
	direct: DirectParts = new Map(),
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
					const editions: Array<[string, Iterable<DirectGap>]> =
						entry.direct
							? (
									direct.get(entry.type ?? entry.output) ?? []
								).map((part) => [part.key, part.gaps ?? []])
							: Object.entries(
									JSON.parse(
										readFileSync(
											join(
												directory,
												"datasets",
												`${entry.output}.json`,
											),
											"utf8",
										),
									) as Record<
										string,
										Record<string, unknown>
									>,
								).map(([edition, part]) => [
									edition,
									compiledGaps(entry.output, edition, part),
								]);
					for (const [edition, gaps] of editions) {
						const positions = new Map<string, number>();
						for (const gap of gaps) {
							const position = positions.get(gap.kind) ?? 0;
							positions.set(gap.kind, position + 1);
							const row =
								gap.kind === "election-ward"
									? [
											gap.wardCode ?? null,
											gap.wardName,
											gap.ladName,
											gap.reason,
											null,
										]
									: gap.kind === "collision-area"
										? [
												gap.code,
												null,
												null,
												null,
												gap.collisions,
											]
										: [
												gap.country,
												null,
												null,
												null,
												gap.collisions,
											];
							yield [id, edition, gap.kind, position, ...row];
						}
					}
				}
			},
		},
	};
}
