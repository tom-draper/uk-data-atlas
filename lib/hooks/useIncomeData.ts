// lib/hooks/useIncomeData.ts
import { useState, useEffect } from "react";
import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";
import {
	AnnualIncomeData,
	HourlyIncomeData,
	IncomeDataset,
	LocalAuthorityIncomeData,
} from "../types/income";

const parseNumber = (value: any): number | null => {
	if (!value || value === "" || value === "x" || value === ".." || value === ":" || value === "-")
		return null;
	const parsed = parseFloat(String(value).replace(/,/g, "").trim());
	return isNaN(parsed) ? null : parsed;
};

const parseAnnualIncomeData = async (): Promise<Record<string, AnnualIncomeData>> => {
	const res = await fetch(
		withCDN("/data/economics/income/PROV - Home Geography Table 8.7a   Annual pay - Gross 2025.csv"),
	);
	if (!res.ok) throw new Error(`Failed to fetch annual income data: ${res.statusText}`);

	const csvText = await res.text();
	const skipLines = findHeaderLine(csvText, "Description");
	const { data } = await parseCsv(csvText, { header: true, skipLines });

	const annualData: Record<string, AnnualIncomeData> = {};
	for (const row of data as any[]) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E")) continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		annualData[code] = {
			name: description,
			numberOfJobs: parseNumber(row["Number\nof jobsb\n(thousand)"]),
			median,
			medianPercentageChange: parseNumber(row["Annual\npercentage\nchange"]),
			mean,
			meanPercentageChange: parseNumber(row["Annual\npercentage\nchange.1"]),
			percentiles: {
				p10: parseNumber(row["10"]),
				p20: parseNumber(row["20"]),
				p25: parseNumber(row["25"]),
				p30: parseNumber(row["30"]),
				p40: parseNumber(row["40"]),
				p60: parseNumber(row["60"]),
				p70: parseNumber(row["70"]),
				p75: parseNumber(row["75"]),
				p80: parseNumber(row["80"]),
				p90: parseNumber(row["90"]),
			},
		};
	}
	return annualData;
};

const parseHourlyIncomeData = async (): Promise<Record<string, HourlyIncomeData>> => {
	const res = await fetch(
		withCDN("/data/economics/income/PROV - Home Geography Table 8.5a   Hourly pay - Gross 2025.csv"),
	);
	if (!res.ok) throw new Error(`Failed to fetch hourly income data: ${res.statusText}`);

	const csvText = await res.text();
	const skipLines = findHeaderLine(csvText, "Description");
	const { data } = await parseCsv(csvText, { header: true, skipLines });

	const hourlyData: Record<string, HourlyIncomeData> = {};
	for (const row of data as any[]) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E")) continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		hourlyData[code] = {
			name: description,
			numberOfJobs: parseNumber(row["Number\nof jobsb\n(thousand)"]),
			median,
			medianPercentageChange: parseNumber(row["Annual\npercentage\nchange"]),
			mean,
			meanPercentageChange: parseNumber(row["Annual\npercentage\nchange.1"]),
			percentiles: {
				p10: parseNumber(row["10"]),
				p20: parseNumber(row["20"]),
				p25: parseNumber(row["25"]),
				p30: parseNumber(row["30"]),
				p40: parseNumber(row["40"]),
				p60: parseNumber(row["60"]),
				p70: parseNumber(row["70"]),
				p75: parseNumber(row["75"]),
				p80: parseNumber(row["80"]),
				p90: parseNumber(row["90"]),
			},
		};
	}
	return hourlyData;
};

const mergeIncomeData = (
	annualData: Record<string, AnnualIncomeData>,
	hourlyData: Record<string, HourlyIncomeData>,
): Record<string, LocalAuthorityIncomeData> => {
	const merged: Record<string, LocalAuthorityIncomeData> = {};
	const allCodes = new Set([...Object.keys(annualData), ...Object.keys(hourlyData)]);
	for (const code of allCodes) {
		const annual = annualData[code] ?? null;
		const hourly = hourlyData[code] ?? null;
		if (annual || hourly) {
			merged[code] = {
				code,
				name: annual?.name ?? hourly?.name ?? "",
				annual,
				hourly,
			};
		}
	}
	return merged;
};

export const useIncomeData = () => {
	const [datasets, setDatasets] = useState<Record<string, IncomeDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const [annualData, hourlyData] = await Promise.all([
					parseAnnualIncomeData(),
					parseHourlyIncomeData(),
				]);

				setDatasets({
					2025: {
						id: "income2025",
						type: "income",
						year: 2025,
						boundaryType: "localAuthority",
						boundaryYear: 2025,
						data: mergeIncomeData(annualData, hourlyData),
					},
				});
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading income data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
