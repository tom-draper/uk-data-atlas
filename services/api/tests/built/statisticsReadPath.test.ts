import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import { observationArtifactName } from "@uk-data-atlas/catalogue/node";
import {
	readAtlasStatisticsReadPath,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";

import { route } from "../../src/routes";
import { readApiCatalogues } from "../../src/server";
import { readFileSync } from "node:fs";
import { statisticsReadPathPath } from "@uk-data-atlas/atlas-db";

/**
 * The statistics read path names every catalogue partition and serves
 * sampled places from the canonical statistics tables.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = resolve(apiRoot, "../..");
const databasePath = atlasDatabasePath(repositoryRoot);
const catalogues = readApiCatalogues(repositoryRoot);
const catalog = catalogues.dataCatalog;
const readPath = JSON.parse(
	readFileSync(statisticsReadPathPath(repositoryRoot), "utf8"),
) as StatisticsReadPath;

test("database selectors match the validated build plan", () => {
	assert.deepEqual(readAtlasStatisticsReadPath(databasePath), readPath);
});

test("names every catalogue artifact once as statistics", () => {
	const names = new Set(
		catalog.measures.flatMap((measure) =>
			measure.sources.map((source) =>
				observationArtifactName(measure.id, source),
			),
		),
	);
	const planned = [
		...Object.keys(readPath.statistics),
		...Object.keys(readPath.observations),
	];
	assert.equal(new Set(planned).size, planned.length);
	assert.deepEqual(new Set(planned), names);
	assert.deepEqual(readPath.observations, {});
});

/** Every place in a moved source, sampled evenly, with its first and last periods. */
const samples = () => {
	const picked: Array<{ measureId: string; url: string }> = [];
	for (const measure of catalog.measures)
		for (const source of measure.sources) {
			if (
				!readPath.statistics[
					observationArtifactName(measure.id, source)
				]
			)
				continue;
			const artifact = catalogues.measureObservations.find(
				(candidate) =>
					candidate.measureId === measure.id &&
					candidate.sourceGeography.type ===
						source.sourceGeography.type &&
					candidate.sourceGeography.boundaryYear ===
						source.sourceGeography.boundaryYear,
			)!;
			const records = artifact.periods.at(-1)!.records;
			const mapping =
				catalogues.measureDimensions?.config.ids[measure.id];
			const measurePath = mapping?.measure ?? measure.id;
			const dimensions = mapping?.dimensions ?? {};
			const step = Math.max(1, Math.floor(records.length / 3));
			for (let index = 0; index < records.length; index += step) {
				const query = new URLSearchParams({
					place: records[index]!.areaCode,
					geography: source.sourceGeography.type,
					codeYear: String(source.sourceGeography.boundaryYear),
					...dimensions,
					...(mapping?.datasetId
						? { datasetId: mapping.datasetId }
						: {}),
				});
				picked.push({
					measureId: measure.id,
					url: `/v1/data/${measurePath}/series?${query}`,
				});
				for (const period of [
					source.periods[0]!,
					source.periods.at(-1)!,
				])
					picked.push({
						measureId: measure.id,
						url: `/v1/data/${measurePath}/value?${new URLSearchParams(
							{
								place: `${source.sourceGeography.type}/${records[index]!.areaCode}`,
								period,
								...dimensions,
								...(mapping?.datasetId
									? { datasetId: mapping.datasetId }
									: {}),
							},
						)}`,
					});
			}
		}
	return picked;
};

test("serves sampled catalogue partitions from statistics rows", () => {
	const checked = samples();
	assert.ok(checked.length > 300, `only ${checked.length} samples`);
	let answered = 0;
	const refusals: string[] = [];
	for (const { url } of checked) {
		const after = route("GET", url, catalogues);
		if (after.status === 200) answered++;
		else if (refusals.length < 12) {
			const body = after.body as { code?: string; detail?: string };
			refusals.push(
				`${after.status} ${body.code}: ${url} (${body.detail})`,
			);
		}
	}
	// Most sampled routes must return a value, not just a refusal.
	assert.ok(
		answered > checked.length * 0.95,
		`${answered} of ${checked.length} samples answered; first refusals: ${refusals.join("; ")}`,
	);
});
