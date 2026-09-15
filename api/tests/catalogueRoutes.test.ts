import assert from "node:assert/strict";
import test from "node:test";
import { routeWithData } from "./routeFixtures";

test("declares a coverage share as intensive, so it is never summed", () => {
	const measures = routeWithData("/v1/measures");
	assert.deepEqual(
		"data" in measures.body
			? (
					measures.body.data as Array<{
						id: string;
						aggregation: { kind: string };
					}>
				).map((measure) => [measure.id, measure.aggregation.kind])
			: [],
		[
			["population-estimate", "extensive"],
			["ghg-emissions", "extensive"],
			["mobile-5g-coverage", "intensive"],
			["travel-to-work-car", "extensive"],
			["house-price-median", "non-aggregatable"],
			["small-area-fixture", "extensive"],
		],
	);

	const measure = routeWithData("/v1/measures/mobile-5g-coverage");
	const aggregation =
		"data" in measure.body
			? (measure.body.data as { aggregation: Record<string, unknown> })
					.aggregation
			: undefined;
	// A share cannot be added, and the weight it would need is named rather
	// than silently assumed.
	assert.equal(aggregation?.kind, "intensive");
	assert.equal(aggregation?.operation, "weighted-mean");
	assert.deepEqual(aggregation?.weight, {
		description: "The authority's premises count.",
		datasetField: "premisesCount",
	});
	assert.equal(aggregation?.available, false);

	const observed = routeWithData(
		"/v1/data/mobile-5g-coverage?period=2025&geography=localAuthority&boundaryYear=2024",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { records: unknown }).records, [
		{ areaCode: "E06000001", value: 40.5, status: "observed" },
	]);
	assert.equal(
		(
			data as {
				provenance: { source: { observations: { artifact: string } } };
			}
		).provenance.source.observations.artifact,
		"mobile-5g-coverage-observations",
	);

	// The emissions code vintage is not this measure's.
	assert.equal(
		routeWithData(
			"/v1/data/mobile-5g-coverage?period=2025&geography=localAuthority&boundaryYear=2025",
		).status,
		400,
	);
});
