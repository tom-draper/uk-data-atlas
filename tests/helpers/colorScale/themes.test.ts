import { getThemeColor, getColor } from "@/lib/helpers/colorScale/themes";

const RGB_RE = /^rgb\(\d+, \d+, \d+\)$/;

describe("getThemeColor", () => {
	it("returns an rgb() string", () => {
		expect(getThemeColor(0.5)).toMatch(RGB_RE);
	});

	it("at 0 returns the first stop of viridis", () => {
		// #440154 → rgb(68, 1, 84)
		expect(getThemeColor(0)).toBe("rgb(68, 1, 84)");
	});

	it("at 1 returns the last stop of viridis", () => {
		// #fde724 → rgb(253, 231, 36)
		expect(getThemeColor(1)).toBe("rgb(253, 231, 36)");
	});

	it("at 0 returns the first stop of redblue", () => {
		// #d73027 → rgb(215, 48, 39)
		expect(getThemeColor(0, "redblue")).toBe("rgb(215, 48, 39)");
	});

	it("at 1 returns the last stop of redblue", () => {
		// #4575b4 → rgb(69, 117, 180)
		expect(getThemeColor(1, "redblue")).toBe("rgb(69, 117, 180)");
	});

	it("interpolates between stops at midpoint", () => {
		// redblue has 2 stops so 0.5 should be exactly halfway
		const [r1, g1, b1] = [215, 48, 39];
		const [r2, g2, b2] = [69, 117, 180];
		const expected = `rgb(${Math.round((r1 + r2) / 2)}, ${Math.round((g1 + g2) / 2)}, ${Math.round((b1 + b2) / 2)})`;
		expect(getThemeColor(0.5, "redblue")).toBe(expected);
	});

	it("falls back to viridis for an unknown theme id", () => {
		expect(getThemeColor(0, "nonexistent")).toBe(getThemeColor(0, "viridis"));
	});

	it("channels stay in valid 0–255 range at all values", () => {
		for (const t of [0, 0.25, 0.5, 0.75, 1]) {
			const color = getThemeColor(t);
			const nums = color.match(/\d+/g)!.map(Number);
			for (const v of nums) {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(255);
			}
		}
	});
});

describe("getColor", () => {
	it("is the inverse of getThemeColor — getColor(0) === getThemeColor(1)", () => {
		expect(getColor(0)).toBe(getThemeColor(1));
	});

	it("getColor(1) === getThemeColor(0)", () => {
		expect(getColor(1)).toBe(getThemeColor(0));
	});
});
