import assert from "node:assert/strict";
import test from "node:test";
import type { MeasureObservationArtifact } from "@uk-data-atlas/atlas-runtime/catalogue";
import Fastify from "fastify";
import { similarAreasFastifyRoutes } from "../src/areas/similarAreasFastifyRoutes";
import {
	dataCatalog,
	measureObservations,
	populationLocalAuthorityObservations,
	routeWithCatalog,
	testContext,
} from "./routeFixtures";

const population = dataCatalog.measures.find(
	(measure) => measure.id === "population",
)!;
const localAuthoritySource = population.sources.find(
	(source) => source.sourceGeography.type === "localAuthority",
)!;
const sourceGeography = localAuthoritySource.sourceGeography;
const extraMeasures = ["income", "health"].map((id) => ({
	...population,
	id,
	label: id,
	sources: [{ ...localAuthoritySource, datasetId: id }],
	links: { data: `/v1/data/${id}` },
}));
const similarCatalog = {
	...dataCatalog,
	measures: [...dataCatalog.measures, ...extraMeasures],
};
const similarObservations = [
	...measureObservations,
	populationLocalAuthorityObservations,
	{
		schemaVersion: 1,
		contentHash: "sha256:income-observations",
		measureId: "income",
		sourceGeography,
		periods: [
			{
				period: "2024",
				records: [
					{ areaCode: "E06000001", value: 10, status: "observed" },
					{ areaCode: "N09000001", value: 20, status: "observed" },
				],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:health-observations",
		measureId: "health",
		sourceGeography,
		periods: [
			{
				period: "2024",
				records: [
					{ areaCode: "E06000001", value: 2, status: "observed" },
					{ areaCode: "N09000001", value: 4, status: "observed" },
				],
			},
		],
	},
] satisfies MeasureObservationArtifact[];

const request =
	"/v1/areas/localAuthority/E06000001/similar?measures=population,income,health&period=2024";

test("finds similar areas through the Fastify contract route", async (t) => {
	const app = Fastify({ exposeHeadRoutes: false });
	await app.register(similarAreasFastifyRoutes, {
		prefix: "/v1",
		context: testContext({
			dataCatalog: similarCatalog,
			measureObservations: similarObservations,
		}),
	});
	t.after(() => app.close());
	const response = await app.inject(request);
	assert.equal(response.statusCode, 200, response.body);
	assert.deepEqual(response.json().data, {
		target: { geography: "localAuthority", code: "E06000001" },
		method: "zscore-euclidean",
		measures: [
			{
				id: "population",
				period: "2024",
				sourceGeography: {
					type: sourceGeography.type,
					codeYear: sourceGeography.boundaryYear,
				},
				mean: 350,
				standardDeviation: 50,
			},
			{
				id: "income",
				period: "2024",
				sourceGeography: {
					type: sourceGeography.type,
					codeYear: sourceGeography.boundaryYear,
				},
				mean: 15,
				standardDeviation: 5,
			},
			{
				id: "health",
				period: "2024",
				sourceGeography: {
					type: sourceGeography.type,
					codeYear: sourceGeography.boundaryYear,
				},
				mean: 3,
				standardDeviation: 1,
			},
		],
		droppedAreaCount: 0,
		areas: [
			{
				areaCode: "N09000001",
				distance: Math.sqrt(12),
				rank: 1,
				values: { population: 400, income: 20, health: 4 },
			},
		],
	});
});

test("refuses an unknown target area", () => {
	const response = routeWithCatalog(
		request.replace("E06000001", "E06000999"),
		similarCatalog,
		similarObservations,
	);
	assert.equal(response.status, 404);
});

test("refuses partitions with different boundary years", () => {
	const differentYear = {
		...extraMeasures[0]!,
		sources: [
			{
				...localAuthoritySource,
				datasetId: "income",
				sourceGeography: {
					...sourceGeography,
					boundaryYear: sourceGeography.boundaryYear - 1,
				},
			},
		],
	};
	const response = routeWithCatalog(
		request,
		{
			...dataCatalog,
			measures: [
				...dataCatalog.measures,
				differentYear,
				extraMeasures[1]!,
			],
		},
		similarObservations,
	);
	assert.equal(response.status, 422);
});

test("refuses a measure that is not served for the requested period", () => {
	const response = routeWithCatalog(
		"/v1/areas/localAuthority/E06000001/similar?measures=population,mobile-5g-coverage&period=2024",
		similarCatalog,
		similarObservations,
	);
	assert.equal(response.status, 400);
});

test("caps the number of requested measures", () => {
	const response = routeWithCatalog(
		`/v1/areas/localAuthority/E06000001/similar?measures=${Array.from(
			{ length: 11 },
			() => "population",
		).join(",")}&period=2024`,
		similarCatalog,
		similarObservations,
	);
	assert.equal(response.status, 400);
});
