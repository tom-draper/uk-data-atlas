import { mkdir, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { Gazetteer } from "../lib/data/gazetteer/gazetteer";
import type { GazetteerCore } from "../lib/data/gazetteer/types";
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

const CHUNKED_FILES = new Set(["population", "local-election"]);

const countryForCode = (code: string): RegionChunkKey | null => {
	if (code.startsWith("S")) return "Scotland";
	if (code.startsWith("W")) return "Wales";
	if (code.startsWith("N")) return "Northern Ireland";
	return null;
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
}: {
	root: string;
	datasets: ReadonlyMap<string, unknown>;
	core: GazetteerCore;
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
			for (const [region, data] of records) {
				chunks.get(region)![datasetId] = {
					...dataset,
					...(locationPopulations && { locationPopulations }),
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
