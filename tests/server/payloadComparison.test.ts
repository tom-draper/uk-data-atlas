import { describe, expect, it } from "vitest";
import {
	payloadDifference,
	payloadValuesEqual,
} from "../../pipeline/src/checks/payloadComparison.ts";

describe("payload comparison", () => {
	it("treats numbers that differ only by summing order as equal", () => {
		expect(
			payloadValuesEqual(
				{ a: [0.1 + 0.2, 1] },
				{ a: [0.30000000000000004 + 1e-12, 1] },
			),
		).toBe(true);
	});

	it("keeps nulls, absent keys and other values distinct", () => {
		expect(payloadValuesEqual({ a: null }, { a: 0 })).toBe(false);
		expect(payloadDifference({ a: { b: null } }, { a: {} })).toBe(
			"a.b: got null want undefined",
		);
		expect(payloadValuesEqual({ a: 1 }, { a: 1.001 })).toBe(false);
		expect(payloadValuesEqual([1], { 0: 1 })).toBe(false);
	});
});
