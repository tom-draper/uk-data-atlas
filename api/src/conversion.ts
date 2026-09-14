import type { CrosswalkArtifact } from "./crosswalkInventory";
import type { PopulationObservation } from "./dataCatalog";

/**
 * How a converted value was arrived at.
 *
 * `exact` means every source area sits wholly inside one target, so the
 * conversion is a regrouping and the total is unchanged. `area-weighted` means
 * a source was split across targets in proportion to overlapping area, which
 * is an estimate: it assumes the measure is spread evenly across the source,
 * and population and most social measures are not.
 */
export type ConversionMethod = "exact" | "area-weighted";

export type ConvertedObservation = {
	areaCode: string;
	value: number;
	status: "derived";
	/** How many source areas contributed to this target. */
	inputAreaCount: number;
};

export type ConversionResult =
	| {
			status: "converted";
			method: ConversionMethod;
			records: ConvertedObservation[];
			inputRecordCount: number;
	  }
	| { status: "refused"; reason: string };

const targetsOf = (artifact: CrosswalkArtifact) =>
	new Map(
		artifact.records.map((record) => [record.source.code, record.targets]),
	);

/**
 * Regroup source-exact observations onto a crosswalk's target areas.
 *
 * Refuses rather than returning a partial answer. A source code the crosswalk
 * does not carry would silently drop its value out of the total, and a split
 * source with no published weight would need an assumption this API has no
 * basis to make.
 */
export const convertObservations = (
	artifact: CrosswalkArtifact,
	records: PopulationObservation[],
): ConversionResult => {
	const crosswalk = targetsOf(artifact);

	const unmatched = records
		.filter((record) => !crosswalk.has(record.areaCode))
		.map((record) => record.areaCode);
	if (unmatched.length > 0) {
		return {
			status: "refused",
			reason: `The crosswalk does not carry ${unmatched.length} of the source partition's area codes, starting with ${unmatched.slice(0, 3).join(", ")}. No partial conversion was applied.`,
		};
	}

	const split = records.filter(
		(record) => (crosswalk.get(record.areaCode)?.length ?? 0) !== 1,
	);
	const unweighted = split.filter((record) =>
		crosswalk
			.get(record.areaCode)
			?.some(
				(target) =>
					typeof (target as { weight?: unknown }).weight !== "number",
			),
	);
	if (unweighted.length > 0) {
		return {
			status: "refused",
			reason: `${unweighted.length} source areas are split across several targets with no published weight. Apportioning them would require an assumption the crosswalk does not support.`,
		};
	}
	const method: ConversionMethod =
		split.length === 0 ? "exact" : "area-weighted";

	const totals = new Map<string, { value: number; inputAreaCount: number }>();
	for (const record of records) {
		const targets = crosswalk.get(record.areaCode) ?? [];
		for (const target of targets) {
			const weight =
				method === "exact"
					? 1
					: ((target as { weight?: number }).weight ?? 0);
			const running = totals.get(target.code) ?? {
				value: 0,
				inputAreaCount: 0,
			};
			running.value += record.value * weight;
			running.inputAreaCount += 1;
			totals.set(target.code, running);
		}
	}

	return {
		status: "converted",
		method,
		inputRecordCount: records.length,
		records: [...totals.entries()]
			.map(([areaCode, { value, inputAreaCount }]) => ({
				areaCode,
				value,
				status: "derived" as const,
				inputAreaCount,
			}))
			.sort((left, right) => left.areaCode.localeCompare(right.areaCode)),
	};
};
