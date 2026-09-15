import assert from "node:assert/strict";
import test from "node:test";
import { routeWithData } from "./routeFixtures";

test("reports a measure quality matrix before querying its observations", () => {
	const response = routeWithData("/v1/measures/small-area-fixture/quality");
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(data as { measure: { id: string } }).measure.id,
		"small-area-fixture",
	);
	assert.deepEqual(
		(
			data as {
				sources: Array<{
					periods: Array<{
						period: string;
						recordCount: number;
						statusCounts: Record<string, number>;
					}>;
				}>;
			}
		).sources[0]?.periods,
		[
			{
				period: "2019",
				artifact: "small-area-fixture-observations",
				contentHash: "sha256:small-area-observations",
				recordCount: 2,
				statusCounts: { observed: 2 },
			},
		],
	);
});
