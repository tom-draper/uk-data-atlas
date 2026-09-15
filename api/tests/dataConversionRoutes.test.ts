import assert from "node:assert/strict";
import test from "node:test";
import {
	crosswalkArtifact,
	containmentCrosswalk,
	routeWithData,
} from "./routeFixtures";

test("converts a measure only through a crosswalk the caller names", () => {
	const base =
		"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023";

	// The route never picks a conversion path on the caller's behalf.
	assert.equal(routeWithData(base).status, 400);
	assert.equal(routeWithData(`${base}&crosswalk=not-published`).status, 404);

	// A crosswalk that starts somewhere else cannot convert this partition.
	const wrongStart = routeWithData(
		`${base}&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(wrongStart.status, 422);
	assert.match(
		"detail" in wrongStart.body ? wrongStart.body.detail : "",
		/starts at constituency/,
	);
	assert.equal(
		"code" in wrongStart.body && wrongStart.body.code,
		"conversion_not_available",
	);
	assert.equal(
		"absence" in wrongStart.body && wrongStart.body.absence,
		"crosswalk-geography-mismatch",
	);

	// A source area the crosswalk does not map would drop out of the total.
	const unmapped = routeWithData(
		`${base}&crosswalk=${containmentCrosswalk.id}`,
	);
	assert.equal(unmapped.status, 422);
	assert.deepEqual(
		"code" in unmapped.body && {
			code: unmapped.body.code,
			absence: unmapped.body.absence,
			areaCount: unmapped.body.areaCount,
			areaSample: unmapped.body.areaSample,
		},
		{
			code: "conversion_not_available",
			absence: "source-areas-not-mapped",
			areaCount: 1,
			areaSample: ["W05000001"],
		},
	);

	// A share cannot be regrouped by adding it up.
	const intensive = routeWithData(
		`/v1/data/mobile-5g-coverage/convert?period=2025&geography=localAuthority&boundaryYear=2024&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(intensive.status, 422);
	assert.match(
		"detail" in intensive.body ? intensive.body.detail : "",
		/Only an extensive measure can be converted/,
	);
	assert.equal(
		"code" in intensive.body && intensive.body.code,
		"aggregation_not_supported",
	);
});
