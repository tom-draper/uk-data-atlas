import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { readApiCatalogues } from "../../src/catalogueLoader";
import {
	followLineage,
	isRealigned,
	type AreaLineage,
} from "@uk-data-atlas/geography";

const apiRoot = new URL("../..", import.meta.url).pathname;

// Every code of every pair would take minutes; one in this many is enough to
// catch a lineage left behind by a rebuilt API.
const SAMPLE_EVERY = 37;

test("the area lineage served to the atlas answers as the resolver does", () => {
	const { geographyResolver, atlasLookups } = readApiCatalogues(apiRoot);
	const lineage = atlasLookups.get("area-lineage");
	assert.ok(
		lineage,
		"Run pnpm --dir ../.. data:build --only atlas-lookups first.",
	);
	const lineages = JSON.parse(
		gunzipSync(readFileSync(lineage.path)).toString("utf8"),
	) as Record<string, AreaLineage>;
	const differences: string[] = [];
	let checked = 0;
	for (const [geography, lineage] of Object.entries(lineages))
		for (const from of lineage.releases) {
			const codes = geographyResolver.areaCodes(geography, from) ?? [];
			for (const to of lineage.releases) {
				if (from === to) continue;
				for (
					let index = 0;
					index < codes.length;
					index += SAMPLE_EVERY
				) {
					const code = codes[index]!;
					checked += 1;
					const answer = geographyResolver.successorArea(
						{ geography, boundaryRelease: from, code },
						{ geography, boundaryRelease: to },
					);
					const expected = `${answer?.code}${answer?.realigned ? " (realigned)" : ""}`;
					const actual = `${followLineage(lineage, code, from, to)}${isRealigned(lineage, code, from, to) ? " (realigned)" : ""}`;
					if (actual !== expected)
						differences.push(
							`${geography} ${from}>${to} ${code}: ${actual} not ${expected}`,
						);
				}
			}
		}
	assert.ok(checked > 0);
	assert.deepEqual(
		differences.slice(0, 10),
		[],
		`${differences.length} answers differ; run the area lineage build again`,
	);
});
