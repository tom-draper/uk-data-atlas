import {
	QualificationDataset,
	QualificationBreakdown,
} from "@/lib/types/qualification";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parseNullableInt } from "@/lib/helpers/parseNumber";
import { addMergedCountAuthorities } from "../localAuthority/reorganisations";

const CATEGORY_MAP: Record<string, keyof QualificationBreakdown> = {
	"0": "noQualifications",
	"1": "level1",
	"2": "level2",
	"3": "apprenticeship",
	"4": "level3",
	"5": "level4Plus",
	"6": "other",
};

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

export async function loadQualification(
	read: (path: string) => Promise<string>,
): Promise<Record<string, QualificationDataset>> {
	const { data } = await parseCsv(
		await read("education/qualification/TS067-2021-3.csv"),
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

		const field = CATEGORY_MAP[catCode];
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

	const records: QualificationDataset["data"] = {};
	for (const [ladCode, breakdown] of Object.entries(laData)) {
		records[ladCode] = { ladCode, breakdown };
	}

	return {
		2021: {
			id: "qualifications2021",
			type: "qualification",
			year: 2021,
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data: records,
			metadata: {
				source: "Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067.",
				notes: [
					"England and Wales only. Covers usual residents aged 16 and over; residents under 16, whom the table records as 'Does not apply', are excluded.",
				],
			},
		},
	};
}
