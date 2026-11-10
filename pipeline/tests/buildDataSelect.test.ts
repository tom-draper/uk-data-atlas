import assert from "node:assert/strict";
import { test } from "vitest";
import { selectStages } from "../build-data-select.mjs";

const stage = (name: string, dependencies: string[] = [], check = false) => ({
	name,
	dependencies,
	args: [],
	...(check ? { check } : {}),
});
const stages = [
	stage("a"),
	stage("b", ["a"]),
	stage("check-b", ["b"], true),
	stage("c", ["a"]),
];
const names = (selected: { name: string }[]) =>
	selected.map(({ name }) => name);

test("a local build leaves the check stages out and says which", () => {
	const { selected, skippedChecks, checks } = selectStages({
		stages,
		env: {},
	});
	assert.deepEqual(names(selected), ["a", "b", "c"]);
	assert.deepEqual(skippedChecks, ["check-b"]);
	assert.equal(checks.run, false);
});

test("--verify, DATA_BUILD_VERIFY and CI keep the check stages", () => {
	for (const options of [
		{ verifyChecks: true, env: {} },
		{ env: { DATA_BUILD_VERIFY: "1" } },
		{ env: { CI: "true" } },
	]) {
		const { selected, skippedChecks } = selectStages({
			stages,
			...options,
		});
		assert.deepEqual(names(selected), ["a", "b", "check-b", "c"]);
		assert.deepEqual(skippedChecks, []);
	}
});

test("--checks selects the check stages alone", () => {
	const { selected, checks } = selectStages({
		stages,
		checksOnly: true,
		env: {},
	});
	assert.deepEqual(names(selected), ["check-b"]);
	assert.deepEqual(checks, { run: true, reason: "--checks" });
});

test("a check named with --only runs whatever the mode", () => {
	const { selected, skippedChecks } = selectStages({
		stages,
		only: "check-b",
		env: {},
	});
	assert.deepEqual(names(selected), ["a", "b", "check-b"]);
	assert.deepEqual(skippedChecks, []);
});

test("--from keeps the stage and those after it", () => {
	const { selected } = selectStages({ stages, from: "b", env: {} });
	assert.deepEqual(names(selected), ["b"]);
});
