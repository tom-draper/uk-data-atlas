import { LifeExpectancyDataset, LifeExpectancyLADData } from "@/lib/types";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { APRIL_2023_LAD_MERGERS } from "../localAuthority/reorganisations";

function parsePairedRows(
	rows: Record<string, string>[],
	codeCol: string,
	nameCol: string,
	sexCol: string,
	valueCol: string,
): Record<string, LifeExpectancyLADData> {
	const male: Record<string, { name: string; value: number }> = {};
	const female: Record<string, { name: string; value: number }> = {};

	for (const row of rows) {
		const ladCode = row[codeCol]?.trim();
		if (!ladCode) continue;
		const value = parseFloat(row[valueCol]);
		if (isNaN(value)) continue;
		const name = row[nameCol]?.trim() || "";
		const sex = row[sexCol]?.trim();
		if (sex === "Male") male[ladCode] = { name, value };
		else if (sex === "Female") female[ladCode] = { name, value };
	}

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
	read: (path: string) => Promise<string>,
): Promise<Record<string, LifeExpectancyDataset>> {
	const [leText, hleText] = await Promise.all([
		read("health/life-expectancy/lifeexpectancylocalareas.xlsx"),
		read("health/life-expectancy/healthylifeexpectancyuk.xlsx"),
	]);

	// Sheet 1 carries every period, area type and age band; the atlas charts
	// life expectancy at birth for local areas in the latest period.
	const { data: leDataAll } = await parseCsv(leText, {
		header: true,
		skipLines: 5,
	});
	const leData = (leDataAll as Record<string, string>[]).filter(
		(row) =>
			row["Period"]?.trim() === "2022 to 2024" &&
			row["Age group"]?.trim() === "<1" &&
			row["Area type"]?.trim() === "Local Areas",
	);
	const leRecords = parsePairedRows(
		leData,
		"Area code",
		"Area name",
		"Sex",
		"Life expectancy",
	);
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

	if (hleText) {
		const { data: hleDataAll } = await parseCsv(hleText, {
			header: true,
			skipLines: 6,
		});
		const hleData = (hleDataAll as Record<string, string>[]).filter(
			(r) =>
				r["Period"]?.trim() === "2022 to 2024" &&
				r["Age group"]?.trim() === "<1" &&
				r["Area type"]?.trim() === "Local Areas",
		);
		const hleRecords = parsePairedRows(
			hleData,
			"Area code",
			"Area name",
			"Sex",
			"HLE",
		);
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
				notes: [
					"Healthy life expectancy at birth. UK local authorities.",
				],
			},
		};
	}

	return result;
}
