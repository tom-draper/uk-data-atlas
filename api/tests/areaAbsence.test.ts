import assert from "node:assert/strict";
import test from "node:test";
import { explainAreaAbsence } from "../src/areaAbsence";
import { createAreaLookup, type AreaInventory } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";

const release = (geography: string, id: string) => ({
	id,
	geography,
	title: `${geography} ${id}`,
	coverage: { countries: ["GB-ENG"] },
	source: {
		publisher: "ONS",
		url: "https://example.com",
		licence: { name: "Open Government Licence" },
	},
	metadataHash: `sha256:${geography}-${id}`,
});

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		release("localAuthority", "2019-12-uk"),
		release("localAuthority", "2021-05-uk"),
		release("localAuthority", "2023-05-uk"),
		release("localAuthority", "2025-05-uk"),
		release("localAuthority", "unordered"),
	],
};

const areas = (boundaryRelease: string, codes: string[]) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${boundaryRelease}`,
	geography: "localAuthority",
	boundaryRelease,
	codeProperty: "LADCD",
	nameProperty: "LADNM",
	areas: codes.map((code) => ({ code, name: `Area ${code}` })),
});

const areaLookup = createAreaLookup([
	areas("2019-12-uk", ["E07000001", "E06000001"]),
	areas("2021-05-uk", ["E06000001"]),
	areas("2023-05-uk", ["E06000001", "E06000099"]),
	areas("unordered", ["E07000001"]),
]);

const areaInventory: AreaInventory = {
	schemaVersion: 1,
	contentHash: "sha256:area-inventory",
	boundaryRegistryHash: "sha256:registry",
	releases: [
		{
			id: "2025-05-uk",
			geography: "localAuthority",
			status: "not-compiled",
			reason: "The source has no code property.",
		},
	],
};

const explain = (geography: string, boundaryRelease: string, code: string) =>
	explainAreaAbsence(
		registry,
		areaInventory,
		areaLookup,
		geography,
		boundaryRelease,
		code,
	);

test("reports a geography with no published boundary release", () => {
	assert.deepEqual(explain("parish", "2023-05-uk", "E04000001"), {
		code: "unsupported_geography",
		absence: "unknown-geography",
		detail: "No boundary release is published for the geography parish.",
		links: { geographies: "/v1/geographies" },
	});
});

test("lists the published releases when the release is unknown", () => {
	const absence = explain("localAuthority", "2031-01-uk", "E06000001");
	assert.equal(absence.absence, "unknown-release");
	assert.deepEqual(
		"availableReleases" in absence &&
			absence.availableReleases.map((candidate) => candidate.id),
		["2019-12-uk", "2021-05-uk", "2023-05-uk", "2025-05-uk", "unordered"],
	);
});

test("gives the inventory's reason for a release whose identities are not compiled", () => {
	assert.deepEqual(explain("localAuthority", "2025-05-uk", "E06000001"), {
		code: "unsupported_geography",
		absence: "release-not-compiled",
		detail: "Area identities are not compiled for localAuthority/2025-05-uk: The source has no code property.",
		links: {
			boundaryRelease: "/v1/boundary-releases/localAuthority/2025-05-uk",
		},
	});
});

test("places an absent code before or after the release by the releases holding it", () => {
	const superseded = explain("localAuthority", "2023-05-uk", "E07000001");
	assert.equal(superseded.code, "area_not_in_release");
	// The unordered release cannot be placed in time, so a code it holds
	// cannot be called superseded.
	assert.equal(superseded.absence, "absent-from-release");

	const onlyOlder = explainAreaAbsence(
		registry,
		areaInventory,
		createAreaLookup([
			areas("2019-12-uk", ["E07000001"]),
			areas("2023-05-uk", []),
		]),
		"localAuthority",
		"2023-05-uk",
		"E07000001",
	);
	assert.deepEqual(onlyOlder, {
		code: "area_not_in_release",
		absence: "superseded",
		detail: "E07000001 is held only by older releases of this geography, so it was no longer in use by this release. Whether the area was abolished, merged or recoded is not recorded here.",
		presentIn: [
			{
				boundaryRelease: "2019-12-uk",
				name: "Area E07000001",
				href: "/v1/areas/localAuthority/2019-12-uk/E07000001",
			},
		],
	});

	assert.equal(
		explain("localAuthority", "2021-05-uk", "E06000099").absence,
		"not-yet-current",
	);
	assert.equal(
		explain("localAuthority", "2023-05-uk", "E09999999").absence,
		"unknown",
	);
});
