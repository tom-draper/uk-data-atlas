import type { DirectPart } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableInt } from "../../helpers/parseNumber.ts";
import { addMergedCountAuthorities } from "../localAuthority/reorganisations.ts";
import { sourceDir } from "../../declaration/sources.ts";

/** The census's highest-qualification categories, by their source code. */
const CATEGORY_MAP = {
	"0": "noQualifications",
	"1": "level1",
	"2": "level2",
	"3": "apprenticeship",
	"4": "level3",
	"5": "level4Plus",
	"6": "other",
} as const;

type QualificationBreakdown = Record<
	(typeof CATEGORY_MAP)[keyof typeof CATEGORY_MAP] | "total",
	number
>;

function pick(row: Record<string, any>, ...keys: string[]): string {
	for (const k of keys) {
		const v = row[k];
		if (v !== undefined && v !== null && v !== "") return String(v).trim();
	}
	return "";
}

const emptyBreakdown = (): QualificationBreakdown => ({
	noQualifications: 0,
	level1: 0,
	level2: 0,
	apprenticeship: 0,
	level3: 0,
	level4Plus: 0,
	other: 0,
	total: 0,
});

/** Add post-2023 authority records by summing every Census category. */
export function addMergedQualificationAuthorities(
	data: Record<string, QualificationBreakdown>,
): void {
	addMergedCountAuthorities(data, emptyBreakdown, "qualification");
}

/**
 * Census 2021 highest level of qualification (TS067) for usual residents aged
 * 16 and over, as the one part `2021`. The total is the sum of the categories
 * counted, and the four authorities created in 2023 are the sums of their
 * predecessors.
 */
export async function qualificationStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv(
		await read(sourceDir("qualification", "TS067-2021-3.csv")),
		{ header: true },
	);

	const laData: Record<string, QualificationBreakdown> = {};
	for (const row of data) {
		const ladCode = pick(
			row,
			"Lower tier local authorities Code",
			"Lower Tier Local Authorities Code",
			"geography code",
			"GeographyCode",
			"LA Code",
			"laCode",
		);
		if (!ladCode) continue;

		const catCode = pick(
			row,
			"Highest level of qualification (8 categories) Code",
			"Qualification Code",
			"qualificationCode",
			"Category Code",
		);
		if (!catCode || catCode === "-8") continue;

		const field = CATEGORY_MAP[catCode as keyof typeof CATEGORY_MAP];
		if (!field) continue;

		const count = parseNullableInt(
			pick(row, "Observation", "Count", "Value", "observation"),
		);
		if (count === null) continue;

		const breakdown = (laData[ladCode] ??= emptyBreakdown());
		breakdown[field] += count;
		breakdown.total += count;
	}
	addMergedQualificationAuthorities(laData);

	return [
		{
			key: "2021",
			records: Object.entries(laData).map(([code, breakdown]) => ({
				code,
				values: Object.entries(breakdown).map(([key, value]) => ({
					measure: "usual-residents-16-plus",
					members: { "highest-qualification": key },
					value,
				})),
			})),
		},
	];
}
