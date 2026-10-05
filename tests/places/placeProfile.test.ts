import { describe, expect, it } from "vitest";
import {
	findOperationById,
	loadApiContract,
	operationHref,
} from "@/lib/docs/openapi";
import { PLACE_OPERATIONS } from "@/lib/places/api";
import { dateLabel, listNames, namedKindName } from "@/lib/places/labels";
import {
	decodeOutline,
	encodeOutline,
	isAreaCode,
	placeShard,
	releaseCovers,
	releaseLabel,
} from "@/lib/places/profile";

describe("place outlines", () => {
	it("decode to what was encoded, to about 10 m", () => {
		const polygons = [
			[
				[
					[-3.06351, 53.35971],
					[-2.99911, 53.35017],
					[-3.01727, 53.34603],
					[-3.06351, 53.35971],
				],
			],
		];
		const decoded = decodeOutline(encodeOutline(polygons));
		expect(decoded).toHaveLength(1);
		decoded[0]![0]!.forEach(([x, y], index) => {
			const [ex, ey] = polygons[0]![0]![index]!;
			expect(Math.abs(x! - ex!)).toBeLessThanOrEqual(5e-5);
			expect(Math.abs(y! - ey!)).toBeLessThanOrEqual(5e-5);
		});
	});

	it("close every ring", () => {
		const [ring] = decodeOutline([[[0, 0, 10, 0, 0, 10]]])[0]!;
		expect(ring![0]).toEqual(ring!.at(-1));
	});
});

describe("place ids", () => {
	it("tell codes from named place slugs", () => {
		expect(isAreaCode("E05000954")).toBe(true);
		expect(isAreaCode("16UD")).toBe(true);
		expect(isAreaCode("greater-manchester")).toBe(false);
		expect(isAreaCode("e05000954")).toBe(false);
	});

	it("shard modern codes by all but their last two digits", () => {
		expect(placeShard("E05000954")).toBe("E050009");
		expect(placeShard("16UD")).toBe("16");
	});
});

describe("releases", () => {
	it("read their date and extent from their id", () => {
		expect(releaseLabel("2025-05-uk-bgc-v2")).toBe("May 2025");
		expect(dateLabel("2023-04-01")).toBe("April 2023");
		expect(releaseCovers("2011-12-ew-bgc", "E05000954")).toBe(true);
		expect(releaseCovers("2011-12-ew-bgc", "S13002516")).toBe(false);
		expect(releaseCovers("2019-12-gb-bgc", "N08000101")).toBe(false);
	});
});

describe("place labels", () => {
	it("read naturally", () => {
		expect(listNames(["A", "B", "C"])).toBe("A, B and C");
		expect(namedKindName("ceremonial-county", true)).toBe(
			"Ceremonial counties",
		);
	});
});

describe("place pages' API requests", () => {
	it("link to each operation's docs page", () => {
		const contract = loadApiContract();
		for (const [id, href] of Object.entries(PLACE_OPERATIONS))
			expect(operationHref(findOperationById(contract, id)), id).toBe(
				href,
			);
	});
});
