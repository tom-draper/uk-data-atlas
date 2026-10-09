import { describe, expect, it } from "vitest";
import {
	decodeCompactPayload,
	encodeCompactPayload,
} from "@/lib/data/compactPayload";
import { decodeYearArrays, encodeYearArrays } from "@/lib/data/yearArrays";

const edition = (
	data: Record<string, unknown>,
	extra: Record<string, unknown> = {},
	type = "housePrice",
) => ({ "2023": { id: "housePrice2023", type, year: 2023, ...extra, data } });

const ward = (prices: unknown, meanPrices: unknown) => ({
	wardCode: "E05000001",
	prices,
	meanPrices,
});

describe("year arrays", () => {
	const objects = edition({
		A: ward(
			{ "1995": 10, "1996": 11, "1997": 12 },
			{ "1995": 9, "1996": 10 },
		),
		// Starts later and has a missing year in the middle.
		B: ward({ "1996": 20, "1998": 22 }, {}),
	});
	const arrays = edition(
		{
			A: ward([10, 11, 12], [9, 10]),
			B: ward([null, 20, null, 22], []),
		},
		{ priceYearsFrom: 1995 },
	);

	it("writes each year map as an array from the edition's first year", () => {
		expect(encodeYearArrays(objects)).toEqual(arrays);
	});

	it("restores the objects exactly, including gaps and empty maps", () => {
		expect(decodeYearArrays(arrays)).toEqual(objects);
	});

	it("survives being written to JSON and read back", () => {
		const wire = JSON.parse(JSON.stringify(encodeYearArrays(objects)));
		expect(decodeYearArrays(wire)).toEqual(objects);
	});

	it("is idempotent in both directions", () => {
		expect(encodeYearArrays(arrays)).toEqual(arrays);
		expect(decodeYearArrays(objects)).toEqual(objects);
	});

	it("leaves an edition alone when a map could not be held as an array", () => {
		for (const bad of [
			{ "1995": 10, latest: 12 },
			{ "1995": null },
			{ "1995": "10" },
			{ "1995": 1, "2500": 2 },
		]) {
			const unchanged = edition({ A: ward(bad, {}) });
			expect(encodeYearArrays(unchanged)).toEqual(unchanged);
		}
	});

	it("does not touch other dataset types", () => {
		const other = edition({ A: ward({ "1995": 10 }, {}) }, {}, "crime");
		expect(encodeYearArrays(other)).toEqual(other);
		expect(
			decodeYearArrays(edition({ A: ward([1], []) }, {}, "crime")),
		).toEqual(edition({ A: ward([1], []) }, {}, "crime"));
	});

	it("does not mutate its input", () => {
		const before = JSON.stringify(objects);
		encodeYearArrays(objects);
		expect(JSON.stringify(objects)).toBe(before);
	});

	it("passes anything that is not a dataset map through", () => {
		expect(encodeYearArrays(null)).toBeNull();
		expect(decodeYearArrays([1, 2])).toEqual([1, 2]);
	});
});

describe("compact payload", () => {
	it("round-trips age and year arrays together", () => {
		const payload = {
			...edition({ A: ward({ "1995": 1 }, { "1995": 2 }) }),
			"2022": {
				id: "population2022",
				type: "population",
				data: {
					A: { total: { "0": 1, "1": 2 }, males: {}, females: {} },
				},
			},
		};
		const encoded = encodeCompactPayload(payload);
		expect(encoded).not.toEqual(payload);
		expect(decodeCompactPayload(encoded)).toEqual(payload);
	});
});
