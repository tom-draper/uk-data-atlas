import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { Gazetteer } from "../lib/data/gazetteer/gazetteer";
import type { GazetteerCore } from "../lib/data/gazetteer/types";
import type { PrecompiledBoundaryMappings } from "../lib/data/boundaries/mappings";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import { getProp } from "../lib/data/boundaries/properties";
import { aggregatePopulation } from "../lib/helpers/datasetAggregation/population";
const REGION_CHUNK_KEYS = [
	"E12000001",
	"E12000002",
	"E12000003",
	"E12000004",
	"E12000005",
	"E12000006",
	"E12000007",
	"E12000008",
	"E12000009",
	"Scotland",
	"Wales",
	"Northern Ireland",
] as const;
type RegionChunkKey = (typeof REGION_CHUNK_KEYS)[number];

type DatasetPayload = Record<
	string,
	{ data?: Record<string, unknown>; [key: string]: unknown }
>;

type LocalElectionRecord = {
	ladCode?: string;
	electorate?: number;
	totalVotes?: number;
	partyVotes?: Record<string, number | undefined>;
};

type PopulationRecord = {
	ladCode?: string;
	total?: Record<string, number>;
	males?: Record<string, number>;
	females?: Record<string, number>;
};

type BoundaryPropertiesFile = {
	features?: Record<string, unknown>[];
};

const CHUNKED_FILES = new Set(["population", "local-election"]);
const LOCAL_ELECTION_PARTIES = [
	"LAB",
	"CON",
	"LD",
	"GREEN",
	"REF",
	"IND",
	"DUP",
	"PC",
	"SNP",
	"SF",
	"APNI",
	"SDLP",
] as const;

const countryForCode = (code: string): RegionChunkKey | null => {
	if (code.startsWith("S")) return "Scotland";
	if (code.startsWith("W")) return "Wales";
	if (code.startsWith("N")) return "Northern Ireland";
	return null;
};

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

const regionForLad = (gazetteer: Gazetteer, code: string) => {
	const region = gazetteer
		.ancestors(code)
		.find((entry) => entry.level === "region")?.code;
	if (region && REGION_CHUNK_KEYS.includes(region as RegionChunkKey))
		return region as RegionChunkKey;
	return countryForCode(code);
};

const regionForRecord = (gazetteer: Gazetteer, record: unknown) => {
	if (!record || typeof record !== "object") return null;
	const ladCode = Reflect.get(record, "ladCode");
	return typeof ladCode === "string"
		? regionForLad(gazetteer, ladCode)
		: null;
};

const populationTotal = (record: unknown) => {
	if (!record || typeof record !== "object") return 0;
	const total = Reflect.get(record, "total");
	if (!total || typeof total !== "object") return 0;
	return Object.values(total as Record<string, unknown>).reduce<number>(
		(sum, value) => sum + (typeof value === "number" ? value : 0),
		0,
	);
};

const populationLocationSummary = (
	gazetteer: Gazetteer,
	payload: DatasetPayload,
) => {
	const byLad = new Map<string, number>();
	const countries: Record<string, number> = {
		"United Kingdom": 0,
		England: 0,
		Scotland: 5_479_900,
		Wales: 0,
		"Northern Ireland": 1_903_175,
	};

	for (const dataset of Object.values(payload)) {
		for (const [wardCode, record] of Object.entries(dataset.data ?? {})) {
			const population = populationTotal(record);
			countries["United Kingdom"] += population;
			if (wardCode.startsWith("E")) countries.England += population;
			else if (wardCode.startsWith("S")) countries.Scotland += population;
			else if (wardCode.startsWith("W")) countries.Wales += population;
			else if (wardCode.startsWith("N"))
				countries["Northern Ireland"] += population;

			const ladCode =
				record && typeof record === "object"
					? Reflect.get(record, "ladCode")
					: undefined;
			if (typeof ladCode === "string")
				byLad.set(ladCode, (byLad.get(ladCode) ?? 0) + population);
		}
	}

	return Object.fromEntries(
		gazetteer.namedLocations().map((location) => {
			if (location in countries) return [location, countries[location]!];
			const total = (
				gazetteer.namedLocation(location)?.memberCodes ?? []
			).reduce((sum, ladCode) => sum + (byLad.get(ladCode) ?? 0), 0);
			return [location, total];
		}),
	);
};

const locationMatchesRecord = (
	location: string,
	members: ReadonlySet<string>,
	code: string,
	record: { ladCode?: string },
	wardToLad: Record<string, string>,
) => {
	if (location === "United Kingdom") return true;
	const countryPrefix = COUNTRY_PREFIXES[location];
	if (countryPrefix) return code.startsWith(countryPrefix);
	return members.has(wardToLad[code] ?? record.ladCode ?? "");
};

const populationPropertiesPath = (root: string, boundaryYear: number) => {
	const asset = BOUNDARY_CATALOG.ward.propertyVintages[boundaryYear];
	if (!asset)
		throw new Error(
			`Population boundary year ${boundaryYear} has no ward properties asset`,
		);
	return join(root, "public", asset.split("?")[0]!.replace(/^\//, ""));
};

const populationLocationSummaries = async (
	root: string,
	gazetteer: Gazetteer,
	payload: DatasetPayload,
	wardToLad: Record<string, string>,
) =>
	Object.fromEntries(
		await Promise.all(
			Object.entries(payload).map(async ([datasetId, dataset]) => {
				const boundaryYear = dataset.boundaryYear;
				if (typeof boundaryYear !== "number") return [datasetId, {}];
				const properties = JSON.parse(
					await readFile(
						populationPropertiesPath(root, boundaryYear),
						"utf8",
					),
				) as BoundaryPropertiesFile;
				const codeProperty = "__populationCode";
				const features = (properties.features ?? []).flatMap(
					(properties, index) => {
						const code = getProp(
							properties,
							BOUNDARY_CATALOG.ward.properties.code,
						);
						return code
							? [
									{
										type: "Feature" as const,
										id: index,
										geometry: null,
										properties: {
											...properties,
											[codeProperty]: code,
										},
									},
								]
							: [];
					},
				);
				const featuresByCode = new Map(
					features.map((feature) => [
						Reflect.get(feature.properties, codeProperty) as string,
						feature,
					]),
				);
				const data = dataset.data ?? {};
				return [
					datasetId,
					Object.fromEntries(
						gazetteer.namedLocations().map((location) => {
							const members = new Set(
								gazetteer.namedLocation(location)
									?.memberCodes ?? [],
							);
							const selectedFeatures = Object.entries(
								data,
							).flatMap(([code, record]) =>
								locationMatchesRecord(
									location,
									members,
									code,
									(record ?? {}) as PopulationRecord,
									wardToLad,
								)
									? [featuresByCode.get(code)].filter(Boolean)
									: [],
							);
							return [
								location,
								aggregatePopulation(
									selectedFeatures as never,
									codeProperty as never,
									data as never,
								),
							];
						}),
					),
				];
			}),
		),
	);

const locationBelongsToRegion = (
	gazetteer: Gazetteer,
	location: string,
	region: RegionChunkKey,
) => {
	if (location === "United Kingdom") return true;
	const countryPrefix = COUNTRY_PREFIXES[location];
	if (countryPrefix)
		return countryPrefix === "E"
			? region.startsWith("E")
			: countryForCode(countryPrefix) === region;
	return (gazetteer.namedLocation(location)?.memberCodes ?? []).some(
		(code) => regionForLad(gazetteer, code) === region,
	);
};

const locationAggregatesForRegion = (
	gazetteer: Gazetteer,
	aggregates: Record<string, unknown>,
	region: RegionChunkKey,
) =>
	Object.fromEntries(
		Object.entries(aggregates).filter(([location]) =>
			locationBelongsToRegion(gazetteer, location, region),
		),
	);

const localElectionAggregate = (records: LocalElectionRecord[]) => {
	const partyVotes = Object.fromEntries(
		LOCAL_ELECTION_PARTIES.map((party) => [party, 0]),
	) as Record<string, number>;
	let electorate = 0;
	let totalVotes = 0;
	for (const record of records) {
		electorate += record.electorate ?? 0;
		totalVotes += record.totalVotes ?? 0;
		for (const party of LOCAL_ELECTION_PARTIES)
			partyVotes[party] += record.partyVotes?.[party] ?? 0;
	}
	return { partyVotes, electorate, totalVotes };
};

const localElectionLocationSummaries = (
	gazetteer: Gazetteer,
	payload: DatasetPayload,
) =>
	Object.fromEntries(
		Object.entries(payload).map(([datasetId, dataset]) => [
			datasetId,
			Object.fromEntries(
				gazetteer.namedLocations().map((location) => {
					const members = new Set(
						gazetteer.namedLocation(location)?.memberCodes ?? [],
					);
					const records = Object.values(dataset.data ?? {}).filter(
						(record) => {
							const ladCode = Reflect.get(record, "ladCode");
							if (typeof ladCode !== "string") return false;
							if (location === "United Kingdom") return true;
							const prefix = COUNTRY_PREFIXES[location];
							return prefix
								? ladCode.startsWith(prefix)
								: members.has(ladCode);
						},
					) as LocalElectionRecord[];
					return [location, localElectionAggregate(records)];
				}),
			),
		]),
	);

const writeAtomically = async (path: string, contents: string) => {
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

/** Build non-duplicating regional payloads for the large ward datasets. */
export async function writeDatasetRegionChunks({
	root,
	datasets,
	core,
	boundaryMappings,
}: {
	root: string;
	datasets: ReadonlyMap<string, unknown>;
	core: GazetteerCore;
	boundaryMappings?: Pick<PrecompiledBoundaryMappings, "wardToLad">;
}) {
	const gazetteer = new Gazetteer(core);
	const outDir = join(root, "data", "precompiled", "chunks");
	const publicDir = join(root, "public", "data", "precompiled", "chunks");

	for (const [file, value] of datasets) {
		if (!CHUNKED_FILES.has(file)) continue;
		const chunks = new Map<RegionChunkKey, DatasetPayload>();
		const locationPopulations =
			file === "population"
				? populationLocationSummary(gazetteer, value as DatasetPayload)
				: undefined;
		const locationAggregates =
			file === "population"
				? await populationLocationSummaries(
						root,
						gazetteer,
						value as DatasetPayload,
						boundaryMappings?.wardToLad ?? {},
					)
				: file === "local-election"
					? localElectionLocationSummaries(
							gazetteer,
							value as DatasetPayload,
						)
					: undefined;
		for (const region of REGION_CHUNK_KEYS) chunks.set(region, {});

		for (const [datasetId, dataset] of Object.entries(
			value as DatasetPayload,
		)) {
			if (!dataset.data) continue;
			const records = new Map<RegionChunkKey, Record<string, unknown>>();
			for (const [code, record] of Object.entries(dataset.data)) {
				const region = regionForRecord(gazetteer, record);
				if (!region) continue;
				const regionRecords = records.get(region) ?? {};
				regionRecords[code] = record;
				records.set(region, regionRecords);
			}
			for (const region of REGION_CHUNK_KEYS) {
				const data = records.get(region) ?? {};
				const regionalAggregates = locationAggregates?.[datasetId]
					? locationAggregatesForRegion(
							gazetteer,
							locationAggregates[datasetId] as Record<
								string,
								unknown
							>,
							region,
						)
					: undefined;
				chunks.get(region)![datasetId] = {
					...dataset,
					...(locationPopulations && { locationPopulations }),
					...(regionalAggregates && {
						locationAggregates: regionalAggregates,
					}),
					data,
				};
			}
		}

		await Promise.all(
			REGION_CHUNK_KEYS.map(async (region) => {
				const json = JSON.stringify(chunks.get(region));
				const relative = join(file, `${region}.json`);
				await Promise.all([
					writeAtomically(join(outDir, relative), json),
					writeAtomically(join(publicDir, relative), json),
				]);
			}),
		);
	}
}
