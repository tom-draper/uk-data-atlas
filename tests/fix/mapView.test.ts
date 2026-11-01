import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diagnose } from "@/lib/fix/diagnose";
import {
	quantileBreaks,
	STATUS_COLOURS,
	statusColouring,
	VALUE_COLOURS,
	valueColouring,
} from "@/lib/fix/mapView";
import { readTable } from "@/lib/fix/table";
import { sampleInput } from "./sample";

const table = readTable(readFileSync("public/fix/sample-wards.csv", "utf8"));
const diagnosis = diagnose(sampleInput());

describe("statusColouring", () => {
	const colouring = statusColouring(diagnosis);

	it("colours each matched ward by whether the latest release holds it", () => {
		expect(colouring.areas).toHaveLength(26);
		const brinkworth = colouring.areas.find((a) => a.code === "E05013408");
		expect(brinkworth).toEqual({
			code: "E05013408",
			name: "Brinkworth",
			colour: STATUS_COLOURS.retired,
			note: "Retired since Wards, December 2024",
		});
		expect(
			colouring.areas.filter((a) => a.colour === STATUS_COLOURS.retired),
		).toHaveLength(5);
	});

	it("names each colour in the legend and counts rows it cannot draw", () => {
		expect(colouring.legend).toEqual([
			{
				colour: STATUS_COLOURS.current,
				label: "Current in Wards, May 2026",
				tone: "ok",
			},
			{
				colour: STATUS_COLOURS.retired,
				label: "Retired since Wards, December 2024",
				tone: "warn",
			},
		]);
		expect(colouring.notShown).toBe(1);
	});
});

describe("quantileBreaks", () => {
	it("splits values into classes of about equal size", () => {
		expect(quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([
			2, 4, 6, 8,
		]);
	});

	it("drops classes that repeated values leave empty", () => {
		expect(quantileBreaks([5, 5, 5, 5, 9])).toEqual([5]);
		expect(quantileBreaks([5, 5])).toEqual([]);
	});
});

describe("valueColouring", () => {
	it("shades each ward by its households, light to dark", () => {
		const colouring = valueColouring(table, diagnosis, 2);
		expect(colouring.areas).toHaveLength(26);
		expect(colouring.legend.map((entry) => entry.colour)).toEqual(
			VALUE_COLOURS,
		);
		const values = colouring.areas.map((area) => ({
			value: Number(area.note.replace(/,/g, "")),
			step: VALUE_COLOURS.indexOf(area.colour),
		}));
		const sorted = [...values].sort((a, b) => a.value - b.value);
		for (let i = 1; i < sorted.length; i++)
			expect(sorted[i].step).toBeGreaterThanOrEqual(sorted[i - 1].step);
		expect(colouring.legend[0].label).toMatch(/^[\d,]+ to [\d,]+$/);
		expect(colouring.legend[1].label).toMatch(/^Over /);
		expect(colouring.notShown).toBe(1);
		expect(colouring.noValue).toBe(0);
	});

	it("counts rows with no number", () => {
		const blank = {
			...table,
			rows: table.rows.map((row, i) =>
				i === 0 ? [row[0], row[1], ""] : row,
			),
		};
		expect(valueColouring(blank, diagnosis, 2).noValue).toBe(1);
	});
});
