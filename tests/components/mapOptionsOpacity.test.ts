import { describe, expect, it } from "vitest";
import {
	normalizedOpacityInput,
	opacityFromInput,
} from "@/components/map-options/opacity";

describe("map option opacity input", () => {
	it("converts valid percentages to a clamped opacity", () => {
		expect(opacityFromInput("25")).toBe(0.25);
		expect(opacityFromInput("-10")).toBe(0);
		expect(opacityFromInput("150")).toBe(1);
	});

	it("leaves incomplete input uncommitted and normalizes it on blur", () => {
		expect(opacityFromInput("")).toBeNull();
		expect(normalizedOpacityInput("")).toBe("60");
		expect(normalizedOpacityInput("150")).toBe("100");
	});
});
