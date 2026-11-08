import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csvRecords } from "@uk-data-atlas/artifacts";
import {
	CENSUS_SMALL_AREA_DIRECTORY,
	CENSUS_SMALL_AREA_TABLES,
} from "../catalog/censusSmallArea.ts";
import type { WeightUnits } from "../storage/atlasCrosswalkWeights.ts";

/**
 * The held counts that crosswalk weights share out between postcodes, each
 * on the release of areas it was published for:
 *
 * - Census 2021 usual residents (TS001) and households (TS003) of each
 *   England and Wales LSOA, on the 2021 LSOAs. Output-area counts are not
 *   held.
 * - Small-area population estimates 2017 (SIMD 2020v2) of each Scottish data
 *   zone, on the 2011 data zones. Scotland has no household count held.
 *
 * Northern Ireland postcodes are not held, so its counts would have nowhere to
 * go and are not read.
 */
export const WEIGHT_UNIT_RELEASES = {
	lsoa: { geography: "lsoa", boundaryRelease: "2021-12-ew-bgc-v5" },
	dataZone: { geography: "dataZone", boundaryRelease: "2011-12-sc-bfc" },
} as const;

/** The source files read, relative to `data/source`, for the stage graph. */
export const WEIGHT_UNIT_INPUTS = [
	`${CENSUS_SMALL_AREA_DIRECTORY}/ts001/census2021-ts001-lsoa.csv`,
	`${CENSUS_SMALL_AREA_DIRECTORY}/ts003/census2021-ts003-lsoa.csv`,
	"deprivation/simd/SIMD+2020v2+-+indicators.csv",
];

/** One column of a CSV as counts by code. Every row must be usable. */
const readCounts = (
	repositoryRoot: string,
	input: string,
	codeColumn: string,
	valueColumn: string,
) => {
	const [header, ...rows] = csvRecords(
		readFileSync(
			join(repositoryRoot, "data/source", input),
			"utf8",
		).replace(/^﻿/, ""),
	);
	const code = header?.indexOf(codeColumn) ?? -1;
	const value = header?.indexOf(valueColumn) ?? -1;
	if (code < 0 || value < 0)
		throw new Error(
			`${input} has no ${code < 0 ? codeColumn : valueColumn} column`,
		);
	const counts = new Map<string, number>();
	for (const [index, row] of rows.entries()) {
		const area = row[code]?.trim();
		const count = Number(row[value]);
		if (!area || !Number.isFinite(count) || count < 0)
			throw new Error(
				`${input} row ${index + 2} has no usable ${codeColumn} and ${valueColumn}`,
			);
		if (counts.has(area)) throw new Error(`${input} counts ${area} twice`);
		counts.set(area, count);
	}
	return counts;
};

const censusTotal = (table: string) => {
	const found = CENSUS_SMALL_AREA_TABLES.find(
		(entry) => entry.table === table,
	);
	if (!found) throw new Error(`No census table ${table}`);
	return found.totalColumn;
};

export const readWeightUnits = (repositoryRoot: string): WeightUnits[] => [
	{
		basis: "population",
		...WEIGHT_UNIT_RELEASES.lsoa,
		totals: readCounts(
			repositoryRoot,
			WEIGHT_UNIT_INPUTS[0]!,
			"geography code",
			censusTotal("ts001"),
		),
	},
	{
		basis: "households",
		...WEIGHT_UNIT_RELEASES.lsoa,
		totals: readCounts(
			repositoryRoot,
			WEIGHT_UNIT_INPUTS[1]!,
			"geography code",
			censusTotal("ts003"),
		),
	},
	{
		basis: "population",
		...WEIGHT_UNIT_RELEASES.dataZone,
		totals: readCounts(
			repositoryRoot,
			WEIGHT_UNIT_INPUTS[2]!,
			"Data_Zone",
			"Total_population",
		),
	},
];
