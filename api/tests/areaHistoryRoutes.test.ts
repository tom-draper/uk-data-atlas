import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { createGeographyResolver } from "../src/geographyResolver";
import type { PropertyCrosswalkArtifact } from "../src/crosswalkInventory";
import {
	crosswalkArtifact,
	geographyInventory,
	registry,
	route,
} from "./routeFixtures";

test("reports same-code continuity without calling it an exact historical match", () => {
	const historyLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2024",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2025",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
	]);
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/history",
		registry,
		geographyInventory,
		historyLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual((data as { sameCodeReleases: unknown }).sameCodeReleases, [
		{
			id: "ward/2024-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			status: "same-code-continuity",
		},
	]);
	assert.match(
		(data as { note: string }).note,
		/does not assert unchanged geometry/,
	);
	const resolver = createGeographyResolver({ areaLookup: historyLookup });
	assert.deepEqual(
		resolver
			.areaHistory({
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
			})
			?.sameCodeReleases.map(({ id }) => id),
		["ward/2024-01-en-ward/E05000001"],
	);
});

// A chain of three vintages. Every crosswalk publishes its link from both
// ends, as a successor edge and a predecessor edge, so a walk that counted
// both would report four edges between three areas and claim a two-hop
// lineage was longer than the graph it came from.
test("reports each published link once, whichever end the walk reaches it from", () => {
	const succession = (
		id: string,
		from: string,
		to: string,
		source: string,
		target: string,
	): PropertyCrosswalkArtifact => ({
		...crosswalkArtifact,
		id,
		contentHash: `sha256:${id}`,
		from: { geography: "constituency", boundaryRelease: from },
		to: { geography: "constituency", boundaryRelease: to },
		records: [
			{
				source: { code: source, labels: [source] },
				targets: [{ code: target, labels: [target] }],
			},
		],
	});
	const seats = createAreaLookup(
		[
			["2010", "E14000001"],
			["2020", "E14000002"],
			["2024", "E14000003"],
		].map(([boundaryRelease, code]) => ({
			schemaVersion: 1 as const,
			contentHash: `sha256:seat-${boundaryRelease}`,
			geography: "constituency",
			boundaryRelease: boundaryRelease!,
			codeProperty: "PCON24CD",
			nameProperty: "PCON24NM",
			areas: [{ code: code!, name: `Seat ${boundaryRelease}` }],
		})),
	);
	const resolver = createGeographyResolver({
		areaLookup: seats,
		crosswalkLookup: new Map(
			[
				succession("seat-2010-to-2020", "2010", "2020", "E14000001", "E14000002"),
				succession("seat-2020-to-2024", "2020", "2024", "E14000002", "E14000003"),
			].map((artifact) => [artifact.id, artifact]),
		),
	});
	const history = resolver.areaHistory({
		geography: "constituency",
		boundaryRelease: "2020",
		code: "E14000002",
	});
	assert.deepEqual(
		history?.lineage.map(({ from, counterpart, relation, depth }) => [
			from,
			counterpart.id,
			relation,
			depth,
		]),
		[
			["constituency/2020/E14000002", "constituency/2010/E14000001", "predecessor", 1],
			["constituency/2020/E14000002", "constituency/2024/E14000003", "successor", 1],
		],
	);
	// The middle seat sits between the other two, so a walk from one end
	// crosses the whole chain and still reports one edge per published link.
	const fromStart = resolver.areaHistory({
		geography: "constituency",
		boundaryRelease: "2010",
		code: "E14000001",
	});
	assert.equal(fromStart?.lineage.length, 2);
	assert.deepEqual(
		fromStart?.lineage.map(({ depth }) => depth),
		[1, 2],
	);
	// A depth of one stops at the neighbour and never reaches the far seat.
	assert.deepEqual(
		resolver
			.areaHistory(
				{ geography: "constituency", boundaryRelease: "2010", code: "E14000001" },
				1,
			)
			?.lineage.map(({ counterpart }) => counterpart.id),
		["constituency/2020/E14000002"],
	);
});
