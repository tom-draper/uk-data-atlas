import {
	chmodSync,
	closeSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashFile } from "../../../shared/fileHashCache";
import {
	ONS_BOUNDARY_SOURCES,
	type OnsBoundarySource,
} from "./onsBoundarySources";

const SERVICES =
	"https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const queryUrl = (layer: string, parameters: Record<string, string>) => {
	const url = new URL(`${layer}/query`);
	url.search = new URLSearchParams({
		where: "1=1",
		...parameters,
	}).toString();
	return url;
};

export const fetchOnsBoundary = async ({
	repositoryRoot,
	source,
	fetcher = fetch,
	retrieved = new Date().toISOString().slice(0, 10),
	attempts = 4,
	retryDelay = 2_000,
}: {
	repositoryRoot: string;
	source: OnsBoundarySource;
	fetcher?: typeof fetch;
	retrieved?: string;
	attempts?: number;
	retryDelay?: number;
}) => {
	if (!/^[a-zA-Z0-9-]+$/.test(source.release))
		throw new Error("Invalid boundary release directory.");
	const layer = `${SERVICES}/${source.service}/FeatureServer/0`;
	// The publisher's service drops the odd connection, so retry dropped,
	// timed-out and server-error requests before giving up.
	const request = async (url: URL | string) => {
		for (let attempt = 1; ; attempt++) {
			const retry = attempt < attempts;
			try {
				const response = await fetcher(url, {
					signal: AbortSignal.timeout(60_000),
				});
				if (
					!retry ||
					(response.status < 500 && response.status !== 429)
				)
					return response;
				await response.body?.cancel();
			} catch (error) {
				if (!retry) throw error;
			}
			await new Promise((done) => setTimeout(done, retryDelay * attempt));
		}
	};
	const read = async (url: URL | string) => {
		const response = await request(url);
		if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
		const value: unknown = await response.json();
		if (!isRecord(value) || "error" in value)
			throw new Error(
				`${url}: invalid ArcGIS response ${JSON.stringify(value)}`,
			);
		return value;
	};
	const metadata = await read(`${layer}?f=json`);
	if (metadata.geometryType !== "esriGeometryPolygon")
		throw new Error(
			`${source.service}: expected a polygon boundary layer.`,
		);
	const objectId = metadata.objectIdField;
	if (
		typeof objectId !== "string" ||
		!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(objectId)
	)
		throw new Error(`${source.service}: no valid object ID field.`);
	const maximum = metadata.maxRecordCount;
	if (
		typeof maximum !== "number" ||
		!Number.isSafeInteger(maximum) ||
		maximum < 1
	)
		throw new Error(`${source.service}: no valid page size.`);
	const pageSize = Math.min(1000, maximum);
	const countUrl = queryUrl(layer, { returnCountOnly: "true", f: "json" });
	const count = (await read(countUrl)).count;
	if (count !== source.count)
		throw new Error(
			`${source.service}: expected ${source.count} areas, received ${count}.`,
		);
	const download = async (path: string) => {
		const descriptor = openSync(path, "wx");
		const codes = new Set<string>();
		try {
			writeFileSync(
				descriptor,
				'{"type":"FeatureCollection","features":[',
			);
			for (let offset = 0; offset < source.count; offset += pageSize) {
				const page = await read(
					queryUrl(layer, {
						outFields: "*",
						outSR: "4326",
						orderByFields: objectId,
						resultOffset: String(offset),
						resultRecordCount: String(pageSize),
						f: "geojson",
					}),
				);
				if (
					page.type !== "FeatureCollection" ||
					!Array.isArray(page.features) ||
					page.features.length !==
						Math.min(pageSize, source.count - offset)
				)
					throw new Error(
						`${source.service}: incomplete boundary page at ${offset}.`,
					);
				for (const feature of page.features) {
					if (
						!isRecord(feature) ||
						feature.type !== "Feature" ||
						!isRecord(feature.properties)
					)
						throw new Error(
							`${source.service}: invalid boundary feature at ${offset}.`,
						);
					const code = feature.properties[source.codeProperty];
					const name = feature.properties[source.nameProperty];
					if (
						typeof code !== "string" ||
						!code ||
						typeof name !== "string" ||
						!name
					)
						throw new Error(
							`${source.service}: missing boundary code or name.`,
						);
					if (codes.has(code))
						throw new Error(
							`${source.service}: duplicate boundary code ${code}.`,
						);
					const geometry = feature.geometry;
					if (
						!isRecord(geometry) ||
						!["Polygon", "MultiPolygon"].includes(
							String(geometry.type),
						) ||
						!Array.isArray(geometry.coordinates) ||
						geometry.coordinates.length === 0
					)
						throw new Error(
							`${source.service}: missing polygon geometry for ${code}.`,
						);
					codes.add(code);
				}
				writeFileSync(
					descriptor,
					`${offset ? "," : ""}${JSON.stringify(page.features).slice(1, -1)}`,
				);
			}
			writeFileSync(descriptor, "]}");
		} finally {
			closeSync(descriptor);
		}
		return hashFile(path);
	};
	const geographyDirectory = source.geography
		.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase();
	const parent = join(
		repositoryRoot,
		"data/source",
		"boundaries",
		geographyDirectory,
	);
	const directory = join(parent, source.release);
	const path = join(directory, "source.geojson");
	const sourceUrl = `https://www.arcgis.com/home/item.html?id=${source.itemId}`;
	mkdirSync(parent, { recursive: true });
	const staging = mkdtempSync(join(parent, `.${source.release}-`));
	try {
		const contentHash = await download(join(staging, "source.geojson"));
		if (contentHash !== source.contentHash)
			throw new Error(
				`${source.service}: publisher geometry changed; expected ${source.contentHash}, received ${contentHash}. Review the source before updating its pinned hash.`,
			);
		if ((await read(countUrl)).count !== source.count)
			throw new Error(
				`${source.service}: publisher count changed during download.`,
			);
		const finalMetadata = await read(`${layer}?f=json`);
		if (
			JSON.stringify(metadata.editingInfo) !==
			JSON.stringify(finalMetadata.editingInfo)
		)
			throw new Error(
				`${source.service}: publisher revision changed during download.`,
			);
		if (existsSync(directory)) {
			if (!existsSync(join(directory, "meta.json")))
				throw new Error(
					`${directory} already exists without source metadata; use a new release directory.`,
				);
			const previous: unknown = JSON.parse(
				readFileSync(join(directory, "meta.json"), "utf8"),
			);
			if (
				!isRecord(previous) ||
				previous.sourceUrl !== sourceUrl ||
				hashFile(path) !== contentHash
			)
				throw new Error(
					`${directory} already exists with different source bytes or provenance; use a new release directory.`,
				);
			return { path, count: source.count, contentHash };
		}
		writeFileSync(
			join(staging, "meta.json"),
			`${JSON.stringify(
				{
					id: source.release,
					kind: "boundary",
					title: source.title,
					description: source.title,
					topics: ["boundaries", "geography"],
					publisher: "Office for National Statistics",
					publisherRevision: metadata.editingInfo,
					sourceUrl,
					retrieved,
					temporalCoverage: source.release.slice(0, 7),
					spatialCoverage: {
						geography: source.geography,
						countries: source.countries,
					},
					licence: {
						name: "Open Government Licence v3.0",
						url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
					},
					attribution: "Office for National Statistics",
					files: [
						{
							path: "source.geojson",
							role: "source",
							sha256: contentHash.slice("sha256:".length),
							note: `Exported from ${layer}/query, ordered by ${objectId}, with outFields=*, outSR=4326 and f=geojson. ${source.count} polygon features. Coordinates are preserved without repairs.`,
						},
					],
				},
				null,
				"\t",
			)}\n`,
		);
		chmodSync(staging, 0o755);
		renameSync(staging, directory);
		return { path, count: source.count, contentHash };
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const requested = process.argv.slice(2);
	const key = (source: OnsBoundarySource) =>
		`${source.geography}/${source.release}`;
	if (requested.length === 0)
		throw new Error(
			`Choose one or more boundary releases: ${ONS_BOUNDARY_SOURCES.map(key).join(", ")}`,
		);
	for (const target of requested)
		if (!ONS_BOUNDARY_SOURCES.some((source) => key(source) === target))
			throw new Error(`Unknown ONS boundary release ${target}.`);
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	for (const source of ONS_BOUNDARY_SOURCES.filter((source) =>
		requested.includes(key(source)),
	)) {
		const result = await fetchOnsBoundary({ repositoryRoot, source });
		console.log(
			`Wrote ${result.count} areas to ${result.path} (${result.contentHash})`,
		);
	}
}
