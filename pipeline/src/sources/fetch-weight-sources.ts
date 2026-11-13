import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { readDbfRecords } from "@uk-data-atlas/shapefile";
import { toWgs84Point } from "@uk-data-atlas/geography";
import { sha256Hex } from "../lib/hash.ts";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonSync } from "../lib/json.ts";
import { sourceDir } from "@uk-data-atlas/datasets";

/**
 * Download the small-area counts that crosswalk weights share between
 * postcodes (see pipeline/src/crosswalk-weights), each kept as published:
 *
 * - Census 2021 usual residents (TS001) and households (TS003) of every
 *   England and Wales output area, from the Nomis bulk download;
 * - the 2021 output areas' population weighted centroids (ONS Open Geography,
 *   V4), as longitude and latitude;
 * - Scotland's Census 2022 usual residents of every output area, with the 2022
 *   output areas' population weighted centroids (National Records of
 *   Scotland), converted from the British National Grid;
 * - Council Tax: stock of properties 2026 (HM Revenue and Customs, Valuation
 *   Office Agency), table CTSOP1.1: dwellings by LSOA.
 *
 * Each source folder gets the `meta.json` every source under data/ carries.
 * Northern Ireland has no source here.
 */

const OGL = {
	name: "Open Government Licence v3.0",
	url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
};
const NOMIS = "https://www.nomisweb.co.uk/output/census/2021";
const PWC_SERVICE =
	"https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/OA_December_2021_EW_PWC_V4/FeatureServer/0";
const NRS = "https://www.nrscotland.gov.uk";
const NRS_POPULATION = `${NRS}/media/owpknvgk/outputarea2022_usualresidentpopulation.csv`;
const NRS_HOUSEHOLDS =
	"https://ukds-ckan.s3.eu-west-1.amazonaws.com/2022/NRS/UV406/census_2022_UV406_Household_size_OA.csv";
const NRS_CENTROIDS = `${NRS}/media/gm4dvdsv/output-area-2022-pwc.zip`;
const CTSOP =
	"https://assets.publishing.service.gov.uk/media/6ab25147a9c3d267bcccecc1/CTSOP_1_1.zip";

export const WEIGHT_SOURCE_FILES = {
	residentsEw: sourceDir("census-2021-ts001", "census2021-ts001-oa.csv"),
	householdsEw: sourceDir("census-2021-ts003", "census2021-ts003-oa.csv"),
	centroidsEw: sourceDir(
		"population-weighted-centroids",
		"oa-2021-ew-v4/oa-2021-ew-pwc.csv",
	),
	residentsSc: sourceDir(
		"census-2022-scotland-output-area",
		"outputarea2022_usualresidentpopulation.csv",
	),
	householdsSc: sourceDir(
		"census-2022-scotland-output-area",
		"census_2022_UV406_Household_size_OA.csv",
	),
	centroidsSc: sourceDir(
		"population-weighted-centroids",
		"oa-2022-sc/oa-2022-sc-pwc.csv",
	),
	dwellingsEw: sourceDir("council-tax-stock", "2026/CTSOP1_1_2026_03_31.csv"),
	postcodeOutputAreas: "postcodes/onspd/<edition>/onspd-output-areas.csv.gz",
} as const;

const download = async (url: string) => {
	const response = await fetch(url, {
		headers: { "User-Agent": "Mozilla/5.0" },
	});
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText} for ${url}`);
	return Buffer.from(await response.arrayBuffer());
};

const unzipMember = (archive: Buffer, member: string) => {
	const directory = mkdtempSync(join(tmpdir(), "atlas-weight-source-"));
	try {
		const path = join(directory, "archive.zip");
		writeFileSync(path, archive);
		return execFileSync("unzip", ["-p", path, member], {
			maxBuffer: 1 << 30,
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

const write = (root: string, path: string, content: string | Buffer) => {
	const target = join(root, "data/source", path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content);
	return sha256Hex(content);
};

const writeMeta = (root: string, directory: string, meta: object) =>
	write(
		root,
		join(directory, "meta.json"),
		`${JSON.stringify(meta, null, "\t")}\n`,
	);

/** Add a file to a table folder's existing meta.json, replacing an earlier entry. */
const addCensusFile = (
	root: string,
	directory: string,
	file: Record<string, string>,
) => {
	const path = join(root, "data/source", directory, "meta.json");
	const meta = readJsonSync(path) as {
		files: Array<Record<string, string>>;
	};
	meta.files = [
		...meta.files.filter((entry) => entry.path !== file.path),
		file,
	];
	writeFileSync(path, `${JSON.stringify(meta, null, "\t")}\n`);
};

/** The point records of a point shapefile as [x, y], in file order. */
const readPoints = (shp: Buffer) => {
	const points: Array<[number, number]> = [];
	let at = 100;
	while (at + 8 <= shp.length) {
		const length = shp.readInt32BE(at + 4) * 2;
		const type = shp.readInt32LE(at + 8);
		if (type !== 1) throw new Error(`Shape type ${type} is not a point`);
		points.push([shp.readDoubleLE(at + 12), shp.readDoubleLE(at + 20)]);
		at += 8 + length;
	}
	return points;
};

const fetchCensusOutputAreas = async (root: string, retrieved: string) => {
	for (const [table, key, title, description] of [
		[
			"ts001",
			"residentsEw",
			"Census 2021 usual residents by residence type",
			"",
		],
		["ts003", "householdsEw", "Census 2021 household composition", ""],
	] as const) {
		const archive = await download(`${NOMIS}/census2021-${table}.zip`);
		const csv = unzipMember(archive, `census2021-${table}-oa.csv`);
		const path = WEIGHT_SOURCE_FILES[key];
		const hash = write(root, path, csv);
		addCensusFile(root, dirname(path), {
			path: `census2021-${table}-oa.csv`,
			role: "source",
			sha256: hash,
			note: `188,880 2021 output areas. The OA file from the Nomis bulk download ${NOMIS}/census2021-${table}.zip, unchanged, retrieved ${retrieved}. ${title}${description}`,
		});
	}
};

const fetchEnglandWalesCentroids = async (root: string, retrieved: string) => {
	const rows = ["OA21CD,longitude,latitude"];
	for (let offset = 0; ; offset += 2000) {
		const query = new URLSearchParams({
			where: "1=1",
			outFields: "OA21CD",
			outSR: "4326",
			orderByFields: "OA21CD",
			resultOffset: String(offset),
			resultRecordCount: "2000",
			f: "json",
		});
		const response = await fetch(`${PWC_SERVICE}/query?${query}`);
		if (!response.ok)
			throw new Error(`${response.status} for ${PWC_SERVICE}`);
		const page = (await response.json()) as {
			features?: Array<{
				attributes: { OA21CD: string };
				geometry: { x: number; y: number };
			}>;
		};
		if (!page.features)
			throw new Error("The centroid service gave no features");
		for (const { attributes, geometry } of page.features)
			rows.push(`${attributes.OA21CD},${geometry.x},${geometry.y}`);
		if (page.features.length < 2000) break;
	}
	const path = WEIGHT_SOURCE_FILES.centroidsEw;
	const hash = write(root, path, `${rows.join("\n")}\n`);
	writeMeta(root, dirname(path), {
		id: "oa-2021-ew-v4",
		title: "Output Areas (December 2021) EW Population Weighted Centroids (V4)",
		description:
			"The population weighted centroid of every 2021 output area in England and Wales, as WGS 84 longitude and latitude.",
		topics: ["geography", "census"],
		publisher: "Office for National Statistics",
		sourceUrl: PWC_SERVICE,
		retrieved,
		temporalCoverage: "2021",
		spatialCoverage: {
			geography: "outputArea",
			vintage: 2021,
			countries: ["GB-ENG", "GB-WLS"],
		},
		licence: {
			...OGL,
			note: "Contains OS data © Crown copyright and database right. The ONS Open Geography Portal licence is https://www.ons.gov.uk/methodology/geography/licences.",
		},
		attribution: [
			"Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
			"Contains OS data © Crown copyright and database right",
		],
		files: [
			{
				path: "oa-2021-ew-pwc.csv",
				role: "source",
				sha256: hash,
				note: `${rows.length - 1} centroids queried from the feature service with outSR=4326, one row per OA21CD.`,
			},
		],
	});
	return rows.length - 1;
};

const fetchScotland = async (root: string, retrieved: string) => {
	const population = await download(NRS_POPULATION);
	const populationPath = WEIGHT_SOURCE_FILES.residentsSc;
	const populationHash = write(root, populationPath, population);
	const householdsHash = write(
		root,
		WEIGHT_SOURCE_FILES.householdsSc,
		await download(NRS_HOUSEHOLDS),
	);
	writeMeta(root, dirname(populationPath), {
		id: "census-2022-scotland-output-area",
		title: "Scotland's Census 2022 output area usual residents and households",
		description:
			"The usual resident population and the number of occupied household spaces (households, UV406 household size) of every 2022 output area in Scotland.",
		topics: ["demographics", "population", "census", "scotland"],
		publisher: "National Records of Scotland",
		sourceUrl:
			"https://www.nrscotland.gov.uk/publications/2022-census-geography-products",
		retrieved,
		temporalCoverage: "2022",
		spatialCoverage: {
			geography: "outputArea",
			vintage: 2022,
			countries: ["GB-SCT"],
		},
		licence: OGL,
		attribution: [
			"Source: National Records of Scotland. © Crown copyright",
		],
		files: [
			{
				path: "outputarea2022_usualresidentpopulation.csv",
				role: "source",
				sha256: populationHash,
				note: `${NRS_POPULATION}, unchanged.`,
			},
			{
				path: "census_2022_UV406_Household_size_OA.csv",
				role: "source",
				sha256: householdsHash,
				note: `Table UV406, household size, for 2022 output areas, as published by National Records of Scotland and mirrored by the UK Data Service: ${NRS_HOUSEHOLDS}, unchanged. The first column after the code is all occupied household spaces, the households; "-" is zero.`,
			},
		],
	});
	const archive = await download(NRS_CENTROIDS);
	const base = "OutputArea2022_PWC/OutputArea2022_PWC";
	const points = readPoints(unzipMember(archive, `${base}.shp`));
	const directory = mkdtempSync(join(tmpdir(), "atlas-nrs-centroids-"));
	let codes: Array<Record<string, string>>;
	try {
		writeFileSync(
			join(directory, "oa.dbf"),
			unzipMember(archive, `${base}.dbf`),
		);
		codes = readDbfRecords(join(directory, "oa.dbf"));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
	if (codes.length !== points.length)
		throw new Error("The centroid shapefile and table differ in length");
	const field = Object.keys(codes[0] ?? {}).find((name) =>
		/^(OutputArea2022|OA22CD|code)$/i.test(name),
	);
	if (!field) throw new Error("The centroid table has no output area code");
	const rows = ["OA22CD,longitude,latitude"];
	for (const [index, [x, y]] of points.entries()) {
		const [longitude, latitude] = toWgs84Point(
			[x, y],
			"EPSG:27700",
		).position;
		rows.push(`${codes[index]![field]},${longitude},${latitude}`);
	}
	const path = WEIGHT_SOURCE_FILES.centroidsSc;
	const hash = write(root, path, `${rows.join("\n")}\n`);
	writeMeta(root, dirname(path), {
		id: "oa-2022-sc",
		title: "Output Area 2022 Population Weighted Centroids (Scotland)",
		description:
			"The population weighted centroid of every 2022 output area in Scotland, as WGS 84 longitude and latitude.",
		topics: ["geography", "census", "scotland"],
		publisher: "National Records of Scotland",
		sourceUrl:
			"https://www.nrscotland.gov.uk/publications/2022-census-geography-products",
		retrieved,
		temporalCoverage: "2022",
		spatialCoverage: {
			geography: "outputArea",
			vintage: 2022,
			countries: ["GB-SCT"],
		},
		licence: OGL,
		attribution: [
			"Source: National Records of Scotland. © Crown copyright",
		],
		files: [
			{
				path: "oa-2022-sc-pwc.csv",
				role: "source",
				sha256: hash,
				note: `${rows.length - 1} centroids read from ${NRS_CENTROIDS} (British National Grid) and converted to WGS 84.`,
			},
		],
	});
	return rows.length - 1;
};

const fetchDwellings = async (root: string, retrieved: string) => {
	const archive = await download(CTSOP);
	const csv = unzipMember(archive, "CTSOP_1_1/CTSOP1_1_2026_03_31.csv");
	const path = WEIGHT_SOURCE_FILES.dwellingsEw;
	const hash = write(root, path, csv);
	writeMeta(root, dirname(path), {
		id: "2026",
		title: "Council Tax: stock of properties 2026, CTSOP1.1",
		description:
			"Properties on the Council Tax valuation list in England and Wales at 31 March 2026, by Council Tax band, local authority, LSOA and MSOA. Counts are rounded to the nearest 10 and small counts are suppressed.",
		topics: ["housing"],
		publisher: "Valuation Office Agency",
		sourceUrl:
			"https://www.gov.uk/government/statistics/council-tax-stock-of-properties-2026",
		retrieved,
		temporalCoverage: "2026-03-31",
		spatialCoverage: {
			geography: "lsoa",
			vintage: 2021,
			countries: ["GB-ENG", "GB-WLS"],
		},
		licence: OGL,
		attribution: [
			"Source: Valuation Office Agency licensed under the Open Government Licence v.3.0",
		],
		files: [
			{
				path: "CTSOP1_1_2026_03_31.csv",
				role: "source",
				sha256: hash,
				note: `CTSOP_1_1/CTSOP1_1_2026_03_31.csv from ${CTSOP}, unchanged.`,
			},
		],
	});
};

export const fetchWeightSources = async (
	root: string,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	await fetchCensusOutputAreas(root, retrieved);
	const centroids = await fetchEnglandWalesCentroids(root, retrieved);
	const scottish = await fetchScotland(root, retrieved);
	await fetchDwellings(root, retrieved);
	return { centroids, scottish };
};

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const root = resolve(dirname(scriptPath), "../../..");
	if (!existsSync(join(root, "data/source", sourceDir("census-2021-ts001"))))
		throw new Error("Restore data/source first: pnpm data:download");
	const result = await fetchWeightSources(root);
	buildLog.info(
		`Fetched weight sources into ${repoPath(join(root, "data/source"))}: ${result.centroids} and ${result.scottish} output area centroids`,
	);
}
