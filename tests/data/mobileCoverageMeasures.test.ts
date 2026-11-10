import { expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { getChartDatasetDefinition } from "@/lib/datasets";
import { declaredDisplay } from "@/lib/datasets/declared";
import type { MobileCoverageDataset } from "@uk-data-atlas/datasets";
const dataset: MobileCoverageDataset = {
	id: "mobile2025",
	type: "mobile-coverage",
	year: 2025,
	boundaryYear: 2024,
	boundaryType: "localAuthority",
	data: {
		A: {
			ladCode: "A",
			ladName: "A",
			pct4GIndoorAll: 80,
			pct4GIndoorAny: 95,
			pct5GOutdoorAll: 20,
			pct5GOutdoorAny: 60,
			pct4GGeoAll: 40,
			pct5GGeoAny: null,
			premisesCount: 100,
		},
	},
};
const definition = getChartDatasetDefinition("mobile-coverage")!;
const MOBILE_COVERAGE_MEASURES = declaredDisplay(
	"mobile-coverage",
)!.measures.map(({ id, label }) => ({
	value: id as keyof MobileCoverageDataset["data"][string],
	label,
}));

it("maps each published coverage measure and preserves unavailable values", () => {
	for (const { value: measure, label } of MOBILE_COVERAGE_MEASURES) {
		const options = {
			...DEFAULT_MAP_OPTIONS,
			"mobile-coverage": {
				...DEFAULT_MAP_OPTIONS["mobile-coverage"],
				measure,
			},
		};
		expect(definition.map!.valueFor!(dataset, "A", options)).toBe(
			dataset.data.A[measure],
		);
		expect(
			definition.map!.valueFor!(dataset, "missing", options),
		).toBeNull();
		expect(definition.map!.legend.format(50, options)).toContain(label);
		expect(definition.map!.sourceMode!(dataset, options)).toContain(
			measure,
		);
	}
});
