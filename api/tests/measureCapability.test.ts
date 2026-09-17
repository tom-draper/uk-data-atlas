import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_STATUSES } from "../src/capability";
import type {
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import { measureCapability } from "../src/measureCapability";
import type { RouteContext } from "../src/routing";
import {
	containmentCrosswalk,
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	registry,
} from "./routeFixtures";

// The ward population source holds E05000001 and W05000001. One crosswalk
// carries both onto a district release; the other drops the Welsh ward, so a
// conversion through it would lose a value and is refused.
const crosswalk = (
	id: string,
	boundaryRelease: string,
	codes: string[],
): PropertyCrosswalkArtifact => ({
	...containmentCrosswalk,
	id,
	contentHash: `sha256:${id}`,
	from: { geography: "ward", boundaryRelease: "2023-05-uk-bgc" },
	to: { geography: "localAuthority", boundaryRelease },
	records: codes.map((code) => ({
		source: { code, labels: [code] },
		targets: [{ code: `LAD-${code}`, labels: [code] }],
	})),
});
const complete = crosswalk("wards-to-lad-a", "2023-a", [
	"E05000001",
	"W05000001",
]);
const incomplete = crosswalk("wards-to-lad-b", "2023-b", ["E05000001"]);

const context: RouteContext = {
	boundaryRegistry: registry,
	dataCatalog,
	measureCompatibilityInventory,
	populationObservations,
	populationLocalAuthorityObservations,
	measureObservations,
	crosswalkLookup: new Map([
		[complete.id, complete],
		[incomplete.id, incomplete],
	]),
	crosswalkInventory: {
		schemaVersion: 1,
		contentHash: "sha256:crosswalks",
		crosswalks: [complete, incomplete].map((artifact) => ({
			id: artifact.id,
			from: artifact.from,
			to: artifact.to,
			method: artifact.method,
			quality: artifact.quality,
			weighting: artifact.weighting,
			recordCount: artifact.records.length,
			artifact: `crosswalks/${artifact.id}.json`,
			contentHash: artifact.contentHash,
		})),
	} satisfies CrosswalkInventory,
};

const population = dataCatalog.measures.find(
	(measure) => measure.id === "population-estimate",
)!;

test("answers from a source published on the release", () => {
	const capability = measureCapability(context, population, {
		geography: "ward",
		boundaryRelease: "2023-05-uk-bgc",
	});
	// Every source value joins, but the release has a ward the source omits.
	assert.equal(capability.status, "partial");
	assert.match(capability.reason!, /areas the source gives no value for/);
});

test("offers only a conversion the convert route would accept", () => {
	const capability = measureCapability(context, population, {
		geography: "localAuthority",
		boundaryRelease: "2023-a",
	});
	assert.equal(capability.status, "requires-conversion");
	assert.deepEqual("conversions" in capability && capability.conversions, [
		{
			crosswalk: {
				id: "wards-to-lad-a",
				method: "clean-containment",
				quality: "publisher-supplied",
			},
			source: {
				datasetId: "population",
				geography: "ward",
				boundaryYear: 2023,
				period: "2022",
			},
			method: "exact",
			href: "/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023&crosswalk=wards-to-lad-a",
		},
	]);

	// The only crosswalk onto this release would drop a source ward.
	const refused = measureCapability(context, population, {
		geography: "localAuthority",
		boundaryRelease: "2023-b",
	});
	assert.equal(refused.status, "unsupported");
});

test("offers a conversion for an area only when it reaches that area", () => {
	assert.equal(
		measureCapability(context, population, {
			geography: "localAuthority",
			boundaryRelease: "2023-a",
			code: "LAD-W05000001",
		}).status,
		"requires-conversion",
	);
	assert.equal(
		measureCapability(context, population, {
			geography: "localAuthority",
			boundaryRelease: "2023-a",
			code: "LAD-S00000000",
		}).status,
		"unsupported",
	);
});

test("never converts a measure whose values do not add over areas", () => {
	const intensive = dataCatalog.measures.find(
		(measure) => measure.aggregation.kind !== "extensive",
	)!;
	const capability = measureCapability(context, intensive, {
		geography: "localAuthority",
		boundaryRelease: "2023-a",
	});
	assert.equal(capability.status, "unsupported");
	assert.match(capability.reason!, /do not add over areas/);
});

test("says when the catalogue it would read is not built", () => {
	const capability = measureCapability(
		{ boundaryRegistry: registry },
		population,
		{ geography: "ward", boundaryRelease: "2023-05-uk-bgc" },
	);
	assert.equal(capability.status, "not-built");
	assert.ok(CAPABILITY_STATUSES.includes(capability.status));
});
