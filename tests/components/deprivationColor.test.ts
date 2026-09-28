import { describe, expect, it } from "vitest";
import { deprivationColor } from "@/components/deprivation/DecileChart";

describe("deprivationColor", () => {
	it("interpolates a continuous low-to-high deprivation scale", () => {
		expect(deprivationColor(0)).toBe("#15803d");
		expect(deprivationColor(0.5)).toBe("#eab308");
		expect(deprivationColor(1)).toBe("#dc2626");
		expect(deprivationColor(0.25)).not.toBe("#15803d");
		expect(deprivationColor(0.25)).not.toBe("#eab308");
	});

	it("clamps values outside the normalized range", () => {
		expect(deprivationColor(-1)).toBe("#15803d");
		expect(deprivationColor(2)).toBe("#dc2626");
	});
});
