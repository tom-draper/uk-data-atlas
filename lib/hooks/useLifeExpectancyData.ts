import { LifeExpectancyDataset, LifeExpectancyRecord } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { useDataLoader } from "./useDataLoader";

function parsePairedRows(
	rows: Record<string, string>[],
	codeCol: string,
	nameCol: string,
	sexCol: string,
	valueCol: string,
): Record<string, LifeExpectancyRecord> {
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

	const records: Record<string, LifeExpectancyRecord> = {};
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

export const useLifeExpectancyData = (enableHLE = true) => {
	return useDataLoader<LifeExpectancyDataset>(async () => {
		const fetches: Promise<Response>[] = [
			fetch(withCDN("/data/life-expectancy/lifeexpectancylocalareas.csv")),
		];
		if (enableHLE) {
			fetches.push(fetch(withCDN("/data/life-expectancy/healthylifeexpectancyuk.csv")));
		}

		const [leRes, hleRes] = await Promise.all(fetches);

		if (!leRes.ok) throw new Error(`Failed to fetch LE data: ${leRes.statusText}`);
		if (enableHLE && hleRes && !hleRes.ok)
			throw new Error(`Failed to fetch HLE data: ${hleRes.statusText}`);

		const leText = await leRes.text();
		const { data: leData } = await parseCsv(leText, { header: true });

		const leRecords = parsePairedRows(
			leData as Record<string, string>[],
			"Area code", "Area name", "Sex", "Life expectancy",
		);

		const result: Record<string, LifeExpectancyDataset> = {
			le: {
				id: "le",
				year: 2022,
				type: "lifeExpectancy",
				boundaryType: "localAuthority",
				boundaryYear: 2023,
				dataPeriod: "2020–2022",
				label: "Life Expectancy",
				data: leRecords,
				metadata: {
					source: "Office for National Statistics. Life expectancy for local areas in England, Northern Ireland and Wales: 2020 to 2022.",
					notes: ["Life expectancy at birth. England, Wales and Northern Ireland only."],
				},
			},
		};

		if (enableHLE && hleRes) {
			const hleText = await hleRes.text();
			const { data: hleDataAll } = await parseCsv(hleText, { header: true, skipLines: 6 });
			const hleData = (hleDataAll as Record<string, string>[]).filter(
				(r) =>
					r["Period"]?.trim() === "2020 to 2022" &&
					r["Age group"]?.trim() === "<1" &&
					r["Area type"]?.trim() === "Local Areas",
			);
			const hleRecords = parsePairedRows(hleData, "Area code", "Area name", "Sex", "HLE");
			result.hle = {
				id: "hle",
				year: 2022,
				type: "lifeExpectancy",
				boundaryType: "localAuthority",
				boundaryYear: 2023,
				dataPeriod: "2020–2022",
				label: "Healthy Life Expectancy",
				data: hleRecords,
				metadata: {
					source: "Office for National Statistics. Health state life expectancies, UK: 2020 to 2022.",
					notes: ["Healthy life expectancy at birth. UK local authorities."],
				},
			};
		}

		return result;
	});
};
