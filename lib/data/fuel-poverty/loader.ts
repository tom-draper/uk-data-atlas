import {
	FuelPovertyDataset,
	FuelPovertyLSOAData,
} from "@/lib/types/fuelPoverty";

const TABLE_NAME = "Table_4";

function rows(contentXml: string): string[][] {
	const start = contentXml.indexOf(`<table:table table:name="${TABLE_NAME}"`);
	const end = contentXml.indexOf("</table:table>", start);
	if (start === -1 || end === -1)
		throw new Error("Could not find fuel-poverty LSOA table");
	return [
		...contentXml
			.slice(start, end)
			.matchAll(/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g),
	].map((row) => {
		const values: string[] = [];
		for (const cell of row[1].matchAll(
			/<table:table-cell\b([^>]*)>([\s\S]*?)<\/table:table-cell>|<table:table-cell\b([^>]*)\/>/g,
		)) {
			const attrs = cell[1] ?? cell[3] ?? "";
			const value =
				/office:value="([^"]*)"/.exec(attrs)?.[1] ??
				(cell[2] ?? "")
					.replace(/<[^>]+>/g, "")
					.replace(/\s+/g, " ")
					.trim();
			const repeat = Number(
				/table:number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? 1,
			);
			for (let i = 0; i < repeat && values.length < 8; i++)
				values.push(value);
		}
		return values;
	});
}

export function loadFuelPoverty(
	contentXml: string,
): Record<string, FuelPovertyDataset> {
	const data: Record<string, FuelPovertyLSOAData> = {};
	for (const [lsoaCode, lsoaName, , , , households, fuelPoor, rate] of rows(
		contentXml,
	)) {
		if (!/^E01\d{6}$/.test(lsoaCode)) continue;
		const householdCount = Number(households),
			fuelPoorHouseholdCount = Number(fuelPoor),
			fuelPovertyRate = Number(rate);
		if (
			![householdCount, fuelPoorHouseholdCount, fuelPovertyRate].every(
				Number.isFinite,
			)
		)
			continue;
		data[lsoaCode] = {
			lsoaCode,
			lsoaName,
			householdCount,
			fuelPoorHouseholdCount,
			fuelPovertyRate,
		};
	}
	return {
		2024: {
			id: "fuelPoverty2024",
			type: "fuelPoverty",
			year: 2024,
			boundaryType: "lsoa",
			boundaryYear: 2011,
			data,
		},
	};
}
