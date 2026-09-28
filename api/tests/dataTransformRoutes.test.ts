import assert from "node:assert/strict";
import test from "node:test";
import { routeWithData } from "./routeFixtures";

test("compares two source-exact areas in an explicit direction", () => {
	const response = routeWithData(
		"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000001&comparisonAreaCode=W05000001",
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { comparison: unknown }).comparison, {
		baseline: { areaCode: "E05000001", value: 100, status: "observed" },
		comparison: { areaCode: "W05000001", value: 200, status: "observed" },
		difference: {
			direction: "comparison-minus-baseline",
			value: 100,
			unit: "people",
			interpretation: "Difference in the source-published unit.",
		},
		relativeDifference: {
			value: 1,
			basis: "(comparison - baseline) / baseline",
		},
	});
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000001&comparisonAreaCode=E05000001",
		).status,
		400,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000001&comparisonAreaCode=W05000001&release=2023-05-uk-bgc",
		).status,
		422,
	);
});
