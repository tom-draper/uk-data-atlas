import assert from "node:assert/strict";
import { test } from "vitest";
import { routeWithData } from "./routeFixtures";

test("ranks one source-exact partition with stable cursors", () => {
	const first = routeWithData(
		"/v1/data/population/rankings?period=2022&geography=ward&codeYear=2023&limit=1",
	);
	assert.equal(first.status, 200);
	const firstData = "data" in first.body ? first.body.data : undefined;
	assert.ok(firstData && typeof firstData === "object");
	assert.deepEqual((firstData as { records: unknown }).records, [
		{
			areaCode: "W05000001",
			value: 200,
			status: "observed",
			rank: 1,
			tieCount: 1,
		},
	]);
	assert.deepEqual((firstData as { ranking: unknown }).ranking, {
		order: "desc",
		method: "competition",
		note: "Equal values share a rank; the following rank accounts for every preceding observation (for example 1, 1, 3).",
	});
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	const second = routeWithData(
		`/v1/data/population/rankings?period=2022&geography=ward&codeYear=2023&limit=1&cursor=${cursor}`,
	);
	assert.deepEqual(
		"data" in second.body &&
			(second.body.data as { records: unknown }).records,
		[
			{
				areaCode: "E05000001",
				value: 100,
				status: "observed",
				rank: 2,
				tieCount: 1,
			},
		],
	);
	const reordered = routeWithData(
		`/v1/data/population/rankings?period=2022&geography=ward&codeYear=2023&limit=1&order=asc&cursor=${cursor}`,
	);
	assert.equal(reordered.status, 400);
	assert.equal(
		"code" in reordered.body && reordered.body.code,
		"invalid_cursor",
	);
	const explicitDefaults = routeWithData(
		`/v1/data/population/rankings?order=desc&datasetId=population&geography=ward&codeYear=2023&period=2022&cursor=${cursor}`,
	);
	assert.equal(explicitDefaults.status, 200);

	assert.equal(
		routeWithData(
			"/v1/data/population/rankings?period=2022&geography=ward&codeYear=2023&order=sideways",
		).status,
		400,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population/rankings?period=2022&geography=ward&codeYear=2023&release=2023-05-uk-bgc",
		).status,
		422,
	);
});

test("rejects a ranking cursor for another period or operation", () => {
	const query = "geography=localAuthority&codeYear=2023&limit=1";
	const first = routeWithData(
		`/v1/data/population/rankings?${query}&period=2022`,
	);
	assert.equal(first.status, 200);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.ok(cursor);
	for (const path of [
		`/v1/data/population/rankings?${query}&period=2023`,
		`/v1/data/population?${query}&period=2022`,
	]) {
		const refused = routeWithData(`${path}&cursor=${cursor}`);
		assert.equal(refused.status, 400);
		assert.equal(
			"code" in refused.body && refused.body.code,
			"invalid_cursor",
		);
	}
});
