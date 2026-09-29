import assert from "node:assert/strict";
import test from "node:test";
import {
	areaLookup,
	geographyInventory,
	registry,
	route,
} from "./routeFixtures";

const places = (query: string) => {
	const response = route(
		"GET",
		`/v1/places?${query}`,
		registry,
		geographyInventory,
		areaLookup,
	);
	return {
		status: response.status,
		data: ("data" in response.body ? response.body.data : undefined) as
			| {
					filter?: Record<string, string>;
					selection?: { selected: { id: string } };
					candidates: Array<{
						place: string;
						boundaryReleases: string[];
						href?: string;
					}>;
			  }
			| undefined,
	};
};

test("narrows a name search to one geography", () => {
	assert.deepEqual(
		places("q=Example%20ward&geography=ward").data?.candidates.map(
			({ place }) => place,
		),
		["ward/E05000001"],
	);
	assert.deepEqual(
		places("q=Example%20ward&geography=localAuthority").data?.candidates,
		[],
	);
});

test("finds a name's exact identity in one pinned release", () => {
	const { data } = places(
		"q=E05000001&geography=ward&release=2025-01-en-ward",
	);
	assert.deepEqual(data?.filter, {
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
	});
	assert.deepEqual(
		data?.candidates.map(({ boundaryReleases, href }) => ({
			boundaryReleases,
			href,
		})),
		[
			{
				boundaryReleases: ["2025-01-en-ward"],
				href: "/v1/areas/ward/2025-01-en-ward/E05000001",
			},
		],
	);
	// A release no place is held in leaves nothing to find.
	assert.deepEqual(
		places("q=E05000001&geography=ward&release=1999-01-en-ward").data
			?.candidates,
		[],
	);
});

test("selects the release current on a date, and says how", () => {
	const { status, data } = places(
		"q=Example%20ward&geography=ward&date=2025-02",
	);
	assert.equal(status, 200);
	assert.equal(data?.selection?.selected.id, "2025-01-en-ward");
	assert.equal(
		data?.candidates[0]?.href,
		"/v1/areas/ward/2025-01-en-ward/E05000001",
	);
	// A date picks a release of one geography, so it needs the geography.
	assert.equal(places("q=Example%20ward&date=2025-02").status, 400);
	assert.equal(
		places(
			"q=Example%20ward&geography=ward&release=2025-01-en-ward&date=2025-02",
		).status,
		400,
	);
});

test("leaves an unfiltered search as it was", () => {
	const { data } = places("q=Example%20ward");
	assert.equal(data?.filter, undefined);
	assert.equal(data?.candidates[0]?.href, undefined);
	assert.deepEqual(data?.candidates[0]?.boundaryReleases, [
		"2025-01-en-ward",
	]);
});
