import { describe, expect, it } from "vitest";
import {
	selectedAreaLadCode,
	selectedAreaLadRecord,
} from "@/lib/helpers/selectedAreaLad";
import type { SelectedArea } from "@/lib/types";

const ward = (code: string, ladCode?: string): SelectedArea =>
	({
		type: "ward",
		code,
		name: code,
		data: ladCode ? { ladCode } : null,
	}) as SelectedArea;

describe("selectedAreaLadCode", () => {
	it("returns a local authority's own code", () => {
		expect(
			selectedAreaLadCode(
				{
					type: "localAuthority",
					code: "E08000001",
					name: "Bolton",
					data: null,
				},
				undefined,
			),
		).toBe("E08000001");
	});

	it("prefers the shared ward mapping over the hovered record", () => {
		expect(
			selectedAreaLadCode(ward("E05014827", "STALE"), {
				getLadForWard: () => "E08000001",
			}),
		).toBe("E08000001");
	});

	it("falls back to the hovered record when the mapping has no entry", () => {
		expect(
			selectedAreaLadCode(ward("E05014827", "E08000001"), {
				getLadForWard: () => undefined,
			}),
		).toBe("E08000001");
		expect(selectedAreaLadCode(ward("E05014827"), undefined)).toBe(
			undefined,
		);
	});

	it("does not guess an authority for other geographies", () => {
		expect(
			selectedAreaLadCode(
				{ type: "constituency", code: "C1", name: "C1", data: null },
				{ getLadForWard: () => "E08000001" },
			),
		).toBeUndefined();
	});
});

describe("selectedAreaLadRecord", () => {
	it("resolves a ward to its authority's record", () => {
		expect(
			selectedAreaLadRecord(
				{ E08000001: 36_000 },
				ward("E05014827"),
				{ getLadForWard: () => "E08000001" },
				2023,
			),
		).toBe(36_000);
	});

	it("maps the authority code into the dataset's boundary vintage", () => {
		expect(
			selectedAreaLadRecord(
				{ OLD: 1 },
				ward("E05014827"),
				{
					getLadForWard: () => "NEW",
					getCodeForYear: (_type, code, year) =>
						code === "NEW" && year === 2021 ? "OLD" : undefined,
				},
				2021,
			),
		).toBe(1);
	});
});
