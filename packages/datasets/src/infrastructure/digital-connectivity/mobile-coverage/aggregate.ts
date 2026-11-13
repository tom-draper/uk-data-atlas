import type {
	AggregatedMobileCoverageData,
	MobileCoverageLADData,
} from "../../../types/mobileCoverage.ts";

/**
 * Coverage is a share of premises, so authorities are weighted by how many
 * premises they hold rather than averaged flat; otherwise the Isles of Scilly
 * would pull a region's figure as hard as Birmingham. Landmass shares have no
 * premises weight to use, so they stay a plain mean.
 */
export function aggregateMobileCoverage(
	records: MobileCoverageLADData[],
): AggregatedMobileCoverageData | null {
	if (records.length === 0) return null;

	const premisesWeighted = (
		field:
			| "pct4GIndoorAll"
			| "pct4GIndoorAny"
			| "pct5GOutdoorAll"
			| "pct5GOutdoorAny",
	) => {
		let weighted = 0,
			premises = 0;
		for (const record of records) {
			const share = record[field];
			const count = record.premisesCount;
			if (share === null || count === null || count <= 0) continue;
			weighted += share * count;
			premises += count;
		}
		return premises > 0 ? weighted / premises : null;
	};

	const mean = (field: "pct4GGeoAll" | "pct5GGeoAny") => {
		let total = 0,
			count = 0;
		for (const record of records) {
			const share = record[field];
			if (share === null) continue;
			total += share;
			count++;
		}
		return count > 0 ? total / count : null;
	};

	return {
		pct4GIndoorAll: premisesWeighted("pct4GIndoorAll"),
		pct4GIndoorAny: premisesWeighted("pct4GIndoorAny"),
		pct5GOutdoorAll: premisesWeighted("pct5GOutdoorAll"),
		pct5GOutdoorAny: premisesWeighted("pct5GOutdoorAny"),
		pct4GGeoAll: mean("pct4GGeoAll"),
		pct5GGeoAny: mean("pct5GGeoAny"),
	};
}
