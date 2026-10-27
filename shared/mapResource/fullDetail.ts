import type { AreaGeometryCache } from "../areaGeometry";
import { sha256 } from "../contentHash";
import { releaseKey } from "../geographyKeys";
import type { GeometryTier } from "@uk-data-atlas/map-tiles/simplifyGeometry";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import { packedBounds, type PackedGeometry } from "../packedGeometry";
import { writeParquet, writeParquetAsync, type ParquetTable } from "../parquet";
import { geoParquetTable, packedWkb, type GeoParquetRow } from "./geoParquet";

/** Positions in a packed geometry. */
const positionsIn = (packed: PackedGeometry): number =>
	packed.kind === "packed"
		? packed.positions.length / packed.stride
		: packed.kind === "collection"
			? packed.geometries.reduce(
					(sum, part) => sum + positionsIn(part),
					0,
				)
			: 0;

/**
 * A release's `full` tier, which is its areas exactly as the geometry store
 * holds them. It is not stored as a file: the store already holds the same
 * coordinates, so the download is built from it when asked for. The build
 * makes it once too, to publish its size and hash.
 */

/** The tiers published as GeoJSON as well as GeoParquet. */
export const GEOJSON_TIERS: readonly GeometryTier[] = ["medium", "low"];

export type FullDetailRelease = {
	geography: string;
	boundaryRelease: string;
	/** The attribution the file carries, as the descriptor states it. */
	attribution: string;
	/** `shared-arc` for a tiled release, `none` for one that is not a coverage. */
	topology: "shared-arc" | "none";
};

export type FullDetailDownload = {
	body: Buffer;
	rowCount: number;
	coordinates: number;
	contentHash: string;
};

/** Areas written between yields, so a server keeps answering meanwhile. */
const AREAS_PER_STEP = 4096;

/**
 * The full-detail GeoParquet of a release, as a table, a step at a time.
 * `names` limits it to the release's own areas, as the tiles are limited,
 * and labels them; the ids are the ones the tiles and join tables use.
 */
function* fullDetailTable(
	cache: AreaGeometryCache,
	release: FullDetailRelease,
	names: Map<string, string>,
): Generator<
	void,
	{ table: ParquetTable; rowCount: number; coordinates: number } | undefined
> {
	const { geography, boundaryRelease } = release;
	const codes = cache
		.codes(geography, boundaryRelease)
		.filter((code) => names.size === 0 || names.has(code));
	const numbered = featureIds(codes);
	let coordinates = 0;
	const rows: GeoParquetRow[] = [];
	for (const [index, code] of codes.entries()) {
		if (index > 0 && index % AREAS_PER_STEP === 0) yield;
		const packed = cache.packed(geography, boundaryRelease, code);
		const shape = packed && packedWkb(packed);
		const bbox = shape && packedBounds(packed);
		if (!shape || !bbox) continue;
		coordinates += positionsIn(packed);
		rows.push({
			id: numbered.get(code)!,
			code,
			name: names.get(code) ?? code,
			type: shape.type,
			wkb: shape.wkb,
			bbox,
		});
	}
	if (rows.length === 0) return undefined;
	const table = geoParquetTable(rows, {
		mapResource: releaseKey(geography, boundaryRelease),
		tier: "full",
		toleranceM: 0,
		topology: release.topology,
		attribution: release.attribution,
		geometrySourceInputHash:
			cache.provenance(geography, boundaryRelease).inputHash ?? null,
	});
	return { table, rowCount: rows.length, coordinates };
}

/** The full-detail GeoParquet of a release, as the build publishes it. */
export const buildFullDetailParquet = (
	cache: AreaGeometryCache,
	release: FullDetailRelease,
	names: Map<string, string>,
): FullDetailDownload | undefined => {
	const steps = fullDetailTable(cache, release, names);
	let step = steps.next();
	while (!step.done) step = steps.next();
	if (!step.value) return undefined;
	const { table, ...counts } = step.value;
	const body = writeParquet(table);
	return { body, ...counts, contentHash: sha256(body) };
};

/**
 * The same file, built without holding up a server for long: the areas are
 * read a batch at a time, and compression and hashing run off the main
 * thread.
 */
export const buildFullDetailParquetAsync = async (
	cache: AreaGeometryCache,
	release: FullDetailRelease,
	names: Map<string, string>,
): Promise<FullDetailDownload | undefined> => {
	const steps = fullDetailTable(cache, release, names);
	let step = steps.next();
	while (!step.done) {
		await new Promise((resolve) => setImmediate(resolve));
		step = steps.next();
	}
	if (!step.value) return undefined;
	const { table, ...counts } = step.value;
	const body = await writeParquetAsync(table);
	const digest = Buffer.from(
		await crypto.subtle.digest("SHA-256", body as Uint8Array<ArrayBuffer>),
	);
	return { body, ...counts, contentHash: `sha256:${digest.toString("hex")}` };
};
