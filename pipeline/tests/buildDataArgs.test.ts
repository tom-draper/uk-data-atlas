import assert from "node:assert/strict";
import { test } from "vitest";
import { parseBuildArgs } from "../build-data-args.mjs";

const stages = [{ name: "a" }, { name: "b" }];
const limits = { jobs: 3 };
const parse = (...argv: string[]) => parseBuildArgs({ argv, stages, limits });

test("no arguments gives the defaults and the limit's job count", () => {
	const options = parse();
	assert.equal(options.jobs, 3);
	assert.equal(options.useCache, true);
	assert.equal(options.plan, false);
	assert.equal(options.adopt, false);
	assert.equal(options.only, undefined);
	assert.equal(options.from, undefined);
});

test("flags and stage names are read", () => {
	const options = parse("--only", "a", "--plan", "--verify", "--no-cache");
	assert.equal(options.only, "a");
	assert.equal(options.plan, true);
	assert.equal(options.verifyChecks, true);
	assert.equal(options.useCache, false);
	assert.equal(parse("--from", "b").from, "b");
	assert.equal(parse("--checks").checksOnly, true);
});

test("--jobs overrides the limit and --verify-outputs forces one job", () => {
	assert.equal(parse("--jobs", "5").jobs, 5);
	const options = parse("--check-writes");
	assert.equal(options.verifyOutputs, true);
	assert.equal(options.jobs, 1);
});

test("invalid arguments and combinations are rejected", () => {
	assert.throws(() => parse("--jobs", "0"), /positive whole number/);
	assert.throws(() => parse("--only"), /--only requires a stage name/);
	assert.throws(() => parse("--from", "--plan"), /--from requires/);
	assert.throws(() => parse("--plan", "--plan"), /Unknown or repeated/);
	assert.throws(() => parse("--only", "z"), /Unknown stage: z/);
	assert.throws(
		() => parse("--only", "a", "--from", "b"),
		/cannot be combined/,
	);
	assert.throws(
		() => parse("--verify-outputs", "--jobs", "2"),
		/one stage at a time/,
	);
	assert.throws(() => parse("--adopt", "--no-cache"), /--adopt cannot/);
	assert.throws(() => parse("--checks", "--only", "a"), /--checks runs/);
	assert.throws(() => parse("--checks", "--verify"), /drop --verify/);
});
