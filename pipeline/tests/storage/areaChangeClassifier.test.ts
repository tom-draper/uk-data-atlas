import assert from "node:assert/strict";
import { test } from "vitest";
import {
	classifyChanges,
	type ChangeArea,
	type ChangeLink,
} from "../../src/storage/areaChangeClassifier";

const area = (versionId: number, code: string, name = code): ChangeArea => ({
	versionId,
	areaId: versionId,
	code,
	name,
});
const link = (fromVersionId: number, toVersionId: number): ChangeLink => ({
	fromVersionId,
	toVersionId,
	weight: null,
});

/** Earlier areas have ids 1 to 99, later ones 101 and up. */
const kinds = (from: ChangeArea[], to: ChangeArea[], links: ChangeLink[]) =>
	classifyChanges(from, to, links).map((change) => change.kind);

test("one to one is unchanged, renamed or recoded", () => {
	assert.deepEqual(
		kinds(
			[
				area(1, "A", "Alpha"),
				area(2, "B", "Beta"),
				area(3, "C", "Gamma"),
			],
			[
				area(101, "A", "Alpha"),
				area(102, "B", "Beta 2"),
				area(103, "D", "Gamma"),
			],
			[link(1, 101), link(2, 102), link(3, 103)],
		),
		["unchanged", "renamed", "recoded"],
	);
});

test("one earlier area to several later ones is a split", () => {
	const [change] = classifyChanges(
		[area(1, "A")],
		[area(102, "B"), area(101, "A")],
		[link(1, 101), link(1, 102)],
	);
	assert.equal(change!.kind, "split");
	assert.deepEqual(
		change!.to.map((to) => to.code),
		["A", "B"],
	);
});

test("several earlier areas into one later one is a merge", () => {
	const [change] = classifyChanges(
		[area(2, "B"), area(1, "A")],
		[area(101, "C")],
		[link(1, 101), link(2, 101)],
	);
	assert.equal(change!.kind, "merged");
	assert.deepEqual(
		change!.from.map((from) => from.code),
		["A", "B"],
	);
});

test("a component that is both split and merged is redistributed, not two events", () => {
	// A splits into X and Y, and B merges into Y, so A, B, X and Y are one component.
	const changes = classifyChanges(
		[area(1, "A"), area(2, "B")],
		[area(101, "X"), area(102, "Y")],
		[link(1, 101), link(1, 102), link(2, 102)],
	);
	assert.equal(changes.length, 1);
	assert.equal(changes[0]!.kind, "redistributed");
	assert.equal(changes[0]!.links.length, 3);
});

test("an area with no link ended or was created", () => {
	assert.deepEqual(
		classifyChanges(
			[area(1, "A"), area(2, "B")],
			[area(101, "A"), area(102, "N")],
			[link(1, 101)],
		).map(({ kind, from, to }) => [
			kind,
			from.map((a) => a.code),
			to.map((a) => a.code),
		]),
		// A created area has no earlier code, so it sorts first.
		[
			["created", [], ["N"]],
			["unchanged", ["A"], ["A"]],
			["ended", ["B"], []],
		],
	);
});

test("changes come out in code order, not input order", () => {
	assert.deepEqual(
		classifyChanges(
			[area(3, "C"), area(1, "A"), area(2, "B")],
			[area(103, "Z"), area(101, "X"), area(102, "Y")],
			[link(3, 103), link(1, 101), link(2, 102)],
		).map((change) => change.from[0]!.code),
		["A", "B", "C"],
	);
});

test("a link to an area outside the two releases is refused", () => {
	assert.throws(
		() => classifyChanges([area(1, "A")], [area(101, "A")], [link(1, 999)]),
		/not in the two releases/,
	);
});
