import { detectWardCodeForYear } from "@/lib/helpers/mapManager/propertyDetector";
import type { BoundaryGeojson } from "@/lib/types";

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
	it("returns the first key (WD25CD) when no key is present in properties", () => {
		const features = makeFeatures({ SOME_OTHER_KEY: "value" });
		expect(detectWardCodeForYear(features, 2023)).toBe("WD25CD");
	});
	it("returns the first key for an empty features array", () => {
		expect(detectWardCodeForYear([], 2023)).toBe("WD25CD");
	});
	it("picks the correct year-specific key for 2024", () => {
		const features = makeFeatures({
			WD24CD: "E05009999",
			WD23CD: "E05008888",
		});
		expect(detectWardCodeForYear(features, 2024)).toBe("WD24CD");
	});
});
