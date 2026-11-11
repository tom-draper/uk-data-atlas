import { expect, it } from "vitest";
import { buildAreaTimeline } from "../../src/places/placeProfileTimeline";

it("records renames and material boundary changes across releases", () => {
	const releases = ["2020-01-01", "2022-01-01"];
	const areas = new Map([
		[releases[0]!, new Map([["E00000001", 10]])],
		[releases[1]!, new Map([["E00000001", 11]])],
	]);
	const result = buildAreaTimeline({
		geography: "ward",
		code: "E00000001",
		releases,
		covering: releases,
		areas,
		nameIn: (release) =>
			release === releases[0] ? "Old name" : "New name",
		relationshipsIn: () => [],
		lastRelationships: [],
		current: true,
		ending: undefined,
	});
	expect(result.timeline).toEqual([
		{ kind: "first-published", release: releases[0], archiveStart: true },
		{
			kind: "renamed",
			release: releases[1],
			from: "Old name",
			to: "New name",
		},
		{ kind: "redrawn", release: releases[1], fromKm2: 10, toKm2: 11 },
	]);
	expect(result.previousCouncil).toBeNull();
});

it("records an ended area even when no successor is known", () => {
	const result = buildAreaTimeline({
		geography: "ward",
		code: "E00000001",
		releases: ["2020-01-01"],
		covering: ["2020-01-01", "2022-01-01"],
		areas: new Map(),
		nameIn: () => "Former ward",
		relationshipsIn: () => [],
		lastRelationships: [],
		current: false,
		ending: "2022-01-01",
	});
	expect(result.timeline.at(-1)).toEqual({
		kind: "ended",
		release: "2022-01-01",
		relation: "none",
		areas: [],
	});
});
