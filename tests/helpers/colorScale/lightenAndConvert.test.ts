import {
	lightenHex,
	rgbToHex,
	hexToRgb,
} from "@/lib/helpers/colorScale/interpolation";

describe("lightenHex", () => {
	it("factor 0 returns the original colour as rgb()", () => {
		expect(lightenHex("#ff0000", 0)).toBe("rgb(255, 0, 0)");
	});

	it("factor 1 returns white", () => {
		expect(lightenHex("#000000", 1)).toBe("rgb(255, 255, 255)");
		expect(lightenHex("#ff0000", 1)).toBe("rgb(255, 255, 255)");
	});

	it("factor 0.5 mixes evenly toward white", () => {
		// Math.round(0 + 255 * 0.5) = Math.round(127.5) = 128
		expect(lightenHex("#000000", 0.5)).toBe("rgb(128, 128, 128)");
	});

	it("does not change the red channel when lightening a pure red", () => {
		const result = lightenHex("#ff0000", 0.5);
		expect(result).toBe("rgb(255, 128, 128)");
	});

	it("returns a valid rgb() string", () => {
		expect(lightenHex("#3b82f6", 0.45)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
	});
});

describe("rgbToHex", () => {
	it("converts red to #ff0000", () => {
		expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
	});

	it("converts black to #000000", () => {
		expect(rgbToHex(0, 0, 0)).toBe("#000000");
	});

	it("converts white to #ffffff", () => {
		expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
	});

	it("rounds fractional values", () => {
		expect(rgbToHex(254.6, 0, 0)).toBe("#ff0000");
		expect(rgbToHex(254.4, 0, 0)).toBe("#fe0000");
	});

	it("is the inverse of hexToRgb", () => {
		const hex = "#3b82f6";
		const { r, g, b } = hexToRgb(hex);
		expect(rgbToHex(r, g, b)).toBe(hex);
	});
});
