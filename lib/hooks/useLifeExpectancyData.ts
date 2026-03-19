import { useState, useEffect } from "react";
import { LifeExpectancyDataset, LifeExpectancyRecord } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";

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

export const useLifeExpectancyData = () => {
	const [datasets, setDatasets] = useState<Record<string, LifeExpectancyDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const [leRes, hleRes] = await Promise.all([
					fetch(withCDN("/data/life-expectancy/lifeexpectancylocalareas.csv")),
					fetch(withCDN("/data/life-expectancy/healthylifeexpectancyuk.csv")),
				]);

				if (!leRes.ok) throw new Error(`Failed to fetch LE data: ${leRes.statusText}`);
				if (!hleRes.ok) throw new Error(`Failed to fetch HLE data: ${hleRes.statusText}`);

				const [leText, hleText] = await Promise.all([leRes.text(), hleRes.text()]);

				const [{ data: leData }, { data: hleDataAll }] = await Promise.all([
					parseCsv(leText, { header: true }),
					parseCsv(hleText, { header: true, skipLines: 6 }),
				]);

				const hleData = (hleDataAll as Record<string, string>[]).filter(
					(r) =>
						r["Period"]?.trim() === "2020 to 2022" &&
						r["Age group"]?.trim() === "<1" &&
						r["Area type"]?.trim() === "Local Areas",
				);

				const leRecords = parsePairedRows(
					leData as Record<string, string>[],
					"Area code", "Area name", "Sex", "Life expectancy",
				);
				const hleRecords = parsePairedRows(
					hleData,
					"Area code", "Area name", "Sex", "HLE",
				);

				setDatasets({
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
					hle: {
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
					},
				});
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading life expectancy data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
