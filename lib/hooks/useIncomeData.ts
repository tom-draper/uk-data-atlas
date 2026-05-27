import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";
import {
	AnnualIncomeData,
	HourlyIncomeData,
	IncomeDataset,
	IncomeLADData,
} from "../types/income";
import { useDataLoader } from "./useDataLoader";

// Income CSVs use special sentinel values for suppressed/unavailable data
const parseNumber = (value: any): number | null => {
	if (
		!value ||
		value === "" ||
		value === "x" ||
		value === ".." ||
		value === ":" ||
		value === "-"
	)
		return null;
	const parsed = parseFloat(String(value).replace(/,/g, "").trim());
	return isNaN(parsed) ? null : parsed;
};

const parseAnnualIncomeData = async (): Promise<{
	data: Record<string, AnnualIncomeData>;
	names: Record<string, string>;
}> => {
	const res = await fetch(
		withCDN(
			"/data/economics/income/PROV - Home Geography Table 8.7a   Annual pay - Gross 2025.csv",
		),
	);
	if (!res.ok)
		throw new Error(
			`Failed to fetch annual income data: ${res.statusText}`,
		);

	const csvText = await res.text();
	const skipLines = findHeaderLine(csvText, "Description");
	const { data } = await parseCsv(csvText, { header: true, skipLines });

	const annualData: Record<string, AnnualIncomeData> = {};
	const names: Record<string, string> = {};
	for (const row of data as any[]) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E"))
			continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		names[code] = description;
		annualData[code] = {
			numberOfJobs: parseNumber(row["Number\nof jobsb\n(thousand)"]),
			median,
			medianPercentageChange: parseNumber(
				row["Annual\npercentage\nchange"],
			),
			mean,
			meanPercentageChange: parseNumber(
				row["Annual\npercentage\nchange.1"],
			),
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
	return { data: annualData, names };
};

const parseHourlyIncomeData = async (): Promise<{
	data: Record<string, HourlyIncomeData>;
	names: Record<string, string>;
}> => {
	const res = await fetch(
		withCDN(
			"/data/economics/income/PROV - Home Geography Table 8.5a   Hourly pay - Gross 2025.csv",
		),
	);
	if (!res.ok)
		throw new Error(
			`Failed to fetch hourly income data: ${res.statusText}`,
		);

	const csvText = await res.text();
	const skipLines = findHeaderLine(csvText, "Description");
	const { data } = await parseCsv(csvText, { header: true, skipLines });

	const hourlyData: Record<string, HourlyIncomeData> = {};
	const names: Record<string, string> = {};
	for (const row of data as any[]) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E"))
			continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		names[code] = description;
		hourlyData[code] = {
			numberOfJobs: parseNumber(row["Number\nof jobsb\n(thousand)"]),
			median,
			medianPercentageChange: parseNumber(
				row["Annual\npercentage\nchange"],
			),
			mean,
			meanPercentageChange: parseNumber(
				row["Annual\npercentage\nchange.1"],
			),
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
	return { data: hourlyData, names };
};

const mergeIncomeData = (
	annualResult: {
		data: Record<string, AnnualIncomeData>;
		names: Record<string, string>;
	},
	hourlyResult: {
		data: Record<string, HourlyIncomeData>;
		names: Record<string, string>;
	},
): Record<string, IncomeLADData> => {
	const { data: annualData, names: annualNames } = annualResult;
	const { data: hourlyData, names: hourlyNames } = hourlyResult;
	const merged: Record<string, IncomeLADData> = {};
	const allCodes = new Set([
		...Object.keys(annualData),
		...Object.keys(hourlyData),
	]);
	for (const code of allCodes) {
		const annual = annualData[code] ?? null;
		const hourly = hourlyData[code] ?? null;
		if (annual || hourly) {
			merged[code] = {
				ladCode: code,
				ladName: annualNames[code] ?? hourlyNames[code] ?? "",
				annual,
				hourly,
			};
		}
	}
	return merged;
};

export const useIncomeData = () => {
	return useDataLoader<IncomeDataset>(async () => {
		const [annualResult, hourlyResult] = await Promise.all([
			parseAnnualIncomeData(),
			parseHourlyIncomeData(),
		]);

		return {
			2025: {
				id: "income2025",
				type: "income",
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				data: mergeIncomeData(annualResult, hourlyResult),
			},
		};
	});
};
