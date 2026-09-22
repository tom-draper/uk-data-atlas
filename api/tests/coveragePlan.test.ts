import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { coveragePlan } from "../src/coveragePlan";
import type {
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import type { RouteContext } from "../src/routing";
import {
	containmentCrosswalk,
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	registry,
	routeWithData,
} from "./routeFixtures";

// The ward population source holds one English and one Welsh ward. The
// release it is published on adds a Scottish ward no source reaches, which is
// the shape of the real gap: ward population covers England and Wales only.
const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:wards",
		geography: "ward",
		boundaryRelease: "2023-05-uk-bgc",
		codeProperty: "WD23CD",
		nameProperty: "WD23NM",
		areas: [
			{ code: "E05000001", name: "English ward" },
			{ code: "W05000001", name: "Welsh ward" },
			{ code: "S13000001", name: "Scottish ward" },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:districts",
		geography: "localAuthority",
		boundaryRelease: "2023-a",
		codeProperty: "LAD23CD",
		nameProperty: "LAD23NM",
		areas: [
			{ code: "E07000001", name: "English district" },
			{ code: "W06000001", name: "Welsh district" },
		],
	},
]);

// One crosswalk carries both published wards onto a district release.
const crosswalk: PropertyCrosswalkArtifact = {
	...containmentCrosswalk,
	id: "wards-to-lad-a",
	contentHash: "sha256:wards-to-lad-a",
	from: { geography: "ward", boundaryRelease: "2023-05-uk-bgc" },
	to: { geography: "localAuthority", boundaryRelease: "2023-a" },
	records: [
		["E05000001", "E07000001"],
		["W05000001", "W06000001"],
	].map(([source, target]) => ({
		source: { code: source!, labels: [source!] },
		targets: [{ code: target!, labels: [target!] }],
	})),
};

const context: RouteContext = {
	boundaryRegistry: registry,
	areaLookup,
	dataCatalog,
	measureCompatibilityInventory,
	populationObservations,
	populationLocalAuthorityObservations,
	measureObservations,
	crosswalkLookup: new Map([[crosswalk.id, crosswalk]]),
	crosswalkInventory: {
		schemaVersion: 1,
		contentHash: "sha256:crosswalks",
		crosswalks: [
			{
				id: crosswalk.id,
				from: crosswalk.from,
				to: crosswalk.to,
				method: crosswalk.method,
				quality: crosswalk.quality,
				weighting: crosswalk.weighting,
				recordCount: crosswalk.records.length,
				artifact: `crosswalks/${crosswalk.id}.json`,
				contentHash: crosswalk.contentHash,
			},
		],
	} satisfies CrosswalkInventory,
};

const population = dataCatalog.measures.find(
	(measure) => measure.id === "population-estimate",
)!;

test("answers each country on its own, and names the one with no source", () => {
	const plan = coveragePlan(context, population, {
		geography: "ward",
		boundaryRelease: "2023-05-uk-bgc",
	})!;
	assert.deepEqual(
		plan.countries.map(
			({ country, areaCount, coveredAreaCount, status }) => ({
				country,
				areaCount,
				coveredAreaCount,
				status,
			}),
		),
		[
			{
				country: "GB-ENG",
				areaCount: 1,
				coveredAreaCount: 1,
				status: "source-exact",
			},
			{
				country: "GB-SCT",
				areaCount: 1,
				coveredAreaCount: 0,
				status: "missing",
			},
			{
				country: "GB-WLS",
				areaCount: 1,
				coveredAreaCount: 1,
				status: "source-exact",
			},
		],
	);
	assert.deepEqual(plan.summary, {
		areaCount: 3,
		coveredAreaCount: 2,
		countriesServed: ["GB-ENG", "GB-WLS"],
		countriesMissing: ["GB-SCT"],
		unattributedAreaCount: 0,
	});
	// The measure is published for Scotland on another geography, so the plan
	// says what is missing is the route onto this release, not the data.
	assert.match(
		plan.countries[1]!.reason,
		/covers GB-SCT on localAuthority 2023, but no published crosswalk converts that onto ward\/2023-05-uk-bgc/,
	);
});

test("credits a country to the conversion that reaches it", () => {
	const plan = coveragePlan(context, population, {
		geography: "localAuthority",
		boundaryRelease: "2023-a",
	})!;
	assert.deepEqual(
		plan.countries.map(({ country, status, coveredAreaCount }) => ({
			country,
			status,
			coveredAreaCount,
		})),
		[
			{ country: "GB-ENG", status: "converted", coveredAreaCount: 1 },
			{ country: "GB-WLS", status: "converted", coveredAreaCount: 1 },
		],
	);
	assert.equal(plan.countries[0]!.conversion?.crosswalk.id, "wards-to-lad-a");
	assert.equal(plan.countries[0]!.conversion?.method, "exact");
});

test("has no plan for a release it holds no areas for", () => {
	assert.equal(
		coveragePlan(context, population, {
			geography: "ward",
			boundaryRelease: "1998-12-uk",
		}),
		undefined,
	);
});

test("the route answers one exact release, and says so when asked for less", () => {
	const missing = routeWithData(
		"/v1/measures/population-estimate/coverage-plan?geography=ward",
	);
	assert.equal(missing.status, 400);
	assert.match(
		(missing.body as { detail: string }).detail,
		/geography and release are required/,
	);
	assert.equal(
		routeWithData(
			"/v1/measures/not-a-measure/coverage-plan?geography=ward&release=2025-01-en-ward",
		).status,
		404,
	);
	const response = routeWithData(
		"/v1/measures/population-estimate/coverage-plan?geography=ward&release=2025-01-en-ward",
	);
	assert.equal(response.status, 200);
	const { data } = response.body as {
		data: {
			countries: Array<{
				country: string;
				status: string;
				areaCount: number;
				coveredAreaCount: number;
			}>;
		};
	};
	// The fixture release holds two English wards and the source covers one.
	assert.deepEqual(data.countries, [
		{
			country: "GB-ENG",
			areaCount: 2,
			coveredAreaCount: 0,
			status: "missing",
			reason: "This measure covers GB-ENG on ward 2023 and localAuthority 2023, but no published crosswalk converts that onto ward/2025-01-en-ward.",
		},
	]);
});
