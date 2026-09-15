import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import type {
	CategoricalObservation,
	MeasureObservationArtifact,
	DataCatalog,
} from "../src/dataCatalog";
import {
	registry,
	compatibleWardAreaLookup,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
	measureCompatibilityInventory,
	routeWithData,
	routeWithCatalog,
} from "./routeFixtures";

const populationProvenance = (
	datasetId: "population" | "population-uk",
	geography: "ward" | "localAuthority",
	period: string,
	contentHash: string,
	geometry?: {
		boundaryRelease: string;
		compatibility: "exact-code-set" | "code-set-compatible";
		note: string;
	},
) => ({
	atlasRelease: { id: registry.contentHash, href: "/v1/atlas-release" },
	measure: {
		id: "population-estimate",
		href: "/v1/measures/population-estimate",
	},
	source: {
		dataset: { id: datasetId, href: `/v1/datasets/${datasetId}` },
		observations: {
			artifact:
				geography === "ward"
					? "population-observations"
					: "population-local-authority-observations",
			contentHash,
			period,
		},
	},
	geography: {
		source: { type: geography, boundaryYear: 2023 },
		match:
			geometry === undefined
				? {
						status: "no-boundary-release-selected",
						note: "The published observations declare a geography type and code vintage, but not a boundary release.",
					}
				: {
						status: "caller-selected-code-join",
						boundaryRelease: geometry.boundaryRelease,
						compatibility: geometry.compatibility,
						href: "/v1/measures/population-estimate/compatibility",
						note: geometry.note,
					},
	},
	transformation: {
		status: "not-applied",
		note: "Values are served source-exact; no geographic conversion or aggregation was applied.",
	},
});

test("publishes datasets, measures and source-exact population observations", () => {
	const datasets = routeWithData("/v1/datasets");
	assert.equal(datasets.status, 200);
	assert.deepEqual(
		"data" in datasets.body && datasets.body.data,
		dataCatalog.datasets,
	);

	const measure = routeWithData("/v1/measures/population-estimate");
	assert.equal(measure.status, 200);
	assert.deepEqual(
		"data" in measure.body && measure.body.data,
		dataCatalog.measures[0],
	);

	const first = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1",
	);
	assert.equal(first.status, 200);
	const firstData = "data" in first.body ? first.body.data : undefined;
	assert.deepEqual(firstData, {
		measure: dataCatalog.measures[0],
		source: dataCatalog.measures[0]?.sources[0],
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		provenance: populationProvenance(
			"population",
			"ward",
			"2022",
			populationObservations.contentHash,
		),
		conversion: null,
		aggregation: null,
		records: [populationObservations.records[0]],
	});
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	const second = routeWithData(
		`/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&cursor=${cursor}`,
	);
	assert.deepEqual("data" in second.body && second.body.data, {
		measure: dataCatalog.measures[0],
		source: dataCatalog.measures[0]?.sources[0],
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		provenance: populationProvenance(
			"population",
			"ward",
			"2022",
			populationObservations.contentHash,
		),
		conversion: null,
		aggregation: null,
		records: [populationObservations.records[1]],
	});

	const localAuthority = routeWithData(
		"/v1/data/population-estimate?period=2024&geography=localAuthority&boundaryYear=2023&areaCode=N09000001",
	);
	assert.equal(localAuthority.status, 200);
	assert.deepEqual(
		"data" in localAuthority.body && localAuthority.body.data,
		{
			measure: dataCatalog.measures[0],
			source: dataCatalog.measures[0]?.sources[1],
			period: "2024",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			provenance: populationProvenance(
				"population-uk",
				"localAuthority",
				"2024",
				populationLocalAuthorityObservations.contentHash,
			),
			conversion: null,
			aggregation: null,
			records: [
				{ areaCode: "N09000001", value: 400, status: "observed" },
			],
		},
	);

	const withGeometry = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc&areaCode=E05000001",
	);
	assert.equal(withGeometry.status, 200);
	assert.deepEqual("data" in withGeometry.body && withGeometry.body.data, {
		measure: dataCatalog.measures[0],
		source: dataCatalog.measures[0]?.sources[0],
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		geometry: {
			boundaryRelease: "2023-05-uk-bgc",
			selection: "caller-specified",
			compatibility: "code-set-compatible",
			areaIdentityTemplate: "ward/2023-05-uk-bgc/{areaCode}",
			note: "Values remain source-exact and are joined to this caller-selected geometry by matching area code. This is not a geometry conversion or an assertion of equal geometry.",
		},
		provenance: populationProvenance(
			"population",
			"ward",
			"2022",
			populationObservations.contentHash,
			{
				boundaryRelease: "2023-05-uk-bgc",
				compatibility: "code-set-compatible",
				note: "Values remain source-exact and are joined to this caller-selected geometry by matching area code. This is not a geometry conversion or an assertion of equal geometry.",
			},
		),
		conversion: null,
		aggregation: null,
		records: [populationObservations.records[0]],
	});

	const withArea = routeRequest(
		"GET",
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc&areaCode=E05000001&include=area",
		{
			boundaryRegistry: registry,
			areaLookup: compatibleWardAreaLookup,
			dataCatalog,
			populationObservations,
			populationLocalAuthorityObservations,
			measureCompatibilityInventory,
		},
	);
	assert.equal(withArea.status, 200);
	const data = "data" in withArea.body ? withArea.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { records: unknown }).records, [
		{
			areaCode: "E05000001",
			value: 100,
			status: "observed",
			area: {
				id: "ward/2023-05-uk-bgc/E05000001",
				code: "E05000001",
				name: "Compatible ward",
			},
		},
	]);

	const includeWithoutRelease = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&include=area",
	);
	assert.equal(includeWithoutRelease.status, 400);

	const csv = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&areaCode=E05000001&format=csv",
	);
	assert.equal(csv.status, 200);
	assert.equal(csv.representation?.contentType, "text/csv; charset=utf-8");
	assert.equal(
		csv.representation?.body,
		'atlasRelease,measureId,unit,datasetId,period,geography,boundaryYear,boundaryRelease,geometryCompatibility,transformationStatus,areaCode,areaId,areaName,areaAliases,value,status,lowerBound,upperBound\n"sha256:registry","population-estimate","people","population","2022","ward","2023","","","not-applied","E05000001","","","","100","observed","",""\n',
	);

	const ndjson = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&areaCode=E05000001&format=ndjson",
	);
	assert.equal(ndjson.status, 200);
	assert.equal(
		ndjson.representation?.contentType,
		"application/x-ndjson; charset=utf-8",
	);
	assert.deepEqual(JSON.parse(String(ndjson.representation?.body)), {
		atlasRelease: "sha256:registry",
		measureId: "population-estimate",
		unit: "people",
		datasetId: "population",
		period: "2022",
		geography: "ward",
		boundaryYear: 2023,
		boundaryRelease: "",
		geometryCompatibility: "",
		transformationStatus: "not-applied",
		areaCode: "E05000001",
		areaId: "",
		areaName: "",
		areaAliases: "",
		value: 100,
		status: "observed",
		lowerBound: "",
		upperBound: "",
	});

	const csvPage = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&format=csv",
	);
	assert.equal(csvPage.status, 200);
	const pageCursor =
		"meta" in csvPage.body ? csvPage.body.meta.nextCursor : null;
	assert.equal(typeof pageCursor, "string");
	assert.equal(
		csvPage.representation?.headers?.link,
		`</v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&format=csv&cursor=${pageCursor}>; rel="next"`,
	);
	assert.equal(
		String(csvPage.representation?.body).trimEnd().split("\n").length,
		2,
	);

	const csvLastPage = routeWithData(
		`/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&format=csv&cursor=${pageCursor}`,
	);
	assert.equal(csvLastPage.status, 200);
	assert.deepEqual(csvLastPage.representation?.headers, {});

	const invalidFormat = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=parquet",
	);
	assert.equal(invalidFormat.status, 400);
});

test("serves categorical winners without numeric operations", () => {
	const measureId = "general-election-winning-party";
	const catalog: DataCatalog = {
		...dataCatalog,
		measures: [
			...dataCatalog.measures,
			{
				id: measureId,
				label: "General election winning party",
				valueKind: "categorical",
				unit: "party",
				aggregation: {
					kind: "categorical",
					available: false,
					note: "A winning-party label cannot be combined numerically.",
				},
				sources: [
					{
						datasetId: "general-election",
						periods: ["2024"],
						sourceGeography: { type: "ward", boundaryYear: 2024 },
						coverage: {
							kind: "partial",
							countries: ["GB-ENG", "GB-WLS"],
							recordCount: 2,
							note: "Fixture winners.",
						},
					},
				],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: false,
				},
				links: { data: `/v1/data/${measureId}` },
			},
		],
	};
	const winners: MeasureObservationArtifact<CategoricalObservation> = {
		schemaVersion: 1,
		contentHash: "sha256:winners",
		measureId,
		sourceGeography: { type: "ward", boundaryYear: 2024 },
		periods: [
			{
				period: "2024",
				records: [
					{
						areaCode: "E05000001",
						category: "LAB",
						status: "observed",
					},
					{
						areaCode: "W05000001",
						category: "PC",
						status: "observed",
					},
				],
			},
		],
	};
	const response = routeWithCatalog(
		`/v1/data/${measureId}?period=2024&geography=ward&boundaryYear=2024`,
		catalog,
		[...measureObservations, winners],
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { records: unknown }).records,
		[
			{ areaCode: "E05000001", category: "LAB", status: "observed" },
			{ areaCode: "W05000001", category: "PC", status: "observed" },
		],
	);
	assert.equal(
		routeWithCatalog(
			`/v1/data/${measureId}/rankings?period=2024&geography=ward&boundaryYear=2024`,
			catalog,
			[...measureObservations, winners],
		).status,
		422,
	);
	assert.equal(
		routeWithCatalog(
			`/v1/data/${measureId}?period=2024&geography=ward&boundaryYear=2024&format=csv`,
			catalog,
			[...measureObservations, winners],
		).status,
		422,
	);
});

test("serves greenhouse gas emissions as a second source-exact measure", () => {
	const measures = routeWithData("/v1/measures");
	assert.deepEqual(
		"data" in measures.body
			? (measures.body.data as Array<{ id: string }>).map(
					(measure) => measure.id,
				)
			: [],
		[
			"population-estimate",
			"ghg-emissions",
			"mobile-5g-coverage",
			"travel-to-work-car",
			"house-price-median",
			"small-area-fixture",
		],
	);

	const observed = routeWithData(
		"/v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2025",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { records: unknown }).records, [
		{ areaCode: "E06000001", value: 400, status: "observed" },
	]);
	// The provenance names the emissions artifact, not a population one.
	assert.equal(
		(
			data as {
				provenance: { source: { observations: { artifact: string } } };
			}
		).provenance.source.observations.artifact,
		"ghg-emissions-observations",
	);

	// A period the measure does not publish is rejected, not served empty.
	assert.equal(
		routeWithData(
			"/v1/data/ghg-emissions?period=1999&geography=localAuthority&boundaryYear=2025",
		).status,
		400,
	);
	// So is the population measure's own code vintage.
	assert.equal(
		routeWithData(
			"/v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2023",
		).status,
		400,
	);
	assert.equal(
		routeWithData("/v1/data/not-a-measure?period=2024").status,
		404,
	);
});

test("carries the measure's unit into a tabular export", () => {
	const csv = routeWithData(
		"/v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2025&format=csv",
	);
	assert.equal(csv.status, 200);
	const [header, first] = String(csv.representation?.body).split("\n");
	assert.ok(header?.startsWith("atlasRelease,measureId,unit,"));
	// Without the unit a saved emissions file is indistinguishable from people.
	assert.ok(first?.includes('"kt CO2e"'));
});

test("publishes a census breakdown as counts with its own denominator", () => {
	const observed = routeWithData(
		"/v1/data/travel-to-work-car?period=2021&geography=localAuthority&boundaryYear=2025",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { records: unknown }).records, [
		{ areaCode: "E06000001", value: 24724, status: "observed" },
	]);

	const measure = routeWithData("/v1/measures/travel-to-work-car");
	const published =
		"data" in measure.body
			? (measure.body.data as {
					valueKind: string;
					unit: string;
					aggregation: { kind: string };
					notes: string[];
				})
			: undefined;
	// A count of people adds over areas, so no weight is needed. The universe
	// is stated, because a share of the wrong denominator is the likelier error.
	assert.equal(published?.valueKind, "count");
	assert.equal(published?.unit, "people in employment");
	assert.equal(published?.aggregation.kind, "extensive");
	assert.match(published?.notes[0] ?? "", /aged 16 and over in employment/);
	assert.match(
		published?.notes.join(" ") ?? "",
		/created in April 2023 are compiled by summing their predecessors/,
	);
});

test("serves a small-area partition on its own geography", () => {
	const observed = routeWithData(
		"/v1/data/small-area-fixture?period=2019&geography=lsoa&boundaryYear=2011",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { sourceGeography: unknown }).sourceGeography, {
		type: "lsoa",
		boundaryYear: 2011,
	});
	assert.equal((data as { records: unknown[] }).records.length, 2);

	// An LSOA partition is not a data zone partition, even for the same year.
	assert.equal(
		routeWithData(
			"/v1/data/small-area-fixture?period=2019&geography=dataZone&boundaryYear=2011",
		).status,
		400,
	);
});

test("keeps aggregation separate from the source-exact observation route", () => {
	const invalidSource = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2024",
	);
	assert.equal(invalidSource.status, 400);
	const incompatibleRelease = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-12-uk-bgc",
	);
	assert.equal(incompatibleRelease.status, 422);
	const aggregation = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&aggregate=sum",
	);
	assert.equal(aggregation.status, 422);
});
