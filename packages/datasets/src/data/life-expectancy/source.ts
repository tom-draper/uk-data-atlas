import type { LifeExpectancyLADData } from "../../types/lifeExpectancy.ts";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations.ts";
import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

const COMMON_COLUMNS = [
	[0, "Period"],
	[2, "Area type"],
	[3, "Area code"],
	[4, "Area name"],
	[5, "Sex"],
	[7, "Age group"],
] as const;

async function readLifeExpectancyRows(
	readRows: DatasetReader["xlsxSheetSelectedRows"],
	path: string,
	valueColumn: number,
	valueName: string,
): Promise<Record<string, LifeExpectancyLADData>> {
	const headers = new Map([...COMMON_COLUMNS, [valueColumn, valueName]]);
	let foundHeaders = false;
	const male: Record<string, { name: string; value: number }> = {};
	const female: Record<string, { name: string; value: number }> = {};

	await readRows(path, "1", [...headers.keys()], (row) => {
		if (!foundHeaders) {
			if (row.get(0)?.trim() !== "Period") return;
			const missing = [...headers].find(
				([column, header]) => row.get(column)?.trim() !== header,
			);
			if (missing)
				throw new Error(
					`${path}: expected ${missing[1]} in column ${missing[0] + 1}.`,
				);
			foundHeaders = true;
			return;
		}
		if (
			row.get(0)?.trim() !== "2022 to 2024" ||
			row.get(2)?.trim() !== "Local Areas" ||
			row.get(7)?.trim() !== "<1"
		)
			return;
		const ladCode = row.get(3)?.trim();
		if (!ladCode) return;
		const value = Number.parseFloat(row.get(valueColumn) ?? "");
		if (Number.isNaN(value)) return;
		const name = row.get(4)?.trim() || "";
		const sex = row.get(5)?.trim();
		if (sex === "Male") male[ladCode] = { name, value };
		else if (sex === "Female") female[ladCode] = { name, value };
	});
	if (!foundHeaders)
		throw new Error(`${path}: could not find the header row.`);

	const records: Record<string, LifeExpectancyLADData> = {};
	for (const ladCode of Object.keys(male)) {
		if (!female[ladCode]) continue;
		records[ladCode] = {
			ladCode,
			ladName: male[ladCode].name,
			maleBirthLE: male[ladCode].value,
			femaleBirthLE: female[ladCode].value,
		};
	}
	return records;
}

/** Add post-2023 authority records from their predecessor life-expectancy estimates. */
export function addMergedLifeExpectancyAuthorities(
	records: Record<string, LifeExpectancyLADData>,
): void {
	for (const [target, { name, predecessors }] of Object.entries(
		APRIL_2023_LAD_MERGERS,
	)) {
		if (records[target]) continue;
		const source = predecessors.map((code) => {
			const record = records[code];
			if (!record)
				throw new Error(
					`Missing life expectancy predecessor ${code} for ${target}`,
				);
			return record;
		});
		// The source does not provide a merger denominator. Match the chart's
		// existing area aggregation by taking the mean of its component estimates.
		records[target] = {
			ladCode: target,
			ladName: name,
			derivedFromPredecessors: [...predecessors],
			maleBirthLE:
				source.reduce((sum, record) => sum + record.maleBirthLE, 0) /
				source.length,
			femaleBirthLE:
				source.reduce((sum, record) => sum + record.femaleBirthLE, 0) /
				source.length,
		};
	}
}

/** A local authority's life expectancy as rows: one per sex. */
const recordOf = (
	record: LifeExpectancyLADData,
	measure: string,
): DirectRecord => ({
	code: record.ladCode,
	name: record.ladName,
	parents: Object.fromEntries(
		(record.derivedFromPredecessors ?? []).map((code, index) => [
			`derivedFromPredecessors.${index}`,
			{ code },
		]),
	),
	values: [
		{ measure, members: { sex: "male" }, value: record.maleBirthLE },
		{ measure, members: { sex: "female" }, value: record.femaleBirthLE },
	],
});

/**
 * Life expectancy (part `le`) and healthy life expectancy (part `hle`) at
 * birth, 2022 to 2024, for the UK's local authorities. An authority created in
 * 2023 is the mean of its predecessors and names them as its parents.
 */
export async function lifeExpectancyStatisticsParts(
	readRows: DatasetReader["xlsxSheetSelectedRows"],
): Promise<DirectPart[]> {
	const [life, healthy] = await Promise.all([
		readLifeExpectancyRows(
			readRows,
			sourceDir("life-expectancy", "lifeexpectancylocalareas.xlsx"),
			9,
			"Life expectancy",
		),
		readLifeExpectancyRows(
			readRows,
			sourceDir("life-expectancy", "healthylifeexpectancyuk.xlsx"),
			9,
			"HLE",
		),
	]);
	addMergedLifeExpectancyAuthorities(life);
	addMergedLifeExpectancyAuthorities(healthy);
	return [
		{
			key: "le",
			records: Object.values(life).map((record) =>
				recordOf(record, "life-expectancy"),
			),
		},
		{
			key: "hle",
			records: Object.values(healthy).map((record) =>
				recordOf(record, "healthy-life-expectancy"),
			),
		},
	];
}
