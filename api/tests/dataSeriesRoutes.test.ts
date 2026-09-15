import assert from "node:assert/strict";
import test from "node:test";
import { routeWithData } from "./routeFixtures";

test("returns a source-exact series without selecting a geometry release", () => {
	const response = routeWithData(
		"/v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023",
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { series: unknown }).series, [
		{
			period: "2022",
			areaCode: "N09000001",
			value: 380,
			status: "observed",
		},
		{
			period: "2023",
			areaCode: "N09000001",
			value: 390,
			status: "observed",
		},
		{
			period: "2024",
			areaCode: "N09000001",
			value: 400,
			status: "observed",
		},
	]);
	assert.deepEqual(
		(data as { provenance: { source: { observations: unknown } } })
			.provenance.source.observations,
		{
			artifact: "population-local-authority-observations",
			contentHash: "sha256:population-local-authority-observations",
			periods: ["2022", "2023", "2024"],
		},
	);

	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023&release=2023-05-uk-bgc",
		).status,
		422,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/series?areaCode=unknown&geography=localAuthority&boundaryYear=2023",
		).status,
		404,
	);
});
