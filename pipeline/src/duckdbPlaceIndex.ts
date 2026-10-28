import { DuckDBInstance } from "@duckdb/node-api";
import type { AreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { NamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import {
	finishPlaceIndex,
	preparePlaceIndex,
	type CompiledPlaceLabel,
} from "@uk-data-atlas/atlas-runtime/places";

export async function compileDuckdbPlaceIndex(
	areaLookup: AreaLookup,
	namedLocations: NamedLocationInventory | undefined,
	areaInventoryHash: string,
	boundaryRegistry?: BoundaryRegistry,
) {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		await connection.run(
			"CREATE TEMP TABLE postings (term VARCHAR, place VARCHAR, label VARCHAR, via_title BOOLEAN, sequence BIGINT)",
		);
		const appender = await connection.createAppender("postings");
		let sequence = 0;
		let prepared: ReturnType<typeof preparePlaceIndex>;
		try {
			prepared = preparePlaceIndex(
				areaLookup,
				namedLocations,
				boundaryRegistry,
				(term, entry) => {
					appender.appendVarchar(term);
					appender.appendVarchar(entry.place);
					appender.appendVarchar(entry.label);
					appender.appendBoolean(entry.viaTitle);
					appender.appendBigInt(BigInt(sequence++));
					appender.endRow();
				},
			);
		} finally {
			appender.closeSync();
		}
		const result = await connection.stream(`
			SELECT term, place, label, arg_min(via_title, sequence) AS via_title
			FROM postings
			GROUP BY term, place, label
			ORDER BY term, min(sequence)
		`);
		const position = new Map(
			prepared.places.map((place, index) => [place.place, index]),
		);
		const names: string[] = [];
		const labels: CompiledPlaceLabel[][] = [];
		for (;;) {
			const chunk = await result.fetchChunk();
			if (!chunk || chunk.rowCount === 0) break;
			for (const [
				termValue,
				placeValue,
				labelValue,
				title,
			] of chunk.getRows()) {
				const term = String(termValue);
				const label = String(labelValue);
				const index = position.get(String(placeValue))!;
				const viaTitle = title ? 1 : 0;
				if (names.at(-1) !== term) {
					names.push(term);
					labels.push([]);
				}
				labels
					.at(-1)!
					.push(
						label === prepared.places[index]!.name
							? [index, viaTitle]
							: [index, viaTitle, label],
					);
			}
		}
		return finishPlaceIndex(
			prepared,
			names,
			labels,
			areaInventoryHash,
			namedLocations,
		);
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}
