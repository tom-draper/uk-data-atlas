import { describe, expect, it } from "vitest";
import { unitLabel } from "@/lib/docs/dataPages";

describe("unitLabel", () => {
	it("capitalises a unit written as words", () => {
		expect(unitLabel("people")).toBe("People");
		expect(unitLabel("usual residents aged 16 and over")).toBe(
			"Usual residents aged 16 and over",
		);
		expect(unitLabel("score out of 24")).toBe("Score out of 24");
	});

	it("leaves symbols, abbreviations and numbers as written", () => {
		for (const unit of [
			"£",
			"£ per year",
			"% of premises",
			"µg/m³",
			"kt CO2e",
			"GWh",
			"GBP",
			"1x1 km grid cells",
		])
			expect(unitLabel(unit)).toBe(unit);
	});
});
