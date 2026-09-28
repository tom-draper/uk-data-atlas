import { describe, expect, it } from "vitest";
import { detectHeaderRow, parseCustomCsv } from "@/lib/data/custom/csv";

describe("custom CSV import helpers", () => {
	it("trims values while preserving quoted fields", () => {
		expect(parseCustomCsv(' name , value\n"Leeds, West", 42 \n')).toEqual([
			["name", "value"],
			["Leeds, West", "42"],
		]);
	});

	it("skips leading notes when detecting a header", () => {
		const rows = [
			["Source: example"],
			["Updated: 2026"],
			["Local authority", "Rate", "Count"],
			["Leeds", "12.4", "310"],
		];

		expect(detectHeaderRow(rows)).toBe(2);
	});
});
