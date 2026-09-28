import { describe, expect, it } from "vitest";
import {
	mergeManifestEntries,
	parseOnlyArgument,
	selectDefinitions,
} from "../../scripts/precompile-selection";

const definitions = [
	{ type: "claimantCount", precompiledFile: "claimant-count" },
	{ type: "population", precompiledFile: "population" },
	{ type: "housePrice", precompiledFile: "house-price" },
];

describe("parseOnlyArgument", () => {
	it("compiles everything when the flag is absent", () => {
		expect(parseOnlyArgument([])).toBeNull();
	});

	it("reads names after the flag, split on commas", () => {
		expect(
			parseOnlyArgument([
				"--only",
				"claimantCount,population",
				"housePrice",
			]),
		).toEqual(["claimantCount", "population", "housePrice"]);
		expect(parseOnlyArgument(["--only=house-price"])).toEqual([
			"house-price",
		]);
	});

	it("refuses the flag with nothing after it", () => {
		expect(() => parseOnlyArgument(["--only"])).toThrow(/at least one/);
	});
});

describe("selectDefinitions", () => {
	it("matches a type or an output file, in catalogue order", () => {
		expect(
			selectDefinitions(definitions, [
				"house-price",
				"claimantCount",
			]).map((definition) => definition.type),
		).toEqual(["claimantCount", "housePrice"]);
	});

	it("names the choices when a dataset is unknown", () => {
		expect(() => selectDefinitions(definitions, ["claimentCount"])).toThrow(
			"Unknown dataset claimentCount. Choose from: claimantCount, housePrice, population",
		);
	});
});

describe("mergeManifestEntries", () => {
	it("replaces recompiled entries and keeps the others in catalogue order", () => {
		const existing = [
			{ type: "claimantCount", version: 1 },
			{ type: "population", version: 1 },
			{ type: "retired", version: 1 },
		];
		expect(
			mergeManifestEntries(
				existing,
				[
					{ type: "housePrice", version: 2 },
					{ type: "claimantCount", version: 2 },
				],
				["claimantCount", "population", "housePrice"],
			),
		).toEqual([
			{ type: "claimantCount", version: 2 },
			{ type: "population", version: 1 },
			{ type: "housePrice", version: 2 },
		]);
	});
});
