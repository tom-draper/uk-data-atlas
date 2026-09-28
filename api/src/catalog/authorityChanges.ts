import {
	isNumericObservation,
	type MeasureObservationArtifact,
} from "../dataCatalog";

/**
 * The four unitary authorities created in April 2023, with the districts each
 * replaced. A partition compiled onto current boundaries can hold both a
 * successor, summed from its predecessors, and the predecessors themselves;
 * summed over a country, those people would be counted twice.
 */
export const APRIL_2023_LAD_MERGERS: Record<string, string[]> = {
	E06000063: ["E07000026", "E07000028", "E07000029"],
	E06000064: ["E07000027", "E07000030", "E07000031"],
	E06000065: [
		"E07000163",
		"E07000164",
		"E07000165",
		"E07000166",
		"E07000167",
		"E07000168",
		"E07000169",
	],
	E06000066: ["E07000187", "E07000188", "E07000189", "E07000246"],
};

/**
 * The unitary authorities created in April 2020 and April 2021, with the
 * districts each replaced.
 */
export const APRIL_2020_2021_LAD_MERGERS: Record<string, string[]> = {
	E06000060: ["E07000004", "E07000005", "E07000006", "E07000007"],
	E06000061: ["E07000150", "E07000152", "E07000153", "E07000156"],
	E06000062: ["E07000151", "E07000154", "E07000155"],
};

/**
 * The two English authorities whose codes changed in 2025, from their April
 * 2023 code to the one a 2025 partition carries.
 */
export const RECODED_2025: Record<string, string> = {
	E08000016: "E08000038",
	E08000019: "E08000039",
};

/**
 * A period of a partition compiled onto April 2023 authorities, with the
 * districts they replaced removed.
 *
 * The census reports on 2021 districts, and the compiled datasets add each
 * April 2023 authority summed from them while keeping the districts too.
 * Serving both counts those residents twice in any sum. So a successor that
 * is present must be exactly the sum of its predecessors, which are then
 * dropped, and what remains must be exactly the expected 2023 code set; any
 * other shape is refused rather than published.
 */
export const onApril2023Authorities = (
	period: MeasureObservationArtifact["periods"][number],
	expectedCodes: Iterable<string>,
): MeasureObservationArtifact["periods"][number] => {
	const byCode = new Map(
		period.records.map((record) => [record.areaCode, record]),
	);
	const replaced = new Set<string>();
	for (const [successor, predecessors] of Object.entries(
		APRIL_2023_LAD_MERGERS,
	)) {
		const record = byCode.get(successor);
		if (!record) continue;
		const summed = predecessors.reduce((total, code) => {
			const predecessor = byCode.get(code);
			if (!predecessor || !isNumericObservation(predecessor))
				throw new Error(`${successor} has no predecessor ${code}`);
			replaced.add(code);
			return total + predecessor.value;
		}, 0);
		if (!isNumericObservation(record) || record.value !== summed)
			throw new Error(
				`${successor} is not the sum of its predecessors ${predecessors.join(", ")}`,
			);
	}
	const records = period.records.filter(
		(record) => !replaced.has(record.areaCode),
	);
	const expected = [...expectedCodes].sort().join(",");
	const published = records
		.map((record) => record.areaCode)
		.sort()
		.join(",");
	if (published !== expected)
		throw new Error("does not hold exactly the April 2023 authorities");
	return { ...period, records };
};
