import { describe, expect, it } from "vitest";
import { decodeAgeArrays, encodeAgeArrays } from "@/lib/data/ageArrays";

const population = (area: Record<string, unknown>, type = "population") => ({
	"2022": {
		id: "population2022",
		type,
		year: 2022,
		data: { E05000001: area },
	},
});

describe("age arrays", () => {
	const objects = population({
		total: { "0": 5, "1": 7, "2": 9 },
		males: { "0": 2, "1": 3, "2": 4 },
		females: { "0": 3, "1": 4, "2": 5 },
		wardName: "Ward",
	});
	const arrays = population({
		total: [5, 7, 9],
		males: [2, 3, 4],
		females: [3, 4, 5],
		wardName: "Ward",
	});

	it("writes each age map of a population dataset as an array", () => {
		expect(encodeAgeArrays(objects)).toEqual(arrays);
	});

	it("reads the arrays back as the objects they came from", () => {
		expect(decodeAgeArrays(arrays)).toEqual(objects);
		expect(Object.keys(decodeAgeArrays(arrays) as object)).toEqual([
			"2022",
		]);
	});

	it("round-trips through JSON", () => {
		const wire = JSON.parse(JSON.stringify(encodeAgeArrays(objects)));
		expect(decodeAgeArrays(wire)).toEqual(objects);
	});

	it("leaves an age map with a gap as an object, so no age is renumbered", () => {
		const gappy = population({ total: { "0": 5, "2": 9 } });

		expect(encodeAgeArrays(gappy)).toEqual(gappy);
	});

	it("leaves a map that does not start at age 0 as an object", () => {
		const shifted = population({ total: { "1": 5, "2": 9 } });

		expect(encodeAgeArrays(shifted)).toEqual(shifted);
	});

	it("is idempotent in both directions", () => {
		expect(encodeAgeArrays(arrays)).toEqual(arrays);
		expect(decodeAgeArrays(objects)).toEqual(objects);
	});

	it("does not touch a dataset of another type, even with a total field", () => {
		const other = population(
			{ total: { "0": 5, "1": 7 } },
			"qualification",
		);

		expect(encodeAgeArrays(other)).toEqual(other);
		expect(decodeAgeArrays(population({ total: [1, 2] }, "crime"))).toEqual(
			population({ total: [1, 2] }, "crime"),
		);
	});

	it("handles both population datasets and ignores non-objects", () => {
		expect(
			encodeAgeArrays(population({ total: { "0": 1 } }, "populationUk")),
		).toEqual(population({ total: [1] }, "populationUk"));
		expect(encodeAgeArrays(null)).toBeNull();
		expect(decodeAgeArrays([1, 2])).toEqual([1, 2]);
	});

	it("does not modify its input", () => {
		const before = structuredClone(objects);
		encodeAgeArrays(objects);

		expect(objects).toEqual(before);
	});
});
