import {
	AnnualIncomeData,
	HourlyIncomeData,
	IncomeDataset,
	IncomeLADData,
} from "@/lib/types/income";
import { parseCsv, findHeaderLine } from "@/lib/helpers/parseCsv";
import { parseNullableNum as parseNumber } from "@/lib/helpers/parseNumber";

async function parseAnnualData(text: string): Promise<{
	data: Record<string, AnnualIncomeData>;
	names: Record<string, string>;
}> {
	const skipLines = findHeaderLine(text, "Description");
	const { data } = await parseCsv(text, { header: true, skipLines });

	const annualData: Record<string, AnnualIncomeData> = {};
	const names: Record<string, string> = {};
	for (const row of data) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E"))
			continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		names[code] = description;
		annualData[code] = {
			numberOfJobs: parseNumber(row["(thousand)"]),
			median,
			medianPercentageChange: parseNumber(row["change"]),
			mean,
			meanPercentageChange: parseNumber(row["change_1"]),
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
}

async function parseHourlyData(text: string): Promise<{
	data: Record<string, HourlyIncomeData>;
	names: Record<string, string>;
}> {
	const skipLines = findHeaderLine(text, "Description");
	const { data } = await parseCsv(text, { header: true, skipLines });

	const hourlyData: Record<string, HourlyIncomeData> = {};
	const names: Record<string, string> = {};
	for (const row of data) {
		const code = row["Code"]?.trim();
		const description = row["Description"]?.trim();
		if (!code || !description || code === "Code" || !code.startsWith("E"))
			continue;

		const median = parseNumber(row["Median"]);
		const mean = parseNumber(row["Mean"]);
		if (median === null && mean === null) continue;

		names[code] = description;
		hourlyData[code] = {
			numberOfJobs: parseNumber(row["(thousand)"]),
			median,
			medianPercentageChange: parseNumber(row["change"]),
			mean,
			meanPercentageChange: parseNumber(row["change_1"]),
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
}

export async function loadIncome(
	read: (path: string) => Promise<string>,
): Promise<Record<string, IncomeDataset>> {
	const [annualResult, hourlyResult] = await Promise.all([
		parseAnnualData(
			await read(
				"economics/income/PROV - Home Geography Table 8.7a   Annual pay - Gross 2025.xlsx",
			),
		),
		parseHourlyData(
			await read(
				"economics/income/PROV - Home Geography Table 8.5a   Hourly pay - Gross 2025.xlsx",
			),
		),
	]);

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

	return {
		2025: {
			id: "income2025",
			type: "income",
			year: 2025,
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data: merged,
		},
	};
}
