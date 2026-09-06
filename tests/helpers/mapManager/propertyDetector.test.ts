import {
	PropertyDetector,
	detectWardCodeForYear,
} from "@/lib/helpers/mapManager/propertyDetector";
import type { BoundaryGeojson } from "@/lib/types";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";

// The key the detector falls back to is whichever ward release is newest, so
// read it from the catalogue rather than naming a year that a later release
// will quietly move.
const NEWEST_WARD_CODE = BOUNDARY_CATALOG.ward.properties.code[0];

const makeFeatures = (
	properties: Record<string, string>,
): BoundaryGeojson["features"] =>
	[
		{
			type: "Feature",
			properties,
			geometry: { type: "Point", coordinates: [] },
		},
	] as any;

describe("detectWardCodeForYear", () => {
	it("prefers the year-specific key when present", () => {
		const features = makeFeatures({
			WD23CD: "E05001234",
			WD25CD: "E05005678",
		});
		expect(detectWardCodeForYear(features, 2023)).toBe("WD23CD");
	});
	it("falls back to any available key when year-specific key is absent", () => {
		const features = makeFeatures({ WD22CD: "E05001234" });
		// Asking for 2025, WD25CD not present → should fall back to WD22CD
		expect(detectWardCodeForYear(features, 2025)).toBe("WD22CD");
	});
	it("returns the newest key when no key is present in properties", () => {
		const features = makeFeatures({ SOME_OTHER_KEY: "value" });
		expect(detectWardCodeForYear(features, 2023)).toBe(NEWEST_WARD_CODE);
	});
	it("returns the newest key for an empty features array", () => {
		expect(detectWardCodeForYear([], 2023)).toBe(NEWEST_WARD_CODE);
	});
	it("picks the correct year-specific key for 2024", () => {
		const features = makeFeatures({
			WD24CD: "E05009999",
			WD23CD: "E05008888",
		});
		expect(detectWardCodeForYear(features, 2024)).toBe("WD24CD");
	});
});

describe("PropertyDetector.detect", () => {
	const detector = new PropertyDetector();

	it("finds the code key for the requested geography", () => {
		const features = makeFeatures({ LAD24CD: "E06000001" });
		expect(detector.detect("localAuthority", features)).toBe("LAD24CD");
	});

	it("ignores code keys belonging to other geographies", () => {
		const features = makeFeatures({ WD24CD: "E05001234" });
		// No local authority key present, so it falls back to the newest one.
		expect(detector.detect("localAuthority", features)).toBe("LAD25CD");
		expect(detector.detect("ward", features)).toBe("WD24CD");
	});

	it('accepts any geography\'s code key when the scope is "any"', () => {
		expect(
			detector.detect("any", makeFeatures({ DataZone: "S01006506" })),
		).toBe("DataZone");
		expect(
			detector.detect("any", makeFeatures({ SOA_CODE: "95AA01S1" })),
		).toBe("SOA_CODE");
	});

	it("prefers the earlier geography when a file carries several code keys", () => {
		// Catalogue order decides: ward is declared before local authority.
		const features = makeFeatures({
			LAD24CD: "E06000001",
			WD24CD: "E05001234",
		});
		expect(detector.detect("any", features)).toBe("WD24CD");
	});

	it("falls back to the newest key for an empty features array", () => {
		expect(detector.detect("ward", [])).toBe(NEWEST_WARD_CODE);
		expect(detector.detect("constituency", [])).toBe("PCON24CD");
	});
});
