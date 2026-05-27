import {
	normalizeValue,
	hexToRgb,
} from "@/lib/helpers/colorScale/interpolation";

describe("normalizeValue", () => {
	it("returns 0 at min", () => {
		expect(normalizeValue(0, 0, 100)).toBe(0);
	});
	it("returns 1 at max", () => {
		expect(normalizeValue(100, 0, 100)).toBe(1);
	});
	it("returns 0.5 at midpoint", () => {
		expect(normalizeValue(50, 0, 100)).toBe(0.5);
	});
	it("clamps values below min to 0", () => {
		expect(normalizeValue(-10, 0, 100)).toBe(0);
	});
	it("clamps values above max to 1", () => {
		expect(normalizeValue(150, 0, 100)).toBe(1);
	});
	it("returns 0.5 when min === max to avoid divide-by-zero", () => {
		expect(normalizeValue(50, 50, 50)).toBe(0.5);
	});
	it("works with non-zero min", () => {
		expect(normalizeValue(150, 100, 200)).toBe(0.5);
	});
});

describe("hexToRgb", () => {
	it("parses red", () => {
		expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
	});
	it("parses white", () => {
		expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
	});
	it("parses black", () => {
		expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
	});
	it("works without leading hash", () => {
		expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
	});
	it("is case-insensitive", () => {
		expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
	});
	it("returns black for invalid input", () => {
		expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 });
	});
});
