import assert from "node:assert/strict";
import { test } from "vitest";
import {
	AGE_SEX_POPULATION,
	populationClassOf,
	TOTAL_POPULATION,
} from "../../src/conversion/backtestCases.ts";

test("a population series is of the class its members were measured as", () => {
	assert.equal(populationClassOf(""), TOTAL_POPULATION);
	for (const members of [
		"age=0/sex=all",
		"age=45/sex=male",
		"age=89/sex=female",
		"age=90-plus/sex=all",
	])
		assert.equal(populationClassOf(members), AGE_SEX_POPULATION, members);
});

test("a breakdown no backtest measured has no class", () => {
	for (const members of [
		"sex=all",
		"age=0",
		"age=10-14/sex=all",
		"age=0/sex=all/ethnicity=white",
		"age=0/sex=other",
	])
		assert.equal(populationClassOf(members), undefined, members);
});
