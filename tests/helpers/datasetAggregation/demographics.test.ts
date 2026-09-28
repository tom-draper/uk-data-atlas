import { describe, expect, it } from "vitest";
import {
	aggregateEthnicity,
	aggregateLifeExpectancy,
	aggregateQualifications,
} from "@/lib/helpers/datasetAggregation/demographics";
import { CODE_KEY, features } from "./fixtures";

describe("aggregateEthnicity", () => {
	const data = {
		E1: {
			White: { English: { population: 100, code: "W1" } },
			Asian: { Indian: { population: 20, code: "A1" } },
		},
		E2: {
			White: {
				English: { population: 50, code: "W1" },
				Irish: { population: 10, code: "W2" },
			},
		},
	} as any;

	it("sums each subcategory across the covered local authorities", () => {
		const result = aggregateEthnicity(
			features(["E1", "E2"]),
			CODE_KEY,
			data,
		);

		expect(result).toEqual({
			White: {
				English: { ethnicity: "English", population: 150, code: "W1" },
				Irish: { ethnicity: "Irish", population: 10, code: "W2" },
			},
			Asian: {
				Indian: { ethnicity: "Indian", population: 20, code: "A1" },
			},
		});
	});

	it("ignores local authorities with no record", () => {
		const result = aggregateEthnicity(
			features(["E2", "missing"]),
			CODE_KEY,
			data,
		);

		expect(result.White.English.population).toBe(50);
		expect(result.Asian).toBeUndefined();
	});

	it("returns an empty breakdown when nothing is covered", () => {
		expect(
			aggregateEthnicity(features(["missing"]), CODE_KEY, data),
		).toEqual({});
	});
});

describe("aggregateLifeExpectancy", () => {
	const data = {
		E1: { maleBirthLE: 78, femaleBirthLE: 82 },
		E2: { maleBirthLE: 80, femaleBirthLE: 86 },
	} as any;

	it("averages male and female life expectancy over the covered areas", () => {
		expect(
			aggregateLifeExpectancy(features(["E1", "E2"]), CODE_KEY, data),
		).toEqual({ averageMaleLE: 79, averageFemaleLE: 84 });
	});

	it("reports zeros when no covered area has a record", () => {
		expect(
			aggregateLifeExpectancy(features(["missing"]), CODE_KEY, data),
		).toEqual({ averageMaleLE: 0, averageFemaleLE: 0 });
	});
});

describe("aggregateQualifications", () => {
	const breakdown = (level4Plus: number, total: number) => ({
		breakdown: {
			noQualifications: 1,
			level1: 2,
			level2: 3,
			apprenticeship: 4,
			level3: 5,
			level4Plus,
			other: 6,
			total,
		},
	});
	const data = { E1: breakdown(100, 200), E2: breakdown(300, 400) } as any;

	it("sums the breakdown across the covered areas", () => {
		const result = aggregateQualifications(
			features(["E1", "E2"]),
			CODE_KEY,
			data,
		);

		expect(result.breakdown).toEqual({
			noQualifications: 2,
			level1: 4,
			level2: 6,
			apprenticeship: 8,
			level3: 10,
			level4Plus: 400,
			other: 12,
			total: 600,
		});
	});

	it("counts an area once even when several features share its code", () => {
		const result = aggregateQualifications(
			features(["E1", "E1", "E1"]),
			CODE_KEY,
			data,
		);

		expect(result.breakdown.level4Plus).toBe(100);
		expect(result.breakdown.total).toBe(200);
	});

	it("returns a zeroed breakdown when nothing is covered", () => {
		const result = aggregateQualifications(
			features(["missing"]),
			CODE_KEY,
			data,
		);
		expect(result.breakdown.total).toBe(0);
	});
});
