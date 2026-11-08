import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csvRecords } from "@uk-data-atlas/artifacts";
import {
	buildWeightAtoms,
	onspdEdition,
	readColumn,
	readPostcodeRows,
	type OutputAreaCounts,
	type WeightAtoms,
} from "./atoms.ts";

/**
 * The held counts, centroids and postcodes the atoms are made of, read from
 * data/source. Every stage that needs atoms reads them here, so each builds
 * the same ones.
 */

const OUTPUT_AREA_LSOA_LOOKUP =
	"lookups/output-area-to-lsoa/2021-12-ew/OA_LSOA_MSOA_EW_DEC_2021_LU_v3.geojson";

/**
 * Households of each Scottish output area from table UV406: the first column
 * after the code is all occupied household spaces, and "-" is zero.
 */
export const readScottishHouseholds = (path: string) => {
	const rows = csvRecords(readFileSync(path, "utf8").replace(/^﻿/, ""));
	const header = rows.findIndex(
		(row) => row[0] === "" && row[1] === "All occupied household spaces",
	);
	if (header < 0) throw new Error(`${path} has no household size table`);
	const households = new Map<string, number>();
	for (const row of rows.slice(header + 1)) {
		const code = row[0]?.trim();
		// Notes follow the table.
		if (!code || !/^S\d{8}$/.test(code)) continue;
		const count = row[1] === "-" ? 0 : Number(row[1]);
		if (!Number.isFinite(count) || count < 0)
			throw new Error(`${path} has no usable count for ${code}`);
		if (households.has(code))
			throw new Error(`${path} counts ${code} twice`);
		households.set(code, count);
	}
	return households;
};

export const readOutputAreaCounts = (root: string): OutputAreaCounts => {
	const source = (path: string) => join(root, "data/source", path);
	const census = (table: string, column: string) =>
		readColumn(
			source(
				`demographics/census-2021-small-area/${table}/census2021-${table}-oa.csv`,
			),
			"geography code",
			column,
		);
	const scotland = "demographics/population/census-2022-scotland-output-area";
	const population = census(
		"ts001",
		"Residence type: Total; measures: Value",
	);
	const households = census(
		"ts003",
		"Household composition: Total; measures: Value",
	);
	for (const [code, count] of readColumn(
		source(`${scotland}/outputarea2022_usualresidentpopulation.csv`),
		"OutputArea2022",
		"UsualResidentPopulation",
	))
		population.set(code, count);
	for (const [code, count] of readScottishHouseholds(
		source(`${scotland}/census_2022_UV406_Household_size_OA.csv`),
	))
		households.set(code, count);
	const centroids = new Map<string, readonly [number, number]>();
	for (const [path, column] of [
		[
			"geography/population-weighted-centroids/oa-2021-ew-v4/oa-2021-ew-pwc.csv",
			"OA21CD",
		],
		[
			"geography/population-weighted-centroids/oa-2022-sc/oa-2022-sc-pwc.csv",
			"OA22CD",
		],
	] as const) {
		const lines = readFileSync(source(path), "utf8").trim().split("\n");
		if (lines[0] !== `${column},longitude,latitude`)
			throw new Error(`${path} has unexpected columns`);
		for (const line of lines.slice(1)) {
			const [code, longitude, latitude] = line.split(",");
			centroids.set(code!, [Number(longitude), Number(latitude)]);
		}
	}
	const lookup = JSON.parse(
		readFileSync(source(OUTPUT_AREA_LSOA_LOOKUP), "utf8"),
	) as {
		features: Array<{ properties: { OA21CD: string; LSOA21CD: string } }>;
	};
	const lsoaOf = new Map(
		lookup.features.map(({ properties }) => [
			properties.OA21CD,
			properties.LSOA21CD,
		]),
	);
	if (lsoaOf.size === 0)
		throw new Error("No output area to LSOA lookup to split dwellings by");
	return {
		population,
		households,
		dwellings: readColumn(
			source("housing/council-tax-stock/2026/CTSOP1_1_2026_03_31.csv"),
			"ecode",
			"all_properties",
			{
				skipUnusable: true,
				only: { column: "geography", value: "LSOA" },
			},
		),
		lsoaOf,
		centroids,
	};
};

export const readWeightAtoms = (root: string): Promise<WeightAtoms> =>
	buildWeightAtoms(
		readOutputAreaCounts(root),
		readPostcodeRows(onspdEdition(root)),
		2_800_000,
	);
