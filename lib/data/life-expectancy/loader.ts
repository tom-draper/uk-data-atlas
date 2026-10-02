import type { LifeExpectancyDataset, LifeExpectancyLADData } from "@/lib/types";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";
import type { DatasetReader } from "../catalog/types";

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

export async function loadLE(
	readRows: DatasetReader["xlsxSheetSelectedRows"],
): Promise<Record<string, LifeExpectancyDataset>> {
	const [leRecords, hleRecords] = await Promise.all([
		readLifeExpectancyRows(
			readRows,
			"health/life-expectancy/lifeexpectancylocalareas.xlsx",
			9,
			"Life expectancy",
		),
		readLifeExpectancyRows(
			readRows,
			"health/life-expectancy/healthylifeexpectancyuk.xlsx",
			9,
			"HLE",
		),
	]);
	addMergedLifeExpectancyAuthorities(leRecords);

	const result: Record<string, LifeExpectancyDataset> = {
		le: {
			id: "le",
			year: 2024,
			type: "lifeExpectancy",
			boundaryType: "localAuthority",
			boundaryYear: 2023,
			dataPeriod: "2022–2024",
			label: "Life Expectancy",
			coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
			data: leRecords,
			metadata: {
				source: "Office for National Statistics. Life expectancy for local areas of the UK: 2022 to 2024.",
				notes: ["Life expectancy at birth. UK local authorities."],
			},
		},
	};

	addMergedLifeExpectancyAuthorities(hleRecords);
	result.hle = {
		id: "hle",
		year: 2024,
		type: "lifeExpectancy",
		boundaryType: "localAuthority",
		boundaryYear: 2023,
		dataPeriod: "2022–2024",
		label: "Healthy Life Expectancy",
		coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
		data: hleRecords,
		metadata: {
			source: "Office for National Statistics. Healthy life expectancy, UK: 2022 to 2024.",
			notes: ["Healthy life expectancy at birth. UK local authorities."],
		},
	};

	return result;
}
