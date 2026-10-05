import assert from "node:assert/strict";
import test from "node:test";
import type { Measure, MeasureSource } from "../src/dataCatalog";
import type { MeasureGeographyKind } from "../src/geography";
import {
	areaNamedBy,
	defaultChangePeriods,
	defaultSource,
	namedAreaRefusal,
} from "../src/dataDefaults";
import type { GeographyResolver } from "../src/geographyResolver";
import type { PlaceCandidate } from "../src/placeResolver";

const source = (
	type: MeasureGeographyKind,
	boundaryYear: number,
	periods: string[],
	datasetId = `${type}-${boundaryYear}`,
): MeasureSource => ({
	datasetId,
	periods,
	sourceGeography: { type, boundaryYear },
	coverage: {
		kind: "source-reported",
		countries: ["GB-ENG"],
		recordCount: 1,
		note: "",
	},
});

const measure = (...sources: MeasureSource[]) =>
	({ id: "population", sources }) as unknown as Measure;

const area = (
	geography: string,
	code: string,
	boundaryReleases: string[],
): PlaceCandidate => ({
	place: `${geography}/${code}`,
	kind: "area",
	name: "Manchester",
	geography,
	code,
	match: "exact",
	matchedLabel: "Manchester",
	boundaryReleases,
});

const resolverFinding = (...candidates: PlaceCandidate[]) =>
	({ places: () => candidates }) as unknown as GeographyResolver;

const query = { period: null, geography: null, boundaryYear: null };

test("chooses the newest partition of the one geography asked for", () => {
	const chosen = defaultSource(
		measure(
			source("localAuthority", 2021, ["2020", "2021"]),
			source("localAuthority", 2023, ["2022", "2023", "2024"]),
		),
		{ ...query, geography: "localAuthority" },
	);
	assert.equal(chosen?.boundaryYear, "2023");
	assert.deepEqual(chosen?.defaulted, { period: "2024", boundaryYear: 2023 });
});

test("never chooses between geographies", () => {
	const twoGeographies = measure(
		source("localAuthority", 2023, ["2024"]),
		source("constituency", 2024, ["2022"]),
	);
	assert.equal(defaultSource(twoGeographies, query), undefined);
	assert.equal(
		defaultSource(measure(source("ward", 2023, ["2022"])), query)
			?.geography,
		"ward",
	);
});

test("leaves two datasets on one partition for the caller to choose", () => {
	const shared = measure(
		source("localAuthority", 2023, ["2024"], "a"),
		source("localAuthority", 2023, ["2024"], "b"),
	);
	assert.equal(
		defaultSource(shared, { ...query, geography: "localAuthority" }),
		undefined,
	);
	assert.equal(
		defaultSource(shared, {
			...query,
			geography: "localAuthority",
			datasetId: "b",
		})?.source.datasetId,
		"b",
	);
});

test("measures change to the latest period, from the latest before it that does not overlap", () => {
	const yearly = source("localAuthority", 2023, ["2011", "2012", "2024"]);
	assert.deepEqual(defaultChangePeriods(yearly, null, null), {
		start: "2012",
		end: "2024",
		defaulted: { startPeriod: "2012", endPeriod: "2024" },
	});
	assert.deepEqual(defaultChangePeriods(yearly, "2011", null), {
		start: "2011",
		end: "2024",
		defaulted: { endPeriod: "2024" },
	});
	assert.deepEqual(defaultChangePeriods(yearly, null, "2012"), {
		start: "2011",
		end: "2012",
		defaulted: { startPeriod: "2011" },
	});
	const windows = source("localAuthority", 2023, [
		"2017-2019",
		"2018-2020",
		"2020-2022",
	]);
	assert.deepEqual(
		defaultChangePeriods(windows, null, null)?.start,
		"2017-2019",
	);
});

test("reads a name as the area whose code was in use in the data's vintage", () => {
	const named = areaNamedBy({
		geographyResolver: resolverFinding(
			area("localAuthority", "00BN", ["2009-12-gb-bgc"]),
			area("localAuthority", "E08000003", [
				"2026-05-uk-bgc",
				"2023-05-uk-bgc",
			]),
		),
		measure: measure(source("localAuthority", 2023, ["2024"])),
		place: "Manchester",
		geography: null,
	});
	assert.deepEqual(named, {
		kind: "area",
		code: "E08000003",
		geography: "localAuthority",
	});
});

test("refuses a name that means several areas, with a request for each", () => {
	const url = new URL(
		"https://api.example.test/v1/data/population/series?place=Newport",
	);
	const populated = measure(
		source("localAuthority", 2023, ["2024"]),
		source("ward", 2023, ["2022"]),
	);
	const named = areaNamedBy({
		geographyResolver: resolverFinding(
			area("localAuthority", "W06000022", ["2023-05-uk-bgc"]),
			area("ward", "E05009866", ["2023-12-ew-bgc"]),
		),
		measure: populated,
		place: "Newport",
		geography: null,
	});
	const refusal = namedAreaRefusal({
		parsedUrl: url,
		measure: populated,
		parameter: "place",
		text: "Newport",
		named,
	});
	assert.equal(refusal?.status, 409);
	const body = refusal?.body as {
		code: string;
		choices: { ask: string }[];
	};
	assert.equal(body.code, "ambiguous_place");
	assert.deepEqual(
		body.choices.map((choice) => choice.ask),
		[
			"/v1/data/population/series?place=W06000022&geography=localAuthority",
			"/v1/data/population/series?place=E05009866&geography=ward",
		],
	);
});

test("says a name means no area the measure is published for, but leaves a code to the route", () => {
	const wardsOnly = measure(source("ward", 2020, ["2022"]));
	const council = area("localAuthority", "E08000003", ["2023-05-uk-bgc"]);
	const byName = areaNamedBy({
		geographyResolver: resolverFinding(council),
		measure: wardsOnly,
		place: "Manchester",
		geography: null,
	});
	assert.deepEqual(byName, { kind: "unknown" });
	assert.equal(
		namedAreaRefusal({
			parsedUrl: new URL("https://api.example.test/v1/data/x/series"),
			measure: wardsOnly,
			parameter: "place",
			text: "Manchester",
			named: byName,
		})?.status,
		404,
	);
	assert.equal(
		areaNamedBy({
			geographyResolver: resolverFinding(council),
			measure: wardsOnly,
			place: "E08000003",
			geography: null,
		}),
		undefined,
	);
});
