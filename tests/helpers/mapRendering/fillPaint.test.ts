import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { PARTIES } from "@uk-data-atlas/datasets";
import { ETHNICITY_COLORS } from "@uk-data-atlas/datasets";
import {
	electionWinnerPaint,
	categoryMajorityPaint,
	categoryPercentagePaint,
	featureColorPaint,
	partyPercentagePaint,
	valuePaint,
} from "@/lib/helpers/mapRendering/fillPaint";

describe("electionWinnerPaint", () => {
	it("matches each party to its own colour, with a fallback", () => {
		const paint = electionWinnerPaint([
			{ key: "LAB" },
			{ key: "CON" },
		] as never);

		expect(paint.color).toEqual([
			"match",
			["get", "winningParty"],
			"LAB",
			PARTIES.LAB.color,
			"CON",
			PARTIES.CON.color,
			"#cccccc",
		]);
	});

	it("dims a hovered area rather than painting it flat", () => {
		const paint = electionWinnerPaint([]);
		expect(JSON.stringify(paint.opacity(0.5))).toContain("hover");
	});
});

describe("partyPercentagePaint", () => {
	const options = {
		...DEFAULT_MAP_OPTIONS["local-election"],
		selected: "LAB",
	};

	it("ramps the vote share from a neutral to the party's own colour", () => {
		const labour = partyPercentagePaint(options as never, false);
		const tory = partyPercentagePaint(
			{ ...options, selected: "CON" } as never,
			false,
		);

		expect(JSON.stringify(labour!.color)).toContain("percentage");
		// Each party ramps to its own end colour, so the two differ.
		expect(labour!.color).not.toEqual(tory!.color);
	});

	it("paints a flat overlay, since every area is the same party", () => {
		const paint = partyPercentagePaint(options as never, false);
		expect(paint!.opacity(0.4)).toBe(0.4);
	});

	it("describes no paint at all when no party is selected", () => {
		expect(
			partyPercentagePaint(DEFAULT_MAP_OPTIONS["local-election"], false),
		).toBeNull();
	});
});

describe("ethnicity paints", () => {
	it("matches each category to its colour for the majority view", () => {
		const paint = categoryMajorityPaint(ETHNICITY_COLORS);
		const expression = JSON.stringify(paint.color);

		expect(expression).toContain("majorityCategory");
		for (const color of Object.values(ETHNICITY_COLORS)) {
			expect(expression).toContain(color);
		}
	});

	it("shades from the selected category's colour", () => {
		const selected = Object.keys(ETHNICITY_COLORS)[0];
		const paint = categoryPercentagePaint(
			ETHNICITY_COLORS,
			{ ...DEFAULT_MAP_OPTIONS.ethnicity, selected },
			false,
		);

		expect(paint).not.toBeNull();
		expect(paint!.opacity(0.4)).toBe(0.4);
	});

	it("describes no paint at all when no category is selected", () => {
		expect(
			categoryPercentagePaint(
				ETHNICITY_COLORS,
				DEFAULT_MAP_OPTIONS.ethnicity,
				false,
			),
		).toBeNull();
	});
});

describe("featureColorPaint and valuePaint", () => {
	it("reads a colour the feature already carries", () => {
		expect(featureColorPaint().color).toEqual(["get", "color"]);
	});

	it("passes a prepared ramp through untouched", () => {
		const ramp = ["get", "value"] as never;
		expect(valuePaint(ramp).color).toBe(ramp);
	});

	it("both dim on hover", () => {
		expect(JSON.stringify(featureColorPaint().opacity(1))).toContain(
			"hover",
		);
		expect(
			JSON.stringify(valuePaint(["get", "value"] as never).opacity(1)),
		).toContain("hover");
	});
});
