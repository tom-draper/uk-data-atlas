import assert from "node:assert/strict";
import { test } from "vitest";
import {
	endOfMonth,
	matchLegalDate,
	parseLegalDates,
	type DatableChange,
} from "../../src/storage/legalDates";

const dates = parseLegalDates(
	[
		"predecessor,successor,date,entity",
		"W1,W2,2019-04-01,E05",
		"W1,W3,2019-04-01,E05",
		"R1,R2,2009-01-01,E05",
		"M1,M2,2018-06-01,E05",
		"M1,M2,2019-02-15,E05",
	].join("\n"),
	[
		"code,introduced,terminated,entity",
		"C1,2019-03-01,,E05",
		"E1,2009-01-01,2019-03-31,E05",
		"O1,2009-01-01,,E05",
	].join("\n"),
);

const change = (overrides: Partial<DatableChange>): DatableChange => ({
	kind: "split",
	fromCodes: ["W1"],
	toCodes: ["W2", "W3"],
	fromEdition: "2018-12-01",
	toEdition: "2019-12-01",
	...overrides,
});

test("a split is dated by the operative date of its pairs", () => {
	assert.deepEqual(matchLegalDate(change({}), dates), {
		date: "2019-04-01",
		via: "change",
	});
});

test("a date outside the editions that bound the event is not used", () => {
	assert.deepEqual(
		matchLegalDate(
			change({ kind: "recoded", fromCodes: ["R1"], toCodes: ["R2"] }),
			dates,
		),
		{ date: null, via: "out-of-window" },
	);
});

test("the earliest date inside the window is used where a pair has several", () => {
	assert.deepEqual(
		matchLegalDate(
			change({
				kind: "recoded",
				fromCodes: ["M1"],
				toCodes: ["M2"],
				fromEdition: "2018-12-01",
			}),
			dates,
		),
		{ date: "2019-02-15", via: "change" },
	);
	assert.deepEqual(
		matchLegalDate(
			change({
				kind: "recoded",
				fromCodes: ["M1"],
				toCodes: ["M2"],
				fromEdition: "2018-05-01",
			}),
			dates,
		),
		{ date: "2018-06-01", via: "change" },
	);
});

test("the later edition's whole month is inside the window", () => {
	assert.equal(
		matchLegalDate(
			change({ toEdition: "2019-04-01", fromEdition: "2018-04-01" }),
			dates,
		).date,
		"2019-04-01",
	);
	assert.equal(
		matchLegalDate(
			change({ toEdition: "2019-03-01", fromEdition: "2018-04-01" }),
			dates,
		).date,
		null,
	);
});

test("a created area is dated by when its code came into use", () => {
	assert.deepEqual(
		matchLegalDate(
			change({ kind: "created", fromCodes: [], toCodes: ["C1"] }),
			dates,
		),
		{ date: "2019-03-01", via: "introduced" },
	);
});

test("an ended area is dated by when its code went out of use", () => {
	assert.deepEqual(
		matchLegalDate(
			change({ kind: "ended", fromCodes: ["E1"], toCodes: [] }),
			dates,
		),
		{ date: "2019-03-31", via: "terminated" },
	);
});

test("an area whose code dates are outside the window or unknown keeps its edition", () => {
	assert.deepEqual(
		matchLegalDate(
			change({ kind: "created", fromCodes: [], toCodes: ["O1"] }),
			dates,
		),
		{ date: null, via: "out-of-window" },
	);
	assert.deepEqual(
		matchLegalDate(
			change({ kind: "ended", fromCodes: ["Z9"], toCodes: [] }),
			dates,
		),
		{ date: null, via: "none" },
	);
});

test("renamed and redrawn events are not dated", () => {
	for (const kind of ["renamed", "redrawn"] as const)
		assert.deepEqual(
			matchLegalDate(
				change({ kind, fromCodes: ["W1"], toCodes: ["W2"] }),
				dates,
			),
			{ date: null, via: "not-dated" },
		);
});

test("the end of a month accounts for its length", () => {
	assert.equal(endOfMonth("2020-02-01"), "2020-02-29");
	assert.equal(endOfMonth("2019-12-01"), "2019-12-31");
});
