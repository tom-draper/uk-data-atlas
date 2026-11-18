import type { DatasetReader } from "../catalog/types.ts";
import type {
	DirectPart,
	DirectRecord,
	DirectValue,
} from "../../declaration/statistics.ts";
import { periods } from "../../declaration/statistics.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";
import {
	PUBLIC_HEALTH_MEASURES,
	type PublicHealthMeasure,
} from "./measures.ts";

/** Each indicator's statistic measure. Child weight is by school year. */
const MEASURES: Record<
	PublicHealthMeasure,
	{ measure: string; school: boolean }
> = {
	receptionExcessWeight: { measure: "reception-excess-weight", school: true },
	year6ExcessWeight: { measure: "year-6-excess-weight", school: true },
	adultExcessWeight: { measure: "adult-excess-weight", school: false },
	activity: { measure: "physically-active-adults", school: false },
	smoking: { measure: "smoking-prevalence", school: false },
	preventableMortality: { measure: "preventable-mortality", school: false },
};

function periodOf(label: string, school: boolean) {
	const year = /^(\d{4})\/\d{2}$/.exec(label);
	if (year)
		return school
			? periods.academicYear(Number(year[1]))
			: periods.financialYear(Number(year[1]));
	if (/^\d{4}$/.test(label)) return periods.year(Number(label));
	throw new Error(`Unknown public health period ${label}`);
}

/**
 * Public Health Outcomes Framework indicators for English counties and
 * unitary authorities, persons, as the single part `2025`. Each indicator is
 * taken at the latest period collected for it, and its own period is kept, as
 * the indicators are not collected for the same year. A suppressed value is
 * left out.
 */
export async function publicHealthStatisticsParts(
	read: DatasetReader["csvRows"],
): Promise<DirectPart[]> {
	const rows: {
		row: Readonly<Record<string, string>>;
		measure: PublicHealthMeasure;
		sort: number;
	}[] = [];
	const latest: Partial<Record<PublicHealthMeasure, number>> = {};
	for (const file of ["health-improvement", "healthcare-premature-mortality"])
		await read(sourceDir("public-health", `${file}.csv`), {}, (row) => {
			const option = PUBLIC_HEALTH_MEASURES.find(
				(option) =>
					option.id === row["Indicator ID"] && option.age === row.Age,
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
		});
	const records = new Map<string, DirectRecord>();
	for (const { row, measure, sort } of rows) {
		if (sort !== latest[measure]) continue;
		const value = parseNullableNum(row.Value);
		if (value == null) continue;
		const code = row["Area Code"];
		let record = records.get(code);
		if (!record)
			records.set(
				code,
				(record = { code, name: row["Area Name"], values: [] }),
			);
		const { measure: slug, school } = MEASURES[measure];
		record.values.push({
			measure: slug,
			value,
			period: periodOf(row["Time period"], school),
		} satisfies DirectValue);
	}
	return [{ key: "2025", records: [...records.values()] }];
}
