import { describe, expect, it } from "vitest";
import type { SelectedArea } from "@lib/types";
import { resolveDeprivation } from "@/components/deprivation/deprivationStats";

const summary = (mostDeprivedCount: number, areaCount = 10) => ({
	areaCount,
	mostDeprivedCount,
});
const ladStats = { E06000001: summary(3), E06000002: summary(7) };
const records = { E01000001: { rank: 9 } };

const resolve = (selectedArea: SelectedArea | null) =>
	resolveDeprivation({
		aggregated: summary(5),
		ladStats,
		selectedArea,
		fineArea: { type: "lsoa", records },
	});

const area = (
	type: SelectedArea["type"],
	code: string,
	data: unknown = null,
): SelectedArea => ({ type, code, name: code, data }) as SelectedArea;

describe("resolveDeprivation", () => {
	it("summarises the whole selection when no area is picked", () => {
		expect(resolve(null)).toEqual({ kind: "summary", summary: summary(5) });
	});

	it("summarises a selected local authority rather than averaging it", () => {
		expect(resolve(area("localAuthority", "E06000002"))).toEqual({
			kind: "summary",
			summary: summary(7),
		});
	});

	it("rolls a selected ward up to its local authority's summary", () => {
		expect(
			resolve(area("ward", "E05000001", { ladCode: "E06000001" })),
		).toEqual({ kind: "summary", summary: summary(3) });
	});

	it("shows a single small area as its published record", () => {
		expect(resolve(area("lsoa", "E01000001"))).toEqual({
			kind: "area",
			record: { rank: 9 },
		});
	});

	it("reports nothing for an area the index does not cover", () => {
		expect(resolve(area("localAuthority", "S12000033"))).toBeNull();
		expect(resolve(area("lsoa", "W01000001"))).toBeNull();
	});
});
