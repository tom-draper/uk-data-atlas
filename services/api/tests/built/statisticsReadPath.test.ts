import { resolve as resolveRepositoryRoot } from "node:path";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	observationArtifactName,
	readMeasureObservations,
	OBSERVATION_TABLES_ONLY,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	atlasDatabasePath,
	readObservationText,
	readStatisticsObservationText,
} from "@uk-data-atlas/atlas-runtime/storage";
import { route } from "../../src/routes";
import { readApiCatalogues } from "../../src/server";
import { readFileSync } from "node:fs";
import {
	statisticsReadPathPath,
	type StatisticsReadPath,
} from "@uk-data-atlas/atlas-runtime/storage";

/**
 * The statistics read path. An artifact is read from the statistics tables
 * only when its rows rebuild the stored bytes exactly, so every value,
 * status, interval, period and area a route serves is unchanged; the routes
 * are compared too, old read path against new, for a sample of places.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const databasePath = atlasDatabasePath(resolve(apiRoot, "../.."));
const catalogues = readApiCatalogues(resolveRepositoryRoot(apiRoot, "../.."));
const catalog = catalogues.dataCatalog;
const readPath = JSON.parse(
	readFileSync(statisticsReadPathPath(resolve(apiRoot, "../..")), "utf8"),
) as StatisticsReadPath;

test("names every catalogue artifact once, as statistics or observations", () => {
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
});

test("rebuilds every moved artifact byte for byte from statistics rows", () => {
	for (const measure of catalog.measures)
		for (const source of measure.sources) {
			const name = observationArtifactName(measure.id, source);
			const selector = readPath.statistics[name];
			if (!selector) continue;
			assert.equal(
				readStatisticsObservationText(databasePath, selector, {
					measureId: measure.id,
					sourceGeography: source.sourceGeography,
					periods: source.periods,
				}),
				readObservationText(databasePath, name),
				`${name} rebuilt from statistics rows differs from the stored artifact`,
			);
		}
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
			const step = Math.max(1, Math.floor(records.length / 3));
			for (let index = 0; index < records.length; index += step) {
				const query = new URLSearchParams({
					place: records[index]!.areaCode,
					geography: source.sourceGeography.type,
					codeYear: String(source.sourceGeography.boundaryYear),
				});
				picked.push({
					measureId: measure.id,
					url: `/v1/data/${measure.id}/series?${query}`,
				});
				for (const period of [
					source.periods[0]!,
					source.periods.at(-1)!,
				])
					picked.push({
						measureId: measure.id,
						url: `/v1/data/${measure.id}/value?${new URLSearchParams(
							{
								place: `${source.sourceGeography.type}/${records[index]!.areaCode}`,
								period,
							},
						)}`,
					});
			}
		}
	return picked;
};

test("serves the same answers from statistics rows as from observation tables", () => {
	const legacy = {
		...catalogues,
		measureObservations: readMeasureObservations(
			resolve(apiRoot, "../.."),
			catalog,
			undefined,
			OBSERVATION_TABLES_ONLY,
		),
	};
	const checked = samples();
	assert.ok(checked.length > 300, `only ${checked.length} samples`);
	let answered = 0;
	for (const { url } of checked) {
		const before = route("GET", url, legacy);
		const after = route("GET", url, catalogues);
		assert.equal(after.status, before.status, url);
		assert.deepEqual(after.body, before.body, url);
		if (after.status === 200) answered++;
	}
	// A pair of matching refusals proves little, so most samples must answer.
	assert.ok(
		answered > checked.length * 0.95,
		`${answered} of ${checked.length} samples answered`,
	);
});
