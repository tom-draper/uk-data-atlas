import assert from "node:assert/strict";
import test from "node:test";
import { attributionFor, attributionText } from "../src/attribution";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import type { DataCatalog } from "../src/dataCatalog";

const dataCatalog = {
	datasets: [
		{
			id: "population",
			label: "Population",
			publisher: "Office for National Statistics",
			sourceUrl: "https://example.com/population",
			licence: { name: "Open Government Licence v3.0" },
		},
		{
			id: "local-election",
			label: "Local Election Results",
			publisher:
				"House of Commons Library; Local Elections Archive Project",
			sourceUrl: "https://example.com/elections",
			licence: {
				name: "Open Parliament Licence (2021-2025); CC BY-SA 3.0 (2016-2019)",
			},
		},
	],
	measures: [
		{
			id: "population-estimate",
			sources: [{ datasetId: "population" }],
		},
	],
} as unknown as DataCatalog;

const boundaryRegistry = {
	releases: [
		{
			id: "2023-05-uk-bgc",
			geography: "ward",
			title: "Wards, May 2023",
			source: {
				publisher: "Office for National Statistics",
				url: "https://geoportal.example",
				licence: { name: "Open Government Licence v3.0" },
			},
		},
		{
			id: "2023-05-uk-bgc-v2",
			geography: "localAuthority",
			title: "Local authority districts, May 2023",
			source: {
				publisher: "Office for National Statistics",
				url: "https://geoportal.example",
				licence: { name: "Open Government Licence v3.0" },
			},
		},
	],
} as unknown as BoundaryRegistry;

const crosswalkInventory = {
	crosswalks: [
		{
			id: "ward-to-lad",
			method: "clean-containment",
			from: { geography: "ward", boundaryRelease: "2023-05-uk-bgc" },
			to: {
				geography: "localAuthority",
				boundaryRelease: "2023-05-uk-bgc-v2",
			},
		},
	],
} as unknown as CrosswalkInventory;

const request = (over: Partial<Record<string, string[]>> = {}) => ({
	datasets: [],
	measures: [],
	boundaryReleases: [],
	crosswalks: [],
	...over,
});

test("attributes a measure through the datasets behind it", () => {
	const result = attributionFor(
		request({ measures: ["population-estimate"] }),
		dataCatalog,
		boundaryRegistry,
		crosswalkInventory,
	);

	assert.equal(result.status, "resolved");
	if (result.status !== "resolved") return;
	assert.deepEqual(
		result.resources.map((resource) => [resource.kind, resource.id]),
		[["dataset", "population"]],
	);
});

test("attributes a crosswalk through the boundary releases it was built from", () => {
	const result = attributionFor(
		request({ crosswalks: ["ward-to-lad"] }),
		dataCatalog,
		boundaryRegistry,
		crosswalkInventory,
	);

	assert.equal(result.status, "resolved");
	if (result.status !== "resolved") return;
	// The crosswalk carries no licence of its own, so its endpoints appear.
	assert.deepEqual(
		result.resources.map((resource) => resource.id),
		[
			"ward/2023-05-uk-bgc",
			"localAuthority/2023-05-uk-bgc-v2",
			"ward-to-lad",
		],
	);
	const crosswalk = result.resources.at(-1);
	assert.equal(crosswalk?.licence, undefined);
	assert.deepEqual(crosswalk?.derivedFrom, [
		"ward/2023-05-uk-bgc",
		"localAuthority/2023-05-uk-bgc-v2",
	]);
});

test("lists a resource once however many ways it was named", () => {
	const result = attributionFor(
		request({
			datasets: ["population"],
			measures: ["population-estimate"],
			boundaryReleases: ["ward/2023-05-uk-bgc"],
			crosswalks: ["ward-to-lad"],
		}),
		dataCatalog,
		boundaryRegistry,
		crosswalkInventory,
	);

	assert.equal(result.status, "resolved");
	if (result.status !== "resolved") return;
	assert.equal(
		result.resources.filter((resource) => resource.id === "population")
			.length,
		1,
	);
	assert.equal(
		result.resources.filter(
			(resource) => resource.id === "ward/2023-05-uk-bgc",
		).length,
		1,
	);
});

test("reports every unknown resource rather than the first", () => {
	const result = attributionFor(
		request({ datasets: ["nope"], crosswalks: ["also-nope"] }),
		dataCatalog,
		boundaryRegistry,
		crosswalkInventory,
	);

	assert.equal(result.status, "unknown");
	if (result.status !== "unknown") return;
	assert.deepEqual(result.unknownResources, [
		"dataset=nope",
		"crosswalk=also-nope",
	]);
});

test("keeps entries on their own lines when a name contains a semicolon", () => {
	const result = attributionFor(
		request({ datasets: ["population", "local-election"] }),
		dataCatalog,
		boundaryRegistry,
		crosswalkInventory,
	);
	assert.equal(result.status, "resolved");
	if (result.status !== "resolved") return;

	const text = attributionText(
		result.resources,
		result.licences,
		"sha256:release",
	);

	// Two licences, one of which contains its own semicolon: joining them
	// inline would read as three.
	assert.equal(result.licences.length, 2);
	assert.match(
		text,
		/Licences:\n- Open Government Licence v3\.0\n- Open Parliament/,
	);
	assert.match(
		text,
		/Compiled by the UK Data Atlas, release sha256:release\./,
	);
});

test("names a single licence in the singular, inline", () => {
	const result = attributionFor(
		request({ datasets: ["population"] }),
		dataCatalog,
		boundaryRegistry,
		crosswalkInventory,
	);
	assert.equal(result.status, "resolved");
	if (result.status !== "resolved") return;

	const text = attributionText(result.resources, result.licences, "sha256:x");
	assert.match(
		text,
		/^Data: Population \u2014 Office for National Statistics\.$/m,
	);
	assert.match(text, /^Licence: Open Government Licence v3\.0\.$/m);
});
