import assert from "node:assert/strict";
import { test } from "vitest";
import Fastify from "fastify";
import { measureExportRoutes } from "../src/data/measureExportRoutes";
import { catalogueFastifyRoutes } from "../src/catalogue/catalogueFastifyRoutes";
import type {
	DataCatalog,
	Measure,
	MeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import type { MeasureDimensions } from "@uk-data-atlas/measures";
import { route } from "../src/routes";
import { handleMeasureExport } from "../src/bulkRoutes";
import { handleDataRoutes } from "../src/data/dataRoutes";
import { handleDataSeriesRoutes } from "../src/data/dataSeriesRoutes";
import { dimensionCatalogue } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog,
	geographyInventory,
	measureCompatibilityInventory,
	populationLocalAuthorityObservations,
	populationObservations,
	testContext,
} from "./routeFixtures";

/**
 * Measures named with dimension filters. The fixture publishes crime as three
 * catalogue ids (`crime-total`, `crime-burglary`, `crime-robbery`) and votes
 * for one party from two datasets, and maps them onto `recorded-crimes` by
 * offence and `party-votes` by party.
 */

const template = dataCatalog.measures[0]!;

const wardMeasure = (
	id: string,
	label: string,
	datasetId: string,
	type: "ward" | "localAuthority" = "ward",
): Measure => ({
	...template,
	id,
	label,
	unit: "offences",
	sources: [
		{
			datasetId,
			periods: ["2022"],
			sourceGeography: { type, boundaryYear: 2023 },
			coverage: {
				kind: "partial",
				countries: ["GB-ENG", "GB-WLS"],
				recordCount: 2,
				note: "England and Wales only.",
			},
		},
	],
	links: { data: `/v1/data/${id}` },
});

const observations = (
	measureId: string,
	values: [number, number],
	type: "ward" | "localAuthority" = "ward",
): MeasureObservationArtifact => ({
	schemaVersion: 1,
	contentHash: `sha256:${measureId}`,
	measureId,
	sourceGeography: { type, boundaryYear: 2023 },
	periods: [
		{
			period: "2022",
			records: (type === "ward"
				? ["E05000001", "W05000001"]
				: ["E06000001", "N09000001"]
			).map((areaCode, index) => ({
				areaCode,
				value: values[index]!,
				status: "observed" as const,
			})),
		},
	],
});

const dataset = dataCatalog.datasets[0]!;

const catalog: DataCatalog = {
	...dataCatalog,
	datasets: [
		...dataCatalog.datasets,
		...["crime", "local", "general", "population-uk"]
			.filter(
				(id) => !dataCatalog.datasets.some((held) => held.id === id),
			)
			.map((id) => ({ ...dataset, id })),
	],
	measures: [
		...dataCatalog.measures,
		wardMeasure("crime-total", "Total recorded crime", "crime"),
		{
			...wardMeasure("crime-burglary", "Burglary", "crime"),
			aliases: ["burglary-reports"],
		},
		wardMeasure("crime-robbery", "Robbery", "crime"),
		wardMeasure(
			"local-election-lab-votes",
			"Local votes for Labour",
			"local",
		),
		wardMeasure(
			"general-election-lab-votes",
			"General votes for Labour",
			"general",
			"localAuthority",
		),
	],
};

const measureDimensions: MeasureDimensions = {
	vocabulary: {
		schemaVersion: 1,
		measures: {
			population: {
				label: "Population",
				description: "People.",
				unit: "people",
				valueKind: "count",
				aggregation: "sum",
			},
			"recorded-crimes": {
				label: "Police recorded crime",
				description: "Offences recorded by the police.",
				unit: "offences",
				valueKind: "count",
				aggregation: "sum",
			},
			"party-votes": {
				label: "Party votes",
				description: "Votes cast for a party.",
				unit: "votes",
				valueKind: "count",
				aggregation: "sum",
			},
		},
		dimensions: {
			offence: {
				label: "Offence",
				members: [
					{ code: "total", label: "All recorded crime" },
					{ code: "theft", label: "Theft offences", parent: "total" },
					{ code: "burglary", label: "Burglary", parent: "theft" },
					{ code: "robbery", label: "Robbery", parent: "total" },
				],
			},
			party: {
				label: "Party",
				members: [
					{ code: "lab", label: "Labour" },
					{ code: "con", label: "Conservative" },
				],
			},
		},
	},
	config: {
		schemaVersion: 1,
		measures: {},
		dimensions: {},
		members: {},
		defaults: {},
		ids: {
			population: { measure: "population" },
			"crime-total": {
				measure: "recorded-crimes",
				dimensions: { offence: "total" },
			},
			"crime-burglary": {
				measure: "recorded-crimes",
				dimensions: { offence: "burglary" },
			},
			"crime-robbery": {
				measure: "recorded-crimes",
				dimensions: { offence: "robbery" },
			},
			"local-election-lab-votes": {
				measure: "party-votes",
				dimensions: { party: "lab" },
				datasetId: "local",
			},
			"general-election-lab-votes": {
				measure: "party-votes",
				dimensions: { party: "lab" },
				datasetId: "general",
			},
		},
	},
};

const context = testContext({
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog: catalog,
	measureCompatibilityInventory,
	measureDimensions,
	measureObservations: [
		populationObservations,
		populationLocalAuthorityObservations,
		observations("crime-total", [50, 70]),
		observations("crime-burglary", [5, 7]),
		observations("crime-robbery", [2, 3]),
		observations("local-election-lab-votes", [400, 600]),
		observations(
			"general-election-lab-votes",
			[9000, 8000],
			"localAuthority",
		),
	],
});

const get = (url: string) => route("GET", url, context);
/** The datasets an attribution response credits. */
const resourceIds = (response: ReturnType<typeof get>) =>
	(data(response).resources as Array<{ id: string }>).map(({ id }) => id);
const data = (response: ReturnType<typeof get>) =>
	(response.body as { data: Record<string, unknown> }).data;

test("exports the resolved series using the public measure path", () => {
	const series = dimensionCatalogue(catalog, measureDimensions)
		.measure("recorded-crimes")!
		.series.find((entry) => entry.dimensions.offence === "burglary")!;
	const file = {
		format: "parquet" as const,
		artifact: "burglary.parquet",
		href: "/",
		bytes: 10,
		contentHash: "sha256:burglary",
	};
	const response = handleMeasureExport({
		context: {
			...context,
			exportManifest: {
				schemaVersion: 1,
				contentHash: "sha256:manifest",
				dataCatalogHash: catalog.contentHash,
				fields: {},
				datasets: {},
				exports: [],
				measureExports: [
					{ measureId: "crime-burglary", formats: [file] },
				],
			},
			exportFiles: new Map([
				[file.artifact, { ...file, path: file.artifact }],
			]),
		},
		releaseId: "release",
		parsedUrl: new URL("http://localhost/v1/data/recorded-crimes/export"),
		segments: ["v1", "data", "recorded-crimes", "export"],
		series,
	});
	assert.equal(response.status, 200);
	assert.equal(
		response.representation?.contentType,
		"application/vnd.apache.parquet",
	);
});

test("data handlers use the selected series with a public measure path", () => {
	const series = dimensionCatalogue(catalog, measureDimensions)
		.measure("recorded-crimes")!
		.series.find((entry) => entry.dimensions.offence === "burglary")!;
	const base = {
		context,
		releaseId: "release",
		series,
		dispatch: () => {
			throw new Error("Unexpected dispatch");
		},
	};
	const table = handleDataRoutes({
		...base,
		parsedUrl: new URL("http://localhost/v1/data/recorded-crimes"),
		segments: ["v1", "data", "recorded-crimes"],
	});
	assert.equal(table?.status, 200);
	assert.equal(
		(table!.body as { data: { records: Array<{ value: number }> } }).data
			.records[0]?.value,
		5,
	);
	const temporal = handleDataSeriesRoutes({
		...base,
		parsedUrl: new URL(
			"http://localhost/v1/data/recorded-crimes/series?place=ward/E05000001",
		),
		segments: ["v1", "data", "recorded-crimes", "series"],
	});
	assert.equal(temporal?.status, 200);
});

test("routes a dimensional time series to the selected members", () => {
	const response = get(
		"/v1/data/recorded-crimes/series?place=ward/E05000001&offence=burglary",
	);
	assert.equal(response.status, 200);
	assert.equal(
		(data(response).series as Array<{ value: number }>)[0]?.value,
		5,
	);
});

test("reads a measure with a member filter as that series", () => {
	const response = get(
		"/v1/data/recorded-crimes/value?place=ward/E05000001&offence=burglary",
	);
	assert.equal(response.status, 200);
	const body = data(response);
	assert.deepEqual(
		body.answer && (body.answer as { value: number }).value,
		5,
	);
	assert.deepEqual(body.dimensions, {
		offence: { member: "burglary", label: "Burglary" },
	});
	assert.equal((body.measure as { id: string }).id, "recorded-crimes");
	assert.equal(body.resolvedFrom, undefined);
	assert.match(String(body.via), /^\/v1\/data\/recorded-crimes\/series\?/);
	assert.match(String(body.via), /offence=burglary/);
});

test("takes the dimensions object form of a filter", () => {
	const response = get(
		"/v1/data/recorded-crimes/value?place=ward/E05000001&dimensions%5Boffence%5D=robbery",
	);
	assert.equal(response.status, 200);
	assert.equal((data(response).answer as { value: number }).value, 2);
});

test("uses a dimension's total when the request names no member, and says so", () => {
	const response = get("/v1/data/recorded-crimes/value?place=ward/E05000001");
	assert.equal(response.status, 200);
	const body = data(response);
	assert.equal((body.answer as { value: number }).value, 50);
	assert.deepEqual(body.defaults, { offence: "total" });
	assert.deepEqual(body.dimensions, {
		offence: {
			member: "total",
			label: "All recorded crime",
			defaulted: true,
		},
	});
	assert.match(String(body.note), /No offence was given, so its total/);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/data/recorded-crimes/value?place=ward%2FE05000001&offence=total",
	);
});

test("retired path ids return 404 and reviewed aliases still work", () => {
	for (const path of [
		"/v1/data/crime-burglary/value?place=ward/E05000001",
		"/v1/measures/crime-burglary",
		"/v1/map-resources/ward/latest/join/crime-burglary",
	]) {
		const response = get(path);
		assert.equal(response.status, 404);
		assert.deepEqual(response.body, {
			type: "https://api.ukdataatlas.com/problems/not-found",
			title: "Not Found",
			status: 404,
			detail: "No published measure matches that id.",
		});
	}
	const alias = get("/v1/data/burglary-reports/value?place=ward/E05000001");
	assert.equal(alias.status, 200);
	assert.equal((data(alias).answer as { value: number }).value, 5);
	assert.equal(alias.headers?.deprecation, undefined);
	assert.deepEqual(data(alias).resolvedFrom, {
		id: "burglary-reports",
		measure: "recorded-crimes",
		dimensions: { offence: "burglary" },
	});
	assert.equal(get("/v1/measures/burglary-reports").status, 200);
});

test("registered export and catalogue routes reject retired ids", async () => {
	const app = Fastify();
	await app.register(measureExportRoutes, { prefix: "/v1", context });
	await app.register(catalogueFastifyRoutes, { prefix: "/v1", context });
	try {
		for (const url of [
			"/v1/data/crime-burglary/export",
			"/v1/measures/crime-burglary",
			"/v1/measures/Crime%20Burglary",
		]) {
			const response = await app.inject({ method: "GET", url });
			assert.equal(response.statusCode, 404, url);
			assert.equal(response.json().code, undefined);
		}
		assert.equal(
			(
				await app.inject({
					method: "GET",
					url: "/v1/measures/burglary-reports",
				})
			).statusCode,
			200,
		);
	} finally {
		await app.close();
	}
});

test("answers every member at once for *", () => {
	const response = get(
		"/v1/data/recorded-crimes/value?place=ward/E05000001&offence=*",
	);
	assert.equal(response.status, 200);
	const body = data(response) as {
		breakdown: Array<{
			dimensions: Record<string, { member: string }>;
			data: { answer: { value: number } };
		}>;
	};
	assert.deepEqual(
		body.breakdown.map((entry) => [
			entry.dimensions.offence!.member,
			entry.data.answer.value,
		]),
		[
			["total", 50],
			["burglary", 5],
			["robbery", 2],
		],
	);
});

test("refuses a member or dimension the measure does not have", () => {
	const member = get(
		"/v1/data/recorded-crimes/value?place=Abbey&offence=arson",
	);
	assert.equal(member.status, 400);
	assert.equal(
		(member.body as { code?: string }).code,
		"unknown_dimension_member",
	);
	assert.deepEqual((member.body as { members?: string[] }).members, [
		"total",
		"burglary",
		"robbery",
	]);
	const dimension = get(
		"/v1/data/recorded-crimes/value?place=Abbey&party=lab",
	);
	assert.equal(dimension.status, 400);
	assert.equal(
		(dimension.body as { code?: string }).code,
		"unknown_dimension",
	);
});

test("an operation that answers one series refuses a breakdown with choices", () => {
	const response = get("/v1/data/recorded-crimes?offence=*");
	assert.equal(response.status, 409);
	const body = response.body as {
		code?: string;
		choices?: Array<{ href: string }>;
	};
	assert.equal(body.code, "ambiguous_dimension");
	assert.deepEqual(
		body.choices?.map((choice) => choice.href),
		[
			"/v1/data/recorded-crimes?offence=total",
			"/v1/data/recorded-crimes?offence=burglary",
			"/v1/data/recorded-crimes?offence=robbery",
		],
	);
});

test("tells two datasets' series apart by the place's geography", () => {
	const ward = get(
		"/v1/data/party-votes/value?place=ward/E05000001&party=lab",
	);
	assert.equal(ward.status, 200);
	assert.equal((data(ward).answer as { value: number }).value, 400);
	const table = get("/v1/data/party-votes?party=lab");
	assert.equal(table.status, 409);
	const chosen = get("/v1/data/party-votes?party=lab&datasetId=general");
	assert.equal(chosen.status, 200);
});

test("lists measures with their dimensions and the series each member has", () => {
	const response = get("/v1/measures");
	const measures = data(response) as unknown as Array<{
		id: string;
		dimensions: Array<{ id: string; total?: string; members: unknown[] }>;
		series: Array<{ href: string }>;
	}>;
	const crime = measures.find((measure) => measure.id === "recorded-crimes")!;
	assert.deepEqual(crime.dimensions, [
		{
			id: "offence",
			label: "Offence",
			total: "total",
			members: [
				{ code: "total", label: "All recorded crime" },
				{ code: "burglary", label: "Burglary", parent: "total" },
				{ code: "robbery", label: "Robbery", parent: "total" },
			],
		},
	]);
	assert.deepEqual(
		crime.series.map((series) => series.href),
		[
			"/v1/data/recorded-crimes?offence=total",
			"/v1/data/recorded-crimes?offence=burglary",
			"/v1/data/recorded-crimes?offence=robbery",
		],
	);
	assert.ok(!measures.some((measure) => measure.id === "crime-burglary"));
});

test("finds a measure by a member's name and says which member to filter on", () => {
	const response = get("/v1/measures?q=burglary");
	const [first] = data(response) as unknown as Array<{
		id: string;
		matchedMembers?: Array<{
			dimension: string;
			member: string;
			href: string;
		}>;
	}>;
	assert.equal(first?.id, "recorded-crimes");
	assert.deepEqual(first?.matchedMembers, [
		{
			dimension: "offence",
			member: "burglary",
			label: "Burglary",
			href: "/v1/data/recorded-crimes?offence=burglary",
		},
	]);
});

test("reads a measure in a query parameter with dimension filters as one series", () => {
	for (const query of [
		"measure=recorded-crimes&offence=burglary",
		"measure=recorded-crimes&dimensions%5Boffence%5D=burglary",
	]) {
		const response = get(`/v1/attribution?${query}`);
		assert.equal(response.status, 200, query);
		assert.equal(
			response.headers?.["content-location"],
			"/v1/attribution?measure=recorded-crimes&offence=burglary",
		);
		assert.deepEqual(resourceIds(response), ["crime"]);
	}
	// A dimension left out takes its total, as in a path.
	const total = get("/v1/attribution?measure=recorded-crimes");
	assert.equal(total.status, 200);
	assert.equal(
		total.headers?.["content-location"],
		"/v1/attribution?measure=recorded-crimes",
	);
});

test("applies a filter to each listed measure that has the dimension", () => {
	const response = get(
		"/v1/attribution?measure=recorded-crimes&measure=population&offence=burglary",
	);
	assert.equal(response.status, 200);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/attribution?measure=recorded-crimes&measure=population&offence=burglary",
	);
	const ids = resourceIds(response);
	assert.ok(ids.includes("crime"));
	assert.ok(ids.length > 1);
	// A dimension none of them has is still refused.
	const none = get(
		"/v1/attribution?measure=population&measure=recorded-crimes&party=lab",
	);
	assert.equal(none.status, 400);
	assert.equal((none.body as { code?: string }).code, "unknown_dimension");
});

test("accepts a reviewed alias in a query parameter", () => {
	const response = get("/v1/attribution?measure=burglary-reports");
	assert.equal(response.status, 200);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/attribution?measure=recorded-crimes&offence=burglary",
	);
	assert.deepEqual(resourceIds(response), ["crime"]);
	const conflict = get(
		"/v1/attribution?measure=burglary-reports&offence=robbery",
	);
	assert.equal(conflict.status, 400);
});

test("rejects a retired measure id in a query parameter", () => {
	for (const [url] of [
		["/v1/attribution?measure=crime-burglary", "crime-burglary"],
		[
			"/v1/attribution?measure=recorded-crimes&measure=Crime%20Burglary",
			"Crime Burglary",
		],
		[
			"/v1/relationships?from=ward/2023-05-uk-bgc&to=ward/2025-01-en-ward&measure=crime-burglary",
			"crime-burglary",
		],
	] as const) {
		const response = get(url);
		assert.equal(response.status, 404, url);
		assert.deepEqual(response.body, {
			type: "https://api.ukdataatlas.com/problems/not-found",
			title: "Not Found",
			status: 404,
			detail: "No published measure matches that id.",
		});
	}
});

test("refuses an unknown dimension or member in a measure query parameter", () => {
	const member = get("/v1/attribution?measure=recorded-crimes&offence=arson");
	assert.equal(member.status, 400);
	assert.equal(
		(member.body as { code?: string }).code,
		"unknown_dimension_member",
	);
	assert.deepEqual((member.body as { members?: string[] }).members, [
		"total",
		"burglary",
		"robbery",
	]);
	const dimension = get("/v1/attribution?measure=population&offence=theft");
	assert.equal(dimension.status, 400);
	assert.equal(
		(dimension.body as { code?: string }).code,
		"unknown_dimension",
	);
	const many = get("/v1/attribution?measure=recorded-crimes&offence=*");
	assert.equal(many.status, 409);
	assert.equal((many.body as { code?: string }).code, "ambiguous_dimension");
});

test("chooses between datasets of a measure with datasetId", () => {
	const ambiguous = get("/v1/attribution?measure=party-votes&party=lab");
	assert.equal(ambiguous.status, 409);
	assert.equal(
		(ambiguous.body as { code?: string }).code,
		"ambiguous_dimension",
	);
	const response = get(
		"/v1/attribution?measure=party-votes&measure=recorded-crimes&datasetId=general",
	);
	assert.equal(response.status, 200);
	assert.deepEqual(resourceIds(response).sort(), ["crime", "general"]);
	assert.equal(
		response.headers?.["content-location"],
		"/v1/attribution?datasetId=general&measure=party-votes&measure=recorded-crimes",
	);
});
