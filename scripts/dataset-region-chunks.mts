import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { Gazetteer } from "../lib/data/gazetteer/gazetteer";
import type { GazetteerCore } from "../lib/data/gazetteer/types";
import type { PrecompiledBoundaryMappings } from "@uk-data-atlas/geography";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import { getProp } from "../lib/data/boundaries/properties";
import {
	codeKeyedFieldsFor,
	type DatasetPayloadLayout,
} from "../lib/data/catalog/types";
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

type BoundaryPropertiesFile = {
	features?: Record<string, unknown>[];
};

type CompiledDataset = {
	data: unknown;
	layout?: DatasetPayloadLayout;
};

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
	"OTHER",
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

const ladCodeForRecord = (
	record: unknown,
	code: string,
	wardToLad: Record<string, string> = {},
) => {
	if (!record || typeof record !== "object") return null;
	const ladCode = Reflect.get(record, "ladCode");
	return typeof ladCode === "string" && ladCode !== "Unknown"
		? ladCode
		: (wardToLad[code] ?? null);
};

const regionForRecord = (
	gazetteer: Gazetteer,
	record: unknown,
	code: string,
	wardToLad?: Record<string, string>,
) => {
	const ladCode = ladCodeForRecord(record, code, wardToLad);
	return ladCode ? regionForLad(gazetteer, ladCode) : null;
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

/**
 * Each place's population, for ordering the atlas's Locations list. Council
 * estimates cover the whole UK, where the ward data covers England and Wales,
 * so a council missing from them falls back to its wards' sum.
 */
const populationLocationSummary = (
	gazetteer: Gazetteer,
	payload: DatasetPayload,
	councilPopulations: ReadonlyMap<string, number>,
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

	if (councilPopulations.size > 0) {
		for (const country of Object.keys(countries)) countries[country] = 0;
		for (const [ladCode, population] of councilPopulations) {
			countries["United Kingdom"] += population;
			const country = COUNTRY_BY_PREFIX[ladCode[0]!];
			if (country) countries[country] += population;
		}
	}

	return Object.fromEntries(
		gazetteer.places().map((location) => {
			if (location in countries) return [location, countries[location]!];
			const total = (
				gazetteer.namedLocation(location)?.memberCodes ?? []
			).reduce(
				(sum, ladCode) =>
					sum +
					(councilPopulations.get(ladCode) ??
						byLad.get(ladCode) ??
						0),
				0,
			);
			return [location, total];
		}),
	);
};

const COUNTRY_BY_PREFIX: Readonly<Record<string, string>> = {
	E: "England",
	S: "Scotland",
	W: "Wales",
	N: "Northern Ireland",
};

/** Council populations from the latest UK-wide estimates, by council code. */
const readCouncilPopulations = async (root: string) => {
	const editions = JSON.parse(
		await readFile(
			join(root, "public", "data", "datasets", "population-uk.json"),
			"utf8",
		),
	) as Record<
		string,
		{ data: Record<string, { total: Record<string, number> }> }
	>;
	const latest = Object.keys(editions).sort().at(-1);
	const populations = new Map<string, number>();
	for (const [code, record] of Object.entries(
		latest ? editions[latest]!.data : {},
	))
		populations.set(
			code,
			Object.values(record.total).reduce((sum, value) => sum + value, 0),
		);
	return populations;
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
) => {
	const locations = gazetteer.places();
	const locationsByLad = new Map<string, Set<string>>();
	for (const location of locations) {
		if (location === "United Kingdom" || location in COUNTRY_PREFIXES)
			continue;
		for (const ladCode of gazetteer.namedLocation(location)?.memberCodes ??
			[]) {
			const matches = locationsByLad.get(ladCode) ?? new Set<string>();
			matches.add(location);
			locationsByLad.set(ladCode, matches);
		}
	}

	const featuresForBoundary = new Map<
		number,
		Promise<Map<string, Record<string, unknown>>>
	>();
	const featureMapFor = (boundaryYear: number) => {
		let result = featuresForBoundary.get(boundaryYear);
		if (!result) {
			result = readFile(
				populationPropertiesPath(root, boundaryYear),
				"utf8",
			).then((raw) => {
				const properties = JSON.parse(raw) as BoundaryPropertiesFile;
				return new Map(
					(properties.features ?? []).flatMap((feature, index) => {
						const code = getProp(
							feature,
							BOUNDARY_CATALOG.ward.properties.code,
						);
						return code
							? [
									[
										code,
										{
											type: "Feature" as const,
											id: index,
											geometry: null,
											properties: {
												...feature,
												__populationCode: code,
											},
										},
									],
								]
							: [];
					}),
				);
			});
			featuresForBoundary.set(boundaryYear, result);
		}
		return result;
	};

	return Object.fromEntries(
		await Promise.all(
			Object.entries(payload).map(async ([datasetId, dataset]) => {
				const boundaryYear = dataset.boundaryYear;
				if (typeof boundaryYear !== "number") return [datasetId, {}];
				const featuresByCode = await featureMapFor(boundaryYear);
				const featuresByLocation = new Map(
					locations.map((location) => [location, [] as unknown[]]),
				);
				const data = dataset.data ?? {};
				for (const [code, record] of Object.entries(data)) {
					const feature = featuresByCode.get(code);
					if (!feature) continue;
					featuresByLocation.get("United Kingdom")?.push(feature);
					for (const [country, prefix] of Object.entries(
						COUNTRY_PREFIXES,
					))
						if (code.startsWith(prefix))
							featuresByLocation.get(country)?.push(feature);
					const ladCode =
						wardToLad[code] ??
						(record && typeof record === "object"
							? Reflect.get(record, "ladCode")
							: undefined);
					if (typeof ladCode !== "string") continue;
					for (const location of locationsByLad.get(ladCode) ?? [])
						featuresByLocation.get(location)?.push(feature);
				}
				return [
					datasetId,
					Object.fromEntries(
						locations.map((location) => [
							location,
							aggregatePopulation(
								featuresByLocation.get(location) as never,
								"__populationCode" as never,
								data as never,
							),
						]),
					),
				];
			}),
		),
	);
};

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
	wardToLad: Record<string, string>,
) => {
	const locations = gazetteer.places();
	const locationsByLad = new Map<string, Set<string>>();
	for (const location of locations) {
		if (location === "United Kingdom" || location in COUNTRY_PREFIXES)
			continue;
		for (const ladCode of gazetteer.namedLocation(location)?.memberCodes ??
			[]) {
			const matches = locationsByLad.get(ladCode) ?? new Set<string>();
			matches.add(location);
			locationsByLad.set(ladCode, matches);
		}
	}

	return Object.fromEntries(
		Object.entries(payload).map(([datasetId, dataset]) => {
			const recordsByLocation = new Map(
				locations.map((location) => [
					location,
					[] as LocalElectionRecord[],
				]),
			);
			for (const [code, record] of Object.entries(dataset.data ?? {})) {
				const ladCode = ladCodeForRecord(record, code, wardToLad);
				if (!ladCode) continue;
				const electionRecord = record as LocalElectionRecord;
				recordsByLocation.get("United Kingdom")?.push(electionRecord);
				for (const [country, prefix] of Object.entries(
					COUNTRY_PREFIXES,
				))
					if (ladCode.startsWith(prefix))
						recordsByLocation.get(country)?.push(electionRecord);
				for (const location of locationsByLad.get(ladCode) ?? [])
					recordsByLocation.get(location)?.push(electionRecord);
			}
			return [
				datasetId,
				Object.fromEntries(
					locations.map((location) => [
						location,
						localElectionAggregate(
							recordsByLocation.get(location) ?? [],
						),
					]),
				),
			];
		}),
	);
};

const writeAtomically = async (path: string, contents: string) => {
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

/** Build non-duplicating regional payloads for datasets that opt into chunks. */
export async function writeDatasetRegionChunks({
	root,
	datasets,
	core,
	boundaryMappings,
}: {
	root: string;
	datasets: ReadonlyMap<string, CompiledDataset>;
	core: GazetteerCore;
	boundaryMappings?: Pick<PrecompiledBoundaryMappings, "wardToLad">;
}) {
	const gazetteer = new Gazetteer(core);
	const outDir = join(root, "public", "data", "datasets", "chunks");

	for (const [file, compiled] of datasets) {
		const chunkLayout = compiled.layout?.regionChunks;
		if (!chunkLayout || chunkLayout.kind !== "regional") continue;
		const value = compiled.data as DatasetPayload;
		const locationPopulations = chunkLayout.populationSummary
			? populationLocationSummary(
					gazetteer,
					value,
					await readCouncilPopulations(root),
				)
			: undefined;
		const locationAggregates =
			chunkLayout.locationAggregate === "population"
				? await populationLocationSummaries(
						root,
						gazetteer,
						value,
						boundaryMappings?.wardToLad ?? {},
					)
				: chunkLayout.locationAggregate === "localElection"
					? localElectionLocationSummaries(
							gazetteer,
							value,
							boundaryMappings?.wardToLad ?? {},
						)
					: undefined;

		// Keep each record in precisely one partition. The chunk metadata and JSON
		// strings are built per region below, so twelve full output objects never
		// need to coexist in memory.
		const recordsByDataset = new Map<
			string,
			Map<RegionChunkKey, Record<string, unknown>>
		>();
		for (const [datasetId, dataset] of Object.entries(value)) {
			if (!dataset.data) continue;
			const records = new Map<RegionChunkKey, Record<string, unknown>>();
			for (const [code, record] of Object.entries(dataset.data)) {
				const region = regionForRecord(
					gazetteer,
					record,
					code,
					chunkLayout.wardToLadFallback
						? (boundaryMappings?.wardToLad ?? {})
						: undefined,
				);
				if (!region) continue;
				const regionRecords = records.get(region) ?? {};
				regionRecords[code] = record;
				records.set(region, regionRecords);
			}
			recordsByDataset.set(datasetId, records);
		}

		for (const region of REGION_CHUNK_KEYS) {
			const chunk: DatasetPayload = {};
			for (const [datasetId, dataset] of Object.entries(value)) {
				if (!dataset.data) continue;
				const data = recordsByDataset.get(datasetId)?.get(region) ?? {};
				const codeKeyedFields = Object.fromEntries(
					codeKeyedFieldsFor(compiled.layout).flatMap((field) => {
						if (field === "data") return [];
						const values = dataset[field];
						if (
							!values ||
							typeof values !== "object" ||
							Array.isArray(values)
						)
							return [];
						return [
							[
								field,
								Object.fromEntries(
									Object.entries(values).filter(
										([code]) => code in data,
									),
								),
							],
						];
					}),
				);
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
				chunk[datasetId] = {
					...dataset,
					...(locationPopulations && { locationPopulations }),
					...(regionalAggregates && {
						locationAggregates: regionalAggregates,
					}),
					...codeKeyedFields,
					data,
				};
			}

			const json = JSON.stringify(chunk);
			const relative = join(file, `${region}.json`);
			await writeAtomically(join(outDir, relative), json);
		}
	}
}
