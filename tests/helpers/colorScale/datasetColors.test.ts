import {
	getColorForBrexitLeave,
	getColorForGenderRatio,
} from "@/lib/helpers/colorScale/datasetColors";

const brexitOpts = { colorRange: { min: 0, max: 100 } };
const genderOpts = { colorRange: { min: -1, max: 1 } };

const parseRgb = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];

describe("getColorForBrexitLeave", () => {
	it("at 0% returns the remain colour (30, 60, 180)", () => {
		// normalizeValue(0, 0, 50) = 0 → pure remain
		expect(getColorForBrexitLeave(0, brexitOpts)).toBe("rgb(30, 60, 180)");
	});

	it("at 100% returns the leave colour (180, 20, 20)", () => {
		// normalizeValue(100, 50, 100) = 1 → pure leave
		expect(getColorForBrexitLeave(100, brexitOpts)).toBe("rgb(180, 20, 20)");
	});

	it("at 50% returns the neutral colour (240, 240, 240)", () => {
		expect(getColorForBrexitLeave(50, brexitOpts)).toBe("rgb(240, 240, 240)");
	});

	it("at 25% is halfway between remain and neutral", () => {
		const [r, g, b] = parseRgb(getColorForBrexitLeave(25, brexitOpts));
		expect(r).toBeCloseTo((30 + 240) / 2, 0);
		expect(g).toBeCloseTo((60 + 240) / 2, 0);
		expect(b).toBeCloseTo((180 + 240) / 2, 0);
	});

	it("at 75% is halfway between neutral and leave", () => {
		const [r, g, b] = parseRgb(getColorForBrexitLeave(75, brexitOpts));
		expect(r).toBeCloseTo((240 + 180) / 2, 0);
		expect(g).toBeCloseTo((240 + 20) / 2, 0);
		expect(b).toBeCloseTo((240 + 20) / 2, 0);
	});

	it("returns an rgb() string", () => {
		expect(getColorForBrexitLeave(50, brexitOpts)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
	});
});

describe("getColorForGenderRatio", () => {
	it("at ratio -1 (all female) returns the female colour (255, 105, 180)", () => {
		expect(getColorForGenderRatio(-1, genderOpts)).toBe("rgba(255, 105, 180, 0.8)");
	});

	it("at ratio 0 returns neutral (240, 240, 240)", () => {
		expect(getColorForGenderRatio(0, genderOpts)).toBe("rgba(240, 240, 240, 0.8)");
	});

	it("at ratio 1 (all male) returns the male colour (70, 130, 180)", () => {
		expect(getColorForGenderRatio(1, genderOpts)).toBe("rgba(70, 130, 180, 0.8)");
	});

	it("at ratio -0.5 is halfway between female and neutral", () => {
		// lerp at t=0.5: r=Math.round(247.5)=248, g=Math.round(172.5)=173, b=210
		expect(getColorForGenderRatio(-0.5, genderOpts)).toBe("rgba(248, 173, 210, 0.8)");
	});

	it("returns an rgba() string with alpha 0.8", () => {
		expect(getColorForGenderRatio(0.5, genderOpts)).toMatch(/^rgba\(\d+, \d+, \d+, 0\.8\)$/);
	});
});
