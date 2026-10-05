import assert from "node:assert/strict";
import test from "node:test";
import { routeWithData } from "./routeFixtures";

const dataOf = (response: ReturnType<typeof routeWithData>) => {
	assert.equal(response.status, 200, JSON.stringify(response.body));
	assert.ok("data" in response.body);
	return response.body.data as { defaults?: Record<string, string | number> };
};

test("data analysis routes select and state the current source defaults", () => {
	const series = dataOf(
		routeWithData(
			"/v1/data/population/series?place=N09000001&geography=localAuthority",
		),
	);
	assert.deepEqual(series.defaults, { boundaryYear: 2023 });

	const table = dataOf(
		routeWithData("/v1/data/population?geography=localAuthority"),
	);
	assert.deepEqual(table.defaults, { period: "2024", boundaryYear: 2023 });

	const rankings = dataOf(
		routeWithData("/v1/data/population/rankings?geography=localAuthority"),
	);
	assert.deepEqual(rankings.defaults, { period: "2024", boundaryYear: 2023 });

	const comparison = dataOf(
		routeWithData(
			"/v1/data/population/compare?geography=localAuthority&baselineAreaCode=E06000001&comparisonAreaCode=N09000001",
		),
	);
	assert.deepEqual(comparison.defaults, {
		period: "2024",
		boundaryYear: 2023,
	});

	const change = dataOf(
		routeWithData("/v1/data/population/change?geography=localAuthority"),
	);
	assert.deepEqual(change.defaults, {
		boundaryYear: 2023,
		startPeriod: "2023",
		endPeriod: "2024",
	});

	const aggregate = dataOf(
		routeWithData(
			"/v1/data/population/aggregate?place=N92000002&geography=localAuthority",
		),
	);
	assert.deepEqual(aggregate.defaults, {
		period: "2024",
		boundaryYear: 2023,
	});
});
