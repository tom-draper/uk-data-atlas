import {
	createReadStream,
	readFileSync,
	readdirSync,
	existsSync,
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { csvFields, csvRecords } from "@uk-data-atlas/artifacts";
import { toWgs84Point } from "@uk-data-atlas/geography/coordinates";

/**
 * The atoms crosswalk weights are summed over: live, small-user postcodes with
 * a grid reference, and the few output areas that have people but no such
 * postcode. Each atom is a point with a measure on every basis.
 *
 * A basis's count is held for each 2021 output area (England and Wales:
 * Census 2021 residents and households) or 2022 output area (Scotland: Census
 * 2022 residents). It is shared equally between the output area's atoms, so
 * where an output area lies wholly inside both areas of a pair its whole count
 * lands in the pair, and where it straddles a border its count is split by its
 * postcodes. An output area with no atom becomes one atom at its population
 * weighted centroid. Dwellings are held for each LSOA only: an LSOA's count is
 * split between its output areas in proportion to their households, then
 * between their atoms.
 */
export const MEASURES = [
	"postcodes",
	"population",
	"households",
	"dwellings",
] as const;
export type Measure = (typeof MEASURES)[number];

export type WeightAtoms = {
	count: number;
	/** How many atoms are postcodes; the rest are output areas without one. */
	postcodes: number;
	longitude: Float64Array;
	latitude: Float64Array;
	measures: Record<Measure, Float64Array>;
	/** Per measure: the count held, and how much of it reached an atom. */
	totals: Record<Measure, { held: number; allocated: number }>;
};

export type OutputAreaCounts = {
	/** Residents by output area code. */
	population: ReadonlyMap<string, number>;
	households: ReadonlyMap<string, number>;
	/** Dwellings by LSOA code, and each output area's LSOA. */
	dwellings: ReadonlyMap<string, number>;
	lsoaOf: ReadonlyMap<string, string>;
	/** Population weighted centroids by output area code: [longitude, latitude]. */
	centroids: ReadonlyMap<string, readonly [number, number]>;
};

export type PostcodeRow = {
	postcode: string;
	terminated: boolean;
	largeUser: boolean;
	easting: number | undefined;
	northing: number | undefined;
	outputArea: string;
};

const sum = (values: Iterable<number>) => {
	let total = 0;
	for (const value of values) total += value;
	return total;
};

/** Build the atoms from counts and a stream of postcode rows (any order). */
export const buildWeightAtoms = async (
	counts: OutputAreaCounts,
	rows: AsyncIterable<PostcodeRow> | Iterable<PostcodeRow>,
	capacity: number,
): Promise<WeightAtoms> => {
	const index = new Map<string, number>();
	const codes: string[] = [];
	const at = (code: string) => {
		let found = index.get(code);
		if (found === undefined) {
			found = codes.length;
			index.set(code, found);
			codes.push(code);
		}
		return found;
	};
	for (const code of [
		...counts.population.keys(),
		...counts.households.keys(),
		...counts.lsoaOf.keys(),
	])
		at(code);
	let longitude = new Float64Array(capacity);
	let latitude = new Float64Array(capacity);
	let owner = new Int32Array(capacity);
	let used = 0;
	let areaAtoms = new Int32Array(Math.max(codes.length, 1));
	for await (const row of rows) {
		if (
			row.terminated ||
			row.largeUser ||
			row.easting === undefined ||
			row.northing === undefined ||
			row.outputArea === ""
		)
			continue;
		const area = at(row.outputArea);
		if (area >= areaAtoms.length) {
			const grown = new Int32Array(
				Math.max(area + 1, areaAtoms.length * 2),
			);
			grown.set(areaAtoms);
			areaAtoms = grown;
		}
		if (used === longitude.length) {
			const size = longitude.length * 2;
			for (const name of ["longitude", "latitude"] as const) {
				const grown = new Float64Array(size);
				grown.set(name === "longitude" ? longitude : latitude);
				if (name === "longitude") longitude = grown;
				else latitude = grown;
			}
			const grown = new Int32Array(size);
			grown.set(owner);
			owner = grown;
		}
		const [lng, lat] = toWgs84Point(
			[row.easting, row.northing],
			"EPSG:27700",
		).position;
		longitude[used] = lng;
		latitude[used] = lat;
		owner[used] = area;
		areaAtoms[area] += 1;
		used += 1;
	}
	const postcodes = used;

	// Households in an LSOA, to split its dwellings between its output areas.
	const lsoaHouseholds = new Map<string, number>();
	const lsoaAreas = new Map<string, number>();
	for (const [code, lsoa] of counts.lsoaOf) {
		lsoaHouseholds.set(
			lsoa,
			(lsoaHouseholds.get(lsoa) ?? 0) +
				(counts.households.get(code) ?? 0),
		);
		lsoaAreas.set(lsoa, (lsoaAreas.get(lsoa) ?? 0) + 1);
	}
	const dwellingsOf = (code: string) => {
		const lsoa = counts.lsoaOf.get(code);
		const total =
			lsoa === undefined ? undefined : counts.dwellings.get(lsoa);
		if (lsoa === undefined || total === undefined) return 0;
		const households = lsoaHouseholds.get(lsoa)!;
		return households > 0
			? (total * (counts.households.get(code) ?? 0)) / households
			: total / lsoaAreas.get(lsoa)!;
	};
	const value = (measure: Measure, code: string) =>
		measure === "population"
			? (counts.population.get(code) ?? 0)
			: measure === "households"
				? (counts.households.get(code) ?? 0)
				: measure === "dwellings"
					? dwellingsOf(code)
					: 0;

	// Output areas with something to share and no postcode become one atom.
	const orphans: number[] = [];
	for (const [code, area] of index)
		if (
			(areaAtoms[area] ?? 0) === 0 &&
			counts.centroids.has(code) &&
			(value("population", code) > 0 ||
				value("households", code) > 0 ||
				value("dwellings", code) > 0)
		)
			orphans.push(area);
	const count = postcodes + orphans.length;
	const result: WeightAtoms = {
		count,
		postcodes,
		longitude: longitude.slice(0, count),
		latitude: latitude.slice(0, count),
		measures: Object.fromEntries(
			MEASURES.map((name) => [name, new Float64Array(count)]),
		) as Record<Measure, Float64Array>,
		totals: Object.fromEntries(
			MEASURES.map((name) => [name, { held: 0, allocated: 0 }]),
		) as WeightAtoms["totals"],
	};
	result.measures.postcodes.fill(1, 0, postcodes);
	for (const measure of ["population", "households", "dwellings"] as const)
		for (let atom = 0; atom < postcodes; atom += 1) {
			const area = owner[atom]!;
			result.measures[measure][atom] =
				value(measure, codes[area]!) / areaAtoms[area]!;
		}
	for (const [position, area] of orphans.entries()) {
		const atom = postcodes + position;
		const [lng, lat] = counts.centroids.get(codes[area]!)!;
		result.longitude[atom] = lng;
		result.latitude[atom] = lat;
		for (const measure of [
			"population",
			"households",
			"dwellings",
		] as const)
			result.measures[measure][atom] = value(measure, codes[area]!);
	}
	result.totals.postcodes = { held: postcodes, allocated: postcodes };
	result.totals.population.held = sum(counts.population.values());
	result.totals.households.held = sum(counts.households.values());
	result.totals.dwellings.held = sum(counts.dwellings.values());
	for (const measure of ["population", "households", "dwellings"] as const)
		result.totals[measure].allocated = sum(result.measures[measure]);
	return result;
};

/** Counts by code from one column of a CSV whose first row names its columns. */
export const readColumn = (
	path: string,
	codeColumn: string,
	valueColumn: string,
	{
		skipUnusable = false,
		only,
	}: {
		skipUnusable?: boolean;
		/** Keep only rows whose `column` is `value`. */
		only?: { column: string; value: string };
	} = {},
) => {
	const [header, ...rows] = csvRecords(
		readFileSync(path, "utf8").replace(/^﻿/, ""),
	);
	const code = header?.indexOf(codeColumn) ?? -1;
	const value = header?.indexOf(valueColumn) ?? -1;
	if (code < 0 || value < 0)
		throw new Error(
			`${path} has no ${code < 0 ? codeColumn : valueColumn} column`,
		);
	const filter = only ? header!.indexOf(only.column) : -1;
	if (only && filter < 0)
		throw new Error(`${path} has no ${only.column} column`);
	const counts = new Map<string, number>();
	for (const [line, row] of rows.entries()) {
		if (only && row[filter] !== only.value) continue;
		const area = row[code]?.trim();
		const count = Number(row[value]);
		if (!area || !Number.isFinite(count) || count < 0) {
			// Suppressed counts are marked, for example "[c]".
			if (skipUnusable && area) continue;
			throw new Error(
				`${path} row ${line + 2} has no usable ${codeColumn} and ${valueColumn}`,
			);
		}
		if (counts.has(area)) throw new Error(`${path} counts ${area} twice`);
		counts.set(area, count);
	}
	return counts;
};

/** The latest edition of the ONS Postcode Directory under data/source. */
export const onspdEdition = (root: string) => {
	const directory = join(root, "data/source/postcodes/onspd");
	const edition = readdirSync(directory)
		.filter((name) => existsSync(join(directory, name, "meta.json")))
		.sort()
		.at(-1);
	if (!edition)
		throw new Error(`No ONS Postcode Directory under ${directory}`);
	return join(directory, edition);
};

/**
 * The postcodes of the permitted directory with their 2021 output areas, read
 * in lockstep from the two files, which hold the same rows in the same order.
 */
export async function* readPostcodeRows(
	directory: string,
): AsyncGenerator<PostcodeRow> {
	const lines = (path: string) =>
		createInterface({
			input: createReadStream(path).pipe(createGunzip()),
			crlfDelay: Infinity,
		})[Symbol.asyncIterator]();
	const permitted = lines(join(directory, "onspd-permitted.csv.gz"));
	const areas = lines(join(directory, "onspd-output-areas.csv.gz"));
	let columns: string[] | undefined;
	for (;;) {
		const [left, right] = await Promise.all([
			permitted.next(),
			areas.next(),
		]);
		if (left.done || right.done) {
			if (left.done !== right.done)
				throw new Error("The postcode files differ in length");
			return;
		}
		if (left.value === "" && right.value === "") continue;
		const fields = csvFields(left.value);
		const [postcode, outputArea] = csvFields(right.value);
		if (!columns) {
			columns = fields;
			if (postcode !== "pcds" || outputArea !== "oa21cd")
				throw new Error("The output area file has unexpected columns");
			continue;
		}
		const at = (name: string) => fields[columns!.indexOf(name)]!;
		if (at("pcds") !== postcode)
			throw new Error(`The postcode files disagree at ${at("pcds")}`);
		const east = at("east1m");
		const north = at("north1m");
		yield {
			postcode: postcode!,
			terminated: at("doterm") !== "",
			largeUser: at("usrtypind") === "1",
			easting: east === "" ? undefined : Number(east),
			northing: north === "" ? undefined : Number(north),
			outputArea: outputArea!,
		};
	}
}
