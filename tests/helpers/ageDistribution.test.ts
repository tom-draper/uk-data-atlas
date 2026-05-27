import { calculateAgeGroups } from "@/lib/helpers/ageDistribution";

describe("calculateAgeGroups", () => {
	it("bins ages correctly into groups", () => {
		const result = calculateAgeGroups({
			"10": 100, // 0-17
			"20": 200, // 18-29
			"35": 300, // 30-44
			"50": 400, // 45-64
			"70": 500, // 65+
		});
		expect(result["0-17"]).toBe(100);
		expect(result["18-29"]).toBe(200);
		expect(result["30-44"]).toBe(300);
		expect(result["45-64"]).toBe(400);
		expect(result["65+"]).toBe(500);
	});
	it("returns zero for all groups when given empty data", () => {
		const result = calculateAgeGroups({});
		expect(Object.values(result).every((v) => v === 0)).toBe(true);
	});
	it("accumulates multiple ages into the same group", () => {
		const result = calculateAgeGroups({ "0": 50, "10": 50, "17": 50 });
		expect(result["0-17"]).toBe(150);
	});
	it("places boundary ages in the correct group", () => {
		const result = calculateAgeGroups({
			"17": 1,
			"18": 1,
			"29": 1,
			"30": 1,
			"64": 1,
			"65": 1,
		});
		expect(result["0-17"]).toBe(1);
		expect(result["18-29"]).toBe(2); // 18 and 29
		expect(result["30-44"]).toBe(1);
		expect(result["45-64"]).toBe(1);
		expect(result["65+"]).toBe(1);
	});
});
