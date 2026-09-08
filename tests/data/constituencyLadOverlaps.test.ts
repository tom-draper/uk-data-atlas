import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	constituencyReleaseIdForYear,
	type ConstituencyLadOverlaps,
} from "@/lib/data/boundaries/constituencyLadOverlaps";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { gazetteer } from "@/lib/data/gazetteer/static";

const overlaps = JSON.parse(
	readFileSync(
		join(process.cwd(), "data/precompiled/constituency-lad-overlaps.json"),
		"utf8",
	),
) as ConstituencyLadOverlaps;

describe("constituency-to-LAD overlaps", () => {
	it("records the local-authority release its target codes come from", () => {
		expect(overlaps.targetLocalAuthorityRelease).toBe("2025-05-uk-bgc-v2");
	});

	it("covers every served constituency release", () => {
		const releaseIds = new Set(
			Object.keys(BOUNDARY_CATALOG.constituency.vintages).map((year) =>
				constituencyReleaseIdForYear(Number(year)),
			),
		);
		expect(Object.keys(overlaps.releases).sort()).toEqual(
			[...releaseIds].filter(Boolean).sort(),
		);
	});

	it("selects Greater Manchester's 2024 constituencies by LAD membership", () => {
		const greaterManchester =
			gazetteer.namedLocation("Greater Manchester")!;
		const memberCodes = new Set(greaterManchester.memberCodes);
		const crosswalk = overlaps.releases["2024-07-uk-bgc"]!;
		const matching = Object.entries(crosswalk).filter(([, targets]) =>
			targets.some(({ code }) => memberCodes.has(code)),
		);

		expect(matching).toHaveLength(27);
	});
});
