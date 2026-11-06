import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import {
	observationArtifactName,
	isMeasureTable,
	tableMeasureObservations,
	type AnyMeasureObservationArtifact,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	atlasDatabasePath,
	compiledObservationPath,
	observationValuesEqual,
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
 * only when its rows rebuild the stored artifact, so every value, status,
 * interval, period and area a route serves is unchanged; the routes
 * are compared too, old read path against new, for a sample of places.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = resolve(apiRoot, "../..");
const databasePath = atlasDatabasePath(repositoryRoot);
const catalogues = readApiCatalogues(repositoryRoot);
const catalog = catalogues.dataCatalog;
const readPath = JSON.parse(
	readFileSync(statisticsReadPathPath(repositoryRoot), "utf8"),
) as StatisticsReadPath;

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

test("rebuilds every moved artifact by value from statistics rows", () => {
	for (const measure of catalog.measures)
		for (const source of measure.sources) {
			const name = observationArtifactName(measure.id, source);
			const selector = readPath.statistics[name];
			assert.ok(selector, `Missing selector for ${name}`);
			assert.ok(
				observationValuesEqual(
					readStatisticsObservationText(databasePath, selector, {
						measureId: measure.id,
						sourceGeography: source.sourceGeography,
						periods: source.periods,
					}),
					readFileSync(
						compiledObservationPath(repositoryRoot, name),
						"utf8",
					),
				),
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

test("serves the same answers from statistics rows as from compiled artifacts", () => {
	let activeKey = "";
	let activeArtifact: AnyMeasureObservationArtifact;
	const legacy = {
		...catalogues,
		measureObservations: catalog.measures.flatMap((measure) =>
			measure.sources.map((source) => {
				const name = observationArtifactName(measure.id, source);
				const key = `${name}:${measure.id}`;
				const load = () => {
					if (activeKey !== key) {
						const artifact: unknown = JSON.parse(
							readFileSync(
								compiledObservationPath(repositoryRoot, name),
								"utf8",
							),
						);
						activeArtifact = isMeasureTable(artifact)
							? tableMeasureObservations(artifact, measure.id)
							: (artifact as AnyMeasureObservationArtifact);
						activeKey = key;
					}
					return activeArtifact;
				};
				return {
					schemaVersion: 1,
					measureId: measure.id,
					sourceGeography: source.sourceGeography,
					get contentHash() {
						return load().contentHash;
					},
					get periods() {
						return load().periods;
					},
				} as AnyMeasureObservationArtifact;
			}),
		),
	};
	const checked = samples();
	assert.ok(checked.length > 300, `only ${checked.length} samples`);
	let answered = 0;
	const refusals: string[] = [];
	for (const { url } of checked) {
		const before = route("GET", url, legacy);
		const after = route("GET", url, catalogues);
		assert.equal(after.status, before.status, url);
		assert.ok(
			observationValuesEqual(
				JSON.stringify(after.body),
				JSON.stringify(before.body),
			),
			url,
		);
		if (after.status === 200) answered++;
		else if (refusals.length < 12) {
			const body = after.body as { code?: string; detail?: string };
			refusals.push(
				`${after.status} ${body.code}: ${url} (${body.detail})`,
			);
		}
	}
	// A pair of matching refusals proves little, so most samples must answer.
	assert.ok(
		answered > checked.length * 0.95,
		`${answered} of ${checked.length} samples answered; first refusals: ${refusals.join("; ")}`,
	);
});
