import assert from "node:assert/strict";
import { test } from "vitest";
import {
	assertStageOwnership,
	ownershipProblems,
} from "@/pipeline/build-data-ownership.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";

type Stage = {
	name: string;
	writes?: string[];
	outputs?: string[];
	requiredOutputs?: string[];
	cacheable?: boolean;
};

test("stages with separate paths own them", () => {
	const stages: Stage[] = [
		{ name: "a", writes: ["data/build/a.json"] },
		{ name: "b", writes: ["data/build/b"], outputs: ["data/build/b"] },
		{ name: "c", requiredOutputs: ["data/build/c.sqlite"] },
		{ name: "download", cacheable: false },
	];
	assert.deepEqual(ownershipProblems(stages), []);
	assert.equal(assertStageOwnership(stages), stages);
});

test("two stages may not declare the same path, or one inside the other", () => {
	const problems = ownershipProblems([
		{ name: "first", writes: ["data/build/shared.sqlite", "data/build/x"] },
		{ name: "second", writes: ["data/build/shared.sqlite"] },
		{ name: "third", outputs: ["data/build/x/part.json"] },
	]);
	assert.deepEqual(problems, [
		"first and second both write data/build/shared.sqlite. A path has one owning stage.",
		"first and third both write data/build/x and data/build/x/part.json. A path has one owning stage.",
	]);
	assert.throws(
		() =>
			assertStageOwnership([
				{ name: "first", writes: ["data/build/a"] },
				{ name: "second", writes: ["data/build/a"] },
			]),
		/breaks stage ownership[\s\S]*first and second both write data\/build\/a/,
	);
});

test("a stage that declares nothing is refused unless it is the uncached download", () => {
	assert.deepEqual(ownershipProblems([{ name: "quiet" }]), [
		"quiet declares no paths. Every stage must declare the files and folders it writes.",
	]);
	assert.deepEqual(
		ownershipProblems([{ name: "sources", cacheable: false }]),
		[],
	);
});

test("only the known stages still share a path in the build graph", () => {
	// Each step of #712 removes names from this list. It ends empty.
	const sharing = new Set<string>();
	for (const problem of ownershipProblems(buildDataStages as Stage[])) {
		const [names] = problem.split(" both write ");
		for (const name of names.split(" and ")) sharing.add(name);
	}
	assert.deepEqual(
		[...sharing].sort(),
		[
			"area-search-index",
			"atlas-cache-stamp",
			"atlas-release",
			"atlas-release-initial",
			"atlas-sqlite",
			"place-index",
			"postcode-counts",
		].sort(),
	);
});
