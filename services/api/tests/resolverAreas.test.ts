import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { AreasResolver } from "../src/resolver/areas";

const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:ward-2020",
		geography: "ward",
		boundaryRelease: "2020",
		codeProperty: "WD20CD",
		nameProperty: "WD20NM",
		areas: [{ code: "W001", name: "Old ward" }],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:ward-2024",
		geography: "ward",
		boundaryRelease: "2024",
		codeProperty: "WD24CD",
		nameProperty: "WD24NM",
		areas: [{ code: "W001", name: "Current ward" }],
	},
]);

test("AreasResolver looks up areas and same-code releases", () => {
	const resolver = new AreasResolver({ areaLookup });
	const identity = {
		geography: "ward",
		boundaryRelease: "2024",
		code: "W001",
	};

	assert.equal(resolver.hasAreas(), true);
	assert.deepEqual(resolver.area(identity), {
		code: "W001",
		name: "Current ward",
	});
	assert.deepEqual(resolver.sameCode(identity), [
		{
			id: "ward/2020/W001",
			geography: "ward",
			boundaryRelease: "2020",
			code: "W001",
			name: "Old ward",
			status: "same-code-continuity",
		},
	]);
	assert.equal(resolver.area({ ...identity, code: "missing" }), undefined);
});

test("AreasResolver stays empty when area identities are unavailable", () => {
	const resolver = new AreasResolver({});
	assert.equal(resolver.hasAreas(), false);
	assert.equal(
		resolver.area({
			geography: "ward",
			boundaryRelease: "2024",
			code: "W001",
		}),
		undefined,
	);
	assert.equal(resolver.areaCodes("ward", "2024"), undefined);
});

test("orders same-code history and country identity by registry date", () => {
	const datedLookup = createAreaLookup(
		[
			["ward", "2021-ni", "Northern Ireland snapshot"],
			["ward", "2021-12-uk-bgc", "December snapshot"],
			["ward", "2022-01-uk-bgc", "Current snapshot"],
			["country", "2021-ni", "Northern Ireland country"],
			["country", "2021-12-uk-bgc", "December country"],
		].map(([geography, boundaryRelease, name]) => ({
			schemaVersion: 1 as const,
			contentHash: `sha256:${geography}-${boundaryRelease}`,
			geography,
			boundaryRelease,
			codeProperty: "CODE",
			nameProperty: "NAME",
			areas: [{ code: "E00000001", name }],
		})),
	);
	const boundaryRegistry: BoundaryRegistry = {
		schemaVersion: 1,
		contentHash: "sha256:registry",
		releases: [
			["ward", "2021-ni", "2021"],
			["ward", "2021-12-uk-bgc", "2021"],
			["ward", "2022-01-uk-bgc", "2022"],
			["country", "2021-ni", "2021"],
			["country", "2021-12-uk-bgc", "2021"],
		].map(([geography, id, temporalCoverage]) => ({
			id,
			geography,
			title: id,
			temporalCoverage,
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: `sha256:${id}`,
		})),
	};
	const resolver = new AreasResolver({
		areaLookup: datedLookup,
		boundaryRegistry,
	});

	assert.deepEqual(
		resolver
			.sameCode({
				geography: "ward",
				boundaryRelease: "2022-01-uk-bgc",
				code: "E00000001",
			})
			.map(({ boundaryRelease }) => boundaryRelease),
		["2021-ni", "2021-12-uk-bgc"],
	);
	assert.equal(
		resolver.countryIdentity("E00000001")?.boundaryRelease,
		"2021-12-uk-bgc",
	);
});
