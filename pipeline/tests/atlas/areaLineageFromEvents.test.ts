import assert from "node:assert/strict";
import { test } from "vitest";
import { followLineage, isRealigned } from "@uk-data-atlas/geography";
import type { AtlasVintages } from "@uk-data-atlas/geography";
import { compileLineagesFromEvents } from "../../src/atlas/areaLineageFromEvents";
import { writeAreaChangeEvents } from "../../src/storage/areaChangeEvents";
import { edge, fixture } from "../storage/areaChangeFixture";

const vintages = {
	ward: { 2020: "2020", 2021: "2021", 2022: "2022" },
	lsoa: {},
	parish: {},
	localAuthority: {},
	constituency: {},
} as AtlasVintages;

/** 2020 to 2021 is an extent-continuity crosswalk, 2021 to 2022 an official lookup. */
const lineage = () => {
	const { db, v } = fixture();
	db.prepare(
		"INSERT INTO crosswalk VALUES (1, 'continuity', 'extent-continuity', 'identity', 1, 2, ?)",
	).run(
		JSON.stringify({
			continuity: {
				// B moved by a street into B2. C changed extent and no successor is claimed.
				realigned: [{ code: "B", successor: "B2" }],
				changedExtent: [{ code: "C" }],
			},
		}),
	);
	edge(db, 1, v("2020", "A"), v("2021", "A"));
	edge(db, 1, v("2020", "D"), v("2021", "D"));
	db.prepare(
		"INSERT INTO crosswalk VALUES (2, 'lookup', 'official-lookup', NULL, 2, 3, NULL)",
	).run();
	for (const code of ["A", "B2", "C"])
		edge(db, 2, v("2021", code), v("2022", code));
	writeAreaChangeEvents(db);
	return compileLineagesFromEvents(db, vintages).ward!;
};

test("the lineage follows realigned and unchanged areas between releases", () => {
	const ward = lineage();
	assert.deepEqual(ward.releases, ["2020", "2021", "2022"]);
	assert.equal(followLineage(ward, "A", "2020", "2022"), "A");
	assert.equal(followLineage(ward, "B", "2020", "2021"), "B2");
	assert.equal(followLineage(ward, "B2", "2021", "2020"), "B");
	assert.equal(isRealigned(ward, "B", "2020", "2021"), true);
	assert.equal(isRealigned(ward, "A", "2020", "2021"), false);
});

test("a realigned area is realigned across the releases that follow", () => {
	const ward = lineage();
	assert.equal(followLineage(ward, "B", "2020", "2022"), "B2");
	assert.equal(isRealigned(ward, "B", "2020", "2022"), true);
});

test("an area that changed extent unclaimed, or ended, has no same area", () => {
	const ward = lineage();
	assert.equal(followLineage(ward, "C", "2020", "2021"), undefined);
	assert.equal(followLineage(ward, "D", "2021", "2022"), undefined);
	assert.equal(followLineage(ward, "D", "2020", "2022"), undefined);
	// E was created in 2022.
	assert.equal(followLineage(ward, "E", "2022", "2021"), undefined);
});

test("a realigned area still succeeds itself where an official lookup adds a sliver", () => {
	const { db, v } = fixture();
	db.prepare(
		"INSERT INTO crosswalk VALUES (1, 'continuity', 'extent-continuity', 'identity', 1, 2, ?)",
	).run(
		JSON.stringify({
			continuity: { realigned: [{ code: "B", successor: "B2" }] },
		}),
	);
	edge(db, 1, v("2020", "A"), v("2021", "A"));
	// The official lookup for the same pair wins, and sends a sliver of B to C.
	db.prepare(
		"INSERT INTO crosswalk VALUES (2, 'lookup', 'official-lookup', NULL, 1, 2, NULL)",
	).run();
	edge(db, 2, v("2020", "A"), v("2021", "A"));
	edge(db, 2, v("2020", "B"), v("2021", "B2"));
	edge(db, 2, v("2020", "B"), v("2021", "C"));
	writeAreaChangeEvents(db);
	const ward = compileLineagesFromEvents(db, vintages).ward!;
	assert.equal(followLineage(ward, "B", "2020", "2021"), "B2");
	assert.equal(followLineage(ward, "B2", "2021", "2020"), "B");
	assert.equal(isRealigned(ward, "B", "2020", "2021"), true);
	// The sliver names no same area of its own.
	assert.equal(followLineage(ward, "C", "2021", "2020"), undefined);
});

test("an area that kept its extent under a new code still succeeds itself inside a lookup's redistribution", () => {
	const { db, v } = fixture();
	// The lookup ties B and C to B2 and C together, so the event is a redistribution.
	db.prepare(
		"INSERT INTO crosswalk VALUES (1, 'lookup', 'official-lookup', NULL, 1, 2, NULL)",
	).run();
	edge(db, 1, v("2020", "B"), v("2021", "B2"));
	edge(db, 1, v("2020", "B"), v("2021", "C"));
	edge(db, 1, v("2020", "C"), v("2021", "C"));
	// The continuity crosswalk of the same pair knows B kept its extent as B2.
	db.prepare(
		"INSERT INTO crosswalk VALUES (2, 'continuity', 'extent-continuity', 'identity', 1, 2, ?)",
	).run(JSON.stringify({ continuity: {} }));
	edge(db, 2, v("2020", "B"), v("2021", "B2"));
	writeAreaChangeEvents(db);
	assert.equal(
		db
			.prepare(
				"SELECT kind FROM area_change_event WHERE kind = 'redistributed'",
			)
			.all().length,
		1,
	);
	const ward = compileLineagesFromEvents(db, vintages).ward!;
	assert.equal(followLineage(ward, "B", "2020", "2021"), "B2");
	assert.equal(followLineage(ward, "B2", "2021", "2020"), "B");
	assert.equal(isRealigned(ward, "B", "2020", "2021"), true);
});
