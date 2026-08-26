import {
	ChildPovertyDataset,
	ChildPovertyLADData,
} from "@/lib/types/childPoverty";

const TABLE_NAME = "7_BHC_Relative_LA";
const YEARS = [2022, 2023, 2024, 2025] as const;

const decodeXml = (value: string) =>
	value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();

function tableRows(contentXml: string): string[][] {
	const start = contentXml.indexOf(`<table:table table:name="${TABLE_NAME}"`);
	if (start === -1)
		throw new Error(`Could not find ${TABLE_NAME} in child-poverty source`);
	const end = contentXml.indexOf("</table:table>", start);
	if (end === -1)
		throw new Error(`Could not read ${TABLE_NAME} in child-poverty source`);

	const table = contentXml.slice(start, end);
	const rows: string[][] = [];
	for (const rowMatch of table.matchAll(
		/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g,
	)) {
		const cells: string[] = [];
		for (const cellMatch of rowMatch[1].matchAll(
			/<table:table-cell\b([^>]*)>([\s\S]*?)<\/table:table-cell>|<table:table-cell\b([^>]*)\/>/g,
		)) {
			const attrs = cellMatch[1] ?? cellMatch[3] ?? "";
			const value =
				/office:value="([^"]*)"/.exec(attrs)?.[1] ??
				decodeXml(cellMatch[2] ?? "");
			const repeats = Number(
				/table:number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? 1,
			);
			// The workbook pads every row to 16,384 spreadsheet columns. Only the
			// first ten contain this table's data, so never expand that padding.
			for (let i = 0; i < repeats && cells.length < 10; i++)
				cells.push(value);
		}
		rows.push(cells);
	}
	return rows;
}

export function loadChildPoverty(
	contentXml: string,
): Record<string, ChildPovertyDataset> {
	const recordsByYear = new Map<number, Record<string, ChildPovertyLADData>>(
		YEARS.map((year) => [year, {}]),
	);

	for (const row of tableRows(contentXml)) {
		const [ladName, ladCode, ...values] = row;
		if (!ladName || !ladCode || !/^[EWSN]\d{8}$/.test(ladCode)) continue;

		for (const [index, year] of YEARS.entries()) {
			const childCount = Number(values[index]);
			const childPovertyRate = Number(values[index + YEARS.length]) * 100;
			if (
				!Number.isFinite(childCount) ||
				!Number.isFinite(childPovertyRate) ||
				childPovertyRate <= 0
			)
				continue;
			recordsByYear.get(year)![ladCode] = {
				ladCode,
				ladName,
				childCount,
				childrenPopulation: childCount / (childPovertyRate / 100),
				childPovertyRate,
			};
		}
	}

	return Object.fromEntries(
		YEARS.map((year) => [
			year,
			{
				id: `childPoverty${year}`,
				type: "childPoverty" as const,
				year,
				measure: "relativeLowIncomeBeforeHousingCosts" as const,
				boundaryType: "localAuthority" as const,
				boundaryYear: 2024,
				data: recordsByYear.get(year)!,
			},
		]),
	);
}
