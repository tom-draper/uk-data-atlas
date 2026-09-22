import assert from "node:assert/strict";
import test from "node:test";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("navigates published relationships in both directions", () => {
	const ward = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/relationships",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(ward.status, 200);
	assert.deepEqual("data" in ward.body && ward.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
		aliases: ["Enghraifft ward"],
		relationships: [
			{
				relation: "within",
				counterpart: {
					id: "localAuthority/2025-01-uk-lad/E08000001",
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
					code: "E08000001",
					labels: ["Greater Manchester"],
				},
				crosswalk: {
					id: "ward-to-local-authority-2025",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
				},
			},
		],
	});

	const localAuthority = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/relationships",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(localAuthority.status, 200);
	const data =
		"data" in localAuthority.body ? localAuthority.body.data : undefined;
	assert.ok(data && typeof data === "object" && "relationships" in data);
	assert.deepEqual((data as { relationships: unknown }).relationships, [
		{
			relation: "contains",
			counterpart: {
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				labels: ["Example ward"],
			},
			crosswalk: {
				id: "ward-to-local-authority-2025",
				method: "clean-containment",
				quality: "publisher-supplied",
				weighting: { status: "not-applicable" },
			},
		},
	]);
});

test("offers focused parent and child containment routes", () => {
	const parents = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/parents",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(parents.status, 200);
	const lineage = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/parents?depth=2",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	const lineageData = ("data" in lineage.body && lineage.body.data) as { ancestors: Array<{ depth: number }> };
	assert.equal(lineageData.ancestors[0]?.depth, 1);
	const descendants = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children?depth=2",
		registry, geographyInventory, areaLookup, crosswalkInventory, crosswalkLookup,
	);
	const descendantData = ("data" in descendants.body && descendants.body.data) as { descendants: Array<{ depth: number }> };
	assert.equal(descendantData.descendants[0]?.depth, 1);
	const parentData = "data" in parents.body ? parents.body.data : undefined;
	assert.ok(parentData && typeof parentData === "object");
	assert.equal(
		(parentData as { relationships: Array<{ relation: string }> })
			.relationships[0]?.relation,
		"within",
	);

	const children = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(children.status, 200);
	const childData = "data" in children.body ? children.body.data : undefined;
	assert.ok(childData && typeof childData === "object");
	assert.equal(
		(childData as { relationships: Array<{ relation: string }> })
			.relationships[0]?.relation,
		"contains",
	);
});
