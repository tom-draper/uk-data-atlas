import { describe, expect, it } from "vitest";
import type { SelectedArea } from "@lib/types";
import { resolveDeprivationStats } from "@/components/deprivation/deprivationStats";

const ladStats = { E06000001: { decile: 3 }, E06000002: { decile: 7 } };
const records = { E01000001: { rawDecile: 9 } };

const resolve = (selectedArea: SelectedArea | null) =>
	resolveDeprivationStats({
		aggregated: { decile: 5 },
		ladStats,
		selectedArea,
		fineArea: {
			type: "lsoa",
			records,
			statsFor: (record) => ({ decile: record.rawDecile }),
		},
	});

const area = (
	type: SelectedArea["type"],
	code: string,
	data: unknown = null,
): SelectedArea => ({ type, code, name: code, data }) as SelectedArea;

describe("resolveDeprivationStats", () => {
	it("uses the whole selection's aggregate when no area is picked", () => {
		expect(resolve(null)).toEqual({ decile: 5 });
	});

	it("reads the rollup for a selected local authority", () => {
		expect(resolve(area("localAuthority", "E06000002"))).toEqual({
			decile: 7,
		});
	});

	it("rolls a selected ward up to its local authority", () => {
		expect(
			resolve(area("ward", "E05000001", { ladCode: "E06000001" })),
		).toEqual({ decile: 3 });
	});

	it("reads the index's own finest geography straight from its records", () => {
		expect(resolve(area("lsoa", "E01000001"))).toEqual({ decile: 9 });
	});

	it("reports nothing for an area the index does not cover", () => {
		expect(resolve(area("localAuthority", "S12000033"))).toBeNull();
		expect(resolve(area("lsoa", "W01000001"))).toBeNull();
	});

	it("reports nothing for a ward with no local authority attached", () => {
		expect(resolve(area("ward", "E05000001"))).toBeNull();
	});

	it("reports nothing for a geography the index does not publish", () => {
		// This index is LSOA-based, so a Scottish data zone means nothing to it.
		expect(resolve(area("dataZone", "S01006506"))).toBeNull();
		expect(resolve(area("constituency", "E14000530"))).toBeNull();
	});
});
