import assert from "node:assert/strict";
import test from "node:test";
import { dataCatalog, routeWithData } from "./routeFixtures";

test("publishes source and boundary code coverage without claiming equal geometry", () => {
	const response = routeWithData("/v1/measures/population-estimate/coverage");
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		measure: {
			id: "population-estimate",
			valueKind: "count",
			unit: "people",
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			href: "/v1/measures/population-estimate",
		},
		sources: [
			{
				dataset: { id: "population", href: "/v1/datasets/population" },
				periods: ["2022"],
				sourceGeography: { type: "ward", boundaryYear: 2023 },
				sourceCoverage: dataCatalog.measures[0]?.sources[0]?.coverage,
				boundaryCoverage: [
					{
						boundaryRelease: "2023-05-uk-bgc",
						title: "Wards, May 2023",
						coverageCountries: ["GB-ENG", "GB-WLS"],
						status: "code-set-compatible",
						sourceAreaCount: 2,
						boundaryAreaCount: 3,
						matchingSourceAreaCount: 2,
						matchingSourceAreaShare: 1,
						unmatchedSourceAreaCount: 0,
						candidateOnlyAreaCount: 1,
						eligibleForCodeJoin: true,
					},
				],
				assessment: {
					status: "assessed",
					href: "/v1/measures/population-estimate/compatibility",
					note: "Boundary coverage compares area-code membership only; it does not assert equal geometry.",
				},
			},
			{
				dataset: {
					id: "population-uk",
					href: "/v1/datasets/population-uk",
				},
				periods: ["2022", "2023", "2024"],
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				sourceCoverage: dataCatalog.measures[0]?.sources[1]?.coverage,
				boundaryCoverage: [],
				assessment: {
					status: "not-assessed",
					note: "No boundary code-coverage assessment has been published for this source partition.",
				},
			},
		],
	});

	const missing = routeWithData("/v1/measures/unknown/coverage");
	assert.equal(missing.status, 404);
});
