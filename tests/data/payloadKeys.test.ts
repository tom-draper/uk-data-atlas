import { describe, expect, it } from "vitest";
import {
	parsePayloadKeys,
	payloadKeysQuery,
	pickPayloadEntries,
} from "@/lib/data/payloadKeys";

describe("payload keys", () => {
	it("parses, deduplicates and sorts the query", () => {
		expect(parsePayloadKeys("2024,le,2024,hle")).toEqual([
			"2024",
			"hle",
			"le",
		]);
		expect(parsePayloadKeys(null)).toBeNull();
	});
	it("rejects unsafe or too many keys", () => {
		expect(parsePayloadKeys("")).toBeNull();
		expect(parsePayloadKeys("2024,")).toBeNull();
		expect(parsePayloadKeys("a/b")).toBeNull();
		expect(
			parsePayloadKeys(Array.from({ length: 17 }, (_, i) => i).join(",")),
		).toBeNull();
	});
	it("builds a stable query whatever the order", () => {
		expect(payloadKeysQuery(["2024", "2019", "2024"])).toBe("2019,2024");
	});
	it("keeps only the named entries, in payload order", () => {
		expect(
			Object.keys(
				pickPayloadEntries({ 2019: 1, 2020: 2, 2024: 3 }, [
					"2024",
					"2019",
				]),
			),
		).toEqual(["2019", "2024"]);
	});
});
