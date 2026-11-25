import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import {
	measureSeriesKey,
	observationsFor,
	readMeasureObservations,
} from "@uk-data-atlas/measures";
import { readApiCatalogues } from "../../src/catalogueLoader";
import { cursorFor } from "../../src/http/pagination";
import { route } from "../boundRoute";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const indexed = readApiCatalogues(root);
const full = {
	...indexed,
	measureObservations: readMeasureObservations(
		root,
		indexed.dataCatalog,
		undefined,
		indexed.atlasStatistics.readPath,
	),
};

const census =
	"/v1/data/usual-residents?age-band=0-to-4&geography=lsoa&codeYear=2021&period=2021&limit=100";

const assertParity = (path: string, status = 200) => {
	const response = route("GET", path, indexed);
	assert.equal(response.status, status, path);
	assert.deepEqual(response, route("GET", path, full), path);
	return response;
};

test("SQLite reads match full artifacts for a shared table, remapped codes and confidence intervals", () => {
	for (const path of [
		"/v1/data/usual-residents/value?age-band=0-to-4&geography=lsoa&codeYear=2021&period=2021&place=E01009000",
		"/v1/data/house-price-median/series?geography=ward&codeYear=2020&place=E05000759",
		"/v1/data/unemployment-rate/series?geography=localAuthority&codeYear=2019&place=E09000033",
		"/v1/data/population/series?geography=ward&codeYear=2023&place=E05014120",
	]) {
		assertParity(path);
	}
});

test("indexed pages preserve row order, exports and cursor validation", () => {
	const measure = indexed.dataCatalog.measures.find(
		({ id }) => id === "age-0-to-4",
	)!;
	const source = measure.sources.find(
		({ sourceGeography }) => sourceGeography.type === "lsoa",
	)!;
	const observations = observationsFor(measure.id, source, "2021", {
		measureObservations: indexed.measureObservations,
		seriesKey: measureSeriesKey(measure.series!),
		indexed: true,
	});
	assert.deepEqual(
		observations
			?.pageFrom?.("E01009000", 2)
			?.map((record) => record.areaCode),
		["E01009000", "E01009001"],
	);

	const first = assertParity(census);
	const { meta } = first.body as { meta: { nextCursor: string } };
	assert.ok(meta.nextCursor);
	const [, scope] = JSON.parse(
		Buffer.from(meta.nextCursor, "base64url").toString(),
	);
	assertParity(`${census}&cursor=${meta.nextCursor}`);
	assertParity(`${census}&cursor=${cursorFor(scope, "E01009000")}`);
	assertParity(
		`${census}&cursor=${cursorFor(scope, "E01009000-absent")}`,
		400,
	);
	assertParity(`${census}&format=csv`);
	assertParity(`${census}&format=ndjson`);
	assertParity(`${census}&units=canonical`);
});
