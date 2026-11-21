import assert from "node:assert/strict";
import { test } from "vitest";
import {
	buildAreaChangeEvents,
	selectIdentityCrosswalks,
	writeAreaChangeEvents,
} from "../../src/storage/areaChangeEvents";
import { edge, fixture } from "./areaChangeFixture";

test("a publisher's lookup that declares no purpose is an identity crosswalk", () => {
	const { db, v } = fixture();
	db.prepare("INSERT INTO crosswalk VALUES (1, 'lookup', 'official-lookup', NULL, 1, 2, NULL)").run();
	db.prepare("INSERT INTO crosswalk VALUES (2, 'derived', 'area-overlap', NULL, 2, 3, NULL)").run();
	db.prepare("INSERT INTO crosswalk VALUES (3, 'membership', 'clean-containment', 'membership', 1, 3, NULL)").run();
	edge(db, 1, v("2020", "A"), v("2021", "A"));
	assert.deepEqual(
		selectIdentityCrosswalks(db).map((crosswalk) => crosswalk.id),
		[1],
	);
});

test("an extent-continuity crosswalk's realigned and redrawn areas become events", () => {
	const { db, v } = fixture();
	db.prepare(
		"INSERT INTO crosswalk VALUES (1, 'continuity', 'extent-continuity', 'identity', 1, 2, ?)",
	).run(
		JSON.stringify({
			continuity: {
				changedExtent: [{ code: "C" }, { code: "D" }],
				// B moved by a street into B2; C kept its code and was matched.
				realigned: [
					{ code: "B", successor: "B2" },
					{ code: "C", successor: "C" },
				],
			},
		}),
	);
	edge(db, 1, v("2020", "A"), v("2021", "A"));
	const events = buildAreaChangeEvents(db).map(({ change }) => ({
		kind: change.kind,
		realigned: change.realigned,
		from: change.from.map((area) => area.code),
		to: change.to.map((area) => area.code),
	}));
	assert.deepEqual(events, [
		{ kind: "recoded", realigned: true, from: ["B"], to: ["B2"] },
		{ kind: "redrawn", realigned: true, from: ["C"], to: ["C"] },
		// D changed extent and no successor is claimed.
		{ kind: "redrawn", realigned: false, from: ["D"], to: ["D"] },
	]);
});

test("the tables hold the realigned flag, and the view shows it", () => {
	const { db, v } = fixture();
	db.prepare(
		"INSERT INTO crosswalk VALUES (1, 'continuity', 'extent-continuity', 'identity', 1, 2, ?)",
	).run(
		JSON.stringify({
			continuity: { realigned: [{ code: "B", successor: "B2" }] },
		}),
	);
	edge(db, 1, v("2020", "A"), v("2021", "A"));
	const counts = writeAreaChangeEvents(db);
	assert.deepEqual(Object.fromEntries(counts), { recoded: 1 });
	assert.deepEqual(
		db
			.prepare("SELECT kind, realigned, side, code FROM v_area_change ORDER BY side, code")
			.all()
			.map((row) => ({ ...row })),
		[
			{ kind: "recoded", realigned: 1, side: "from", code: "B" },
			{ kind: "recoded", realigned: 1, side: "to", code: "B2" },
		],
	);
});
