import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import type { DatabaseSync } from "node:sqlite";
import type { AirQualityLADData } from "@uk-data-atlas/datasets/types/airQuality";

export function rebuildAirQuality(database: DatabaseSync): string {
	const rows = database
		.prepare(
			`SELECT area_code, area_name, period, release, geography, measure, members, value
			FROM v_observation WHERE dataset = ? ORDER BY period, area_code`,
		)
		.all("air-quality");
	if (rows.length === 0) throw new Error("Missing air quality observations");
	const seen = new Set<string>();
	const result: Record<
		string,
		{
			id: string;
			year: number;
			type: "airQuality";
			boundaryType: "localAuthority";
			boundaryYear: number;
			data: Record<string, AirQualityLADData>;
		}
	> = {};
	for (const row of rows) {
		if (
			typeof row.period !== "string" ||
			!/^\d{4}$/.test(row.period) ||
			typeof row.release !== "string" ||
			row.geography !== "localAuthority" ||
			typeof row.area_code !== "string" ||
			typeof row.area_name !== "string" ||
			typeof row.value !== "number"
		)
			throw new Error("Invalid air quality observation");
		const years = Object.entries(
			ATLAS_BOUNDARY_VINTAGES.localAuthority,
		).filter(([, release]) => release === row.release);
		if (years.length !== 1)
			throw new Error(`Unknown air quality release ${row.release}`);
		const boundaryYear = Number(years[0][0]);
		const dataset = (result[row.period] ??= {
			id: `airQuality${row.period}`,
			year: Number(row.period),
			type: "airQuality",
			boundaryType: "localAuthority",
			boundaryYear,
			data: {},
		});
		if (dataset.boundaryYear !== boundaryYear)
			throw new Error(`Air quality period ${row.period} spans releases`);
		const record = (dataset.data[row.area_code] ??= {
			ladCode: row.area_code,
			ladName: row.area_name,
			no2Mean: 0,
			pm25Mean: null,
			pm10Mean: null,
			gridCells: 0,
			pm25PopulationWeighted: null,
			pm25PopulationWeightedAnthropogenic: null,
		});
		if (record.ladName !== row.area_name)
			throw new Error(
				`Air quality area ${row.area_code} has conflicting names`,
			);
		const key = `${row.period}\0${row.area_code}\0${row.measure}\0${row.members}`;
		if (seen.has(key))
			throw new Error(
				`Duplicate air quality observation for ${row.area_code}`,
			);
		seen.add(key);
		if (row.measure === "background-concentration") {
			if (row.members === "pollutant=no2") record.no2Mean = row.value;
			else if (row.members === "pollutant=pm25")
				record.pm25Mean = row.value;
			else if (row.members === "pollutant=pm10")
				record.pm10Mean = row.value;
			else
				throw new Error(
					`Unknown air quality pollutant ${String(row.members)}`,
				);
		} else if (row.measure === "air-quality-grid-cells")
			record.gridCells = row.value;
		else if (row.measure === "pm25-population-weighted")
			record.pm25PopulationWeighted = row.value;
		else if (row.measure === "pm25-population-weighted-anthropogenic")
			record.pm25PopulationWeightedAnthropogenic = row.value;
		else
			throw new Error(
				`Unknown air quality measure ${String(row.measure)}`,
			);
	}
	for (const [period, dataset] of Object.entries(result))
		for (const code of Object.keys(dataset.data))
			for (const field of [
				"background-concentration\0pollutant=no2",
				"air-quality-grid-cells\0null",
			])
				if (!seen.has(`${period}\0${code}\0${field}`))
					throw new Error(
						`Air quality area ${code} is missing ${field.replace("\0", " ")}`,
					);
	return JSON.stringify(result);
}
