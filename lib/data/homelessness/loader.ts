import {
	HomelessnessDataset,
	HomelessnessLADData,
} from "@/lib/types/homelessness";

const TABLE_NAME = "TA1";
const MAX_COLUMNS = 7;
const LAD_CODE = /^E(?:06|07|08|09)\d{6}$/;

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
	if (start === -1) throw new Error(`Could not find ${TABLE_NAME} in homelessness source`);
	const end = contentXml.indexOf("</table:table>", start);
	if (end === -1) throw new Error(`Could not read ${TABLE_NAME} in homelessness source`);

	const rows: string[][] = [];
	for (const rowMatch of contentXml.slice(start, end).matchAll(
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
			for (let i = 0; i < repeats && cells.length < MAX_COLUMNS; i++)
				cells.push(value);
		}
		rows.push(cells);
	}
	return rows;
}

export function loadHomelessness(
	contentXml: string,
): Record<string, HomelessnessDataset> {
	const data: Record<string, HomelessnessLADData> = {};
	for (const row of tableRows(contentXml)) {
		const [ladCode, ladName, total, _households, perThousand, withChildren, children] = row;
		if (!ladCode || !ladName || !LAD_CODE.test(ladCode)) continue;
		const rawValues = [total, perThousand, withChildren, children];
		if (rawValues.some((value) => !value)) continue;
		const values = rawValues.map(Number);
		if (values.some((value) => !Number.isFinite(value))) continue;
		data[ladCode] = {
			ladCode,
			ladName,
			householdsInTemporaryAccommodation: values[0],
			householdsPerThousand: values[1],
			householdsWithChildren: values[2],
			childrenInTemporaryAccommodation: values[3],
		};
	}

	return {
		2026: {
			id: "homelessness2026q1",
			type: "homelessness",
			year: 2026,
			quarter: "Jan-Mar 2026",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data,
		},
	};
}
