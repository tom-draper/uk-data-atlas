import type { DatasetReader } from "../catalog/types";
import { parseNullableNum } from "../../helpers/parseNumber";
export const PUBLIC_HEALTH_MEASURES = [
	{
		value: "smoking",
		label: "Adult smoking (18+)",
		id: "92443",
		age: "18+ yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "adultExcessWeight",
		label: "Adult overweight including obesity (18+)",
		id: "93088",
		age: "18+ yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "activity",
		label: "Physically active adults (19+)",
		id: "93014",
		age: "19+ yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "receptionExcessWeight",
		label: "Reception overweight including obesity (4-5)",
		id: "20601",
		age: "4-5 yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "year6ExcessWeight",
		label: "Year 6 overweight including obesity (10-11)",
		id: "20602",
		age: "10-11 yrs",
		unit: "%",
		maximum: 100,
	},
	{
		value: "preventableMortality",
		label: "Preventable mortality under 75",
		id: "93721",
		age: "<75 yrs",
		unit: "per 100,000",
		maximum: 400,
	},
] as const;
export type PublicHealthMeasure =
	(typeof PUBLIC_HEALTH_MEASURES)[number]["value"];
export interface PublicHealthRecord {
	code: string;
	name: string;
	metrics: Partial<Record<PublicHealthMeasure, number>>;
	isAverage?: boolean;
}
export interface PublicHealthDataset {
	id: string;
	type: "publicHealth";
	year: number;
	boundaryType: "countyAndUnitaryAuthority";
	boundaryYear: number;
	data: Record<string, PublicHealthRecord>;
	periods: Partial<Record<PublicHealthMeasure, string>>;
}
export async function loadPublicHealth(
	read: DatasetReader["csvRows"],
): Promise<Record<string, PublicHealthDataset>> {
	const rows: {
		row: Readonly<Record<string, string>>;
		measure: PublicHealthMeasure;
		sort: number;
	}[] = [];
	const latest: Partial<Record<PublicHealthMeasure, number>> = {};
	for (const file of ["health-improvement", "healthcare-premature-mortality"])
		await read(
			`health/public-health-outcomes-framework/${file}.csv`,
			{},
			(row) => {
				const option = PUBLIC_HEALTH_MEASURES.find(
					(option) =>
						option.id === row["Indicator ID"] &&
						option.age === row.Age,
				);
				if (
					!option ||
					row.Sex !== "Persons" ||
					row.Category ||
					row["Category Type"] ||
					row["Area Type"] !== "Counties & UAs (from Apr 2023)" ||
					!/^E(?:0[6789]|10)[0-9]{6}$/.test(row["Area Code"] ?? "")
				)
					return;
				const sort = Number(row["Time period Sortable"]);
				if (!Number.isFinite(sort)) return;
				latest[option.value] = Math.max(
					latest[option.value] ?? -Infinity,
					sort,
				);
				rows.push({ row, measure: option.value, sort });
			},
		);
	const data: Record<string, PublicHealthRecord> = {};
	const periods: PublicHealthDataset["periods"] = {};
	for (const { row, measure, sort } of rows) {
		if (sort !== latest[measure]) continue;
		periods[measure] = row["Time period"];
		const value = parseNullableNum(row.Value);
		if (value == null) continue;
		const code = row["Area Code"];
		const record = (data[code] ??= {
			code,
			name: row["Area Name"],
			metrics: {},
		});
		record.metrics[measure] = value;
	}
	return {
		2025: {
			id: "publicHealth2025",
			type: "publicHealth",
			year: 2025,
			boundaryType: "countyAndUnitaryAuthority",
			boundaryYear: 2025,
			data,
			periods,
		},
	};
}
