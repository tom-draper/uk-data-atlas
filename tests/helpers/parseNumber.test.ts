import { parseNum, parseNumInt, parsePct, parseNullableInt } from "@/lib/helpers/parseNumber";

describe("parseNum", () => {
	it("parses integers", () => {
		expect(parseNum("42")).toBe(42);
	});
	it("parses floats", () => {
		expect(parseNum("3.14")).toBeCloseTo(3.14);
	});
	it("strips commas", () => {
		expect(parseNum("1,000,000")).toBe(1_000_000);
	});
	it("trims whitespace", () => {
		expect(parseNum("  99  ")).toBe(99);
	});
	it("returns 0 for empty string", () => {
		expect(parseNum("")).toBe(0);
	});
	it("returns 0 for whitespace-only string", () => {
		expect(parseNum("   ")).toBe(0);
	});
	it("returns 0 for non-numeric string", () => {
		expect(parseNum("abc")).toBe(0);
	});
	it("returns 0 for null/undefined", () => {
		expect(parseNum(null as any)).toBe(0);
		expect(parseNum(undefined as any)).toBe(0);
	});
});

describe("parseNumInt", () => {
	it("truncates floats to integers", () => {
		expect(parseNumInt("3.99")).toBe(3);
	});
	it("strips commas", () => {
		expect(parseNumInt("10,000")).toBe(10_000);
	});
	it("returns 0 for empty/invalid", () => {
		expect(parseNumInt("")).toBe(0);
		expect(parseNumInt("xyz")).toBe(0);
	});
});

describe("parsePct", () => {
	it("strips percent sign", () => {
		expect(parsePct("45%")).toBe(45);
		expect(parsePct("100%")).toBe(100);
	});
	it("parses without percent sign", () => {
		expect(parsePct("52.3")).toBeCloseTo(52.3);
	});
	it("returns 0 for empty/invalid", () => {
		expect(parsePct("")).toBe(0);
		expect(parsePct("%")).toBe(0);
	});
});

describe("parseNullableInt", () => {
	it("parses valid integers", () => {
		expect(parseNullableInt("500")).toBe(500);
		expect(parseNullableInt("1,234")).toBe(1234);
	});
	it("returns null for empty string", () => {
		expect(parseNullableInt("")).toBeNull();
	});
	it("returns null for null/undefined", () => {
		expect(parseNullableInt(null)).toBeNull();
		expect(parseNullableInt(undefined)).toBeNull();
	});
	it("returns null for non-numeric", () => {
		expect(parseNullableInt("n/a")).toBeNull();
	});
	it("truncates floats", () => {
		expect(parseNullableInt("9.9")).toBe(9);
	});
});
