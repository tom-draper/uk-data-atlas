import { DuckDBInstance } from "@duckdb/node-api";
import { compareCodeUnits } from "../../shared/compareCodeUnits";
import { sha256 } from "../../shared/contentHash";
import type { AreaLookup } from "../../shared/areaInventory";
import type { AreaSearchIndexArtifact } from "../../shared/areaSearchCompiler";
import { NAME_NORMALISATION } from "../../shared/nameNormalisation";
import { normalisePlaceName, withoutTitle } from "@uk-data-atlas/geography";

export async function compileDuckdbAreaSearchIndex(
	areaLookup: AreaLookup,
	areaInventoryHash: string,
): Promise<AreaSearchIndexArtifact> {
	const releases = [...areaLookup.entries()]
		.map(([key, areas]) => {
			const slash = key.indexOf("/");
			return {
				geography: key.slice(0, slash),
				boundaryRelease: key.slice(slash + 1),
				codes: [...areas.keys()].sort(compareCodeUnits),
				areas,
			};
		})
		.sort((a, b) =>
			compareCodeUnits(
				`${a.geography}/${a.boundaryRelease}/`,
				`${b.geography}/${b.boundaryRelease}/`,
			),
		);
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		await connection.run(
			"CREATE TEMP TABLE postings (title BOOLEAN, term VARCHAR, position INTEGER)",
		);
		const appender = await connection.createAppender("postings");
		try {
			const post = (
				title: boolean,
				term: string | undefined,
				position: number,
			) => {
				if (!term) return;
				appender.appendBoolean(title);
				appender.appendVarchar(term);
				appender.appendInteger(position);
				appender.endRow();
			};
			let position = 0;
			for (const release of releases)
				for (const code of release.codes) {
					const area = release.areas.get(code)!;
					post(false, normalisePlaceName(code), position);
					for (const label of [area.name, ...(area.aliases ?? [])]) {
						const name = normalisePlaceName(label);
						post(false, name, position);
						if (name) post(true, withoutTitle(name), position);
					}
					position++;
				}
		} finally {
			appender.closeSync();
		}
		const result = await connection.stream(
			"SELECT DISTINCT title, term, position FROM postings ORDER BY title, term, position",
		);
		const terms: string[] = [],
			titleTerms: string[] = [];
		const termAreas: number[][] = [],
			titleTermAreas: number[][] = [];
		for (;;) {
			const chunk = await result.fetchChunk();
			if (!chunk || chunk.rowCount === 0) break;
			for (const [title, value, at] of chunk.getRows()) {
				const term = String(value);
				const names = title ? titleTerms : terms;
				const postings = title ? titleTermAreas : termAreas;
				if (names.at(-1) !== term) {
					names.push(term);
					postings.push([]);
				}
				postings.at(-1)!.push(Number(at));
			}
		}
		const body = {
			schemaVersion: 1 as const,
			nameNormalisation: NAME_NORMALISATION,
			areaInventoryHash,
			releases: releases.map(({ geography, boundaryRelease, codes }) => ({
				geography,
				boundaryRelease,
				codes,
			})),
			terms,
			termAreas,
			titleTerms,
			titleTermAreas,
		};
		return { ...body, contentHash: sha256(JSON.stringify(body)) };
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}
