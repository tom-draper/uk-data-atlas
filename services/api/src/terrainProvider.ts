import { createHash } from "node:crypto";

export type TerrainInterpolation = "nearest" | "bilinear";
export type TerrainPointStatus = "ok" | "outside_coverage" | "nodata";

export type TerrainSourceMetadata = {
	id: string;
	version: string;
	provenance?: "local" | "remote-preview";
	/** Immutable hash of the source tile bytes or canonical sample values. */
	tileHash: string;
	contentHash: string;
	crs: "EPSG:27700";
	horizontalDatum: "OSGB36";
	horizontalTransformation?: "OSTN15";
	verticalDatum: "ODN";
	verticalModel?: "OSGM15";
	resolutionMetres: number;
	noData: number | null;
	uncertainty: {
		metric: "rmse" | "stated_accuracy";
		valueMetres: number;
	};
	coverage: {
		kind: "bbox";
		bbox: [number, number, number, number];
		footprintHash: string;
	};
};

export type TerrainPointResult = {
	status: TerrainPointStatus;
	x: number;
	y: number;
	interpolation: TerrainInterpolation;
	unit: "metres";
	value: number | null;
	source: TerrainSourceMetadata;
};

export type TerrainRaster = TerrainSourceMetadata & {
	width: number;
	height: number;
	origin: { x: number; y: number };
	values: readonly (number | null)[];
};

export type TerrainDerivativeKind =
	"slope" | "aspect" | "hillshade" | "contours";

export type TerrainDerivativeVersion = {
	id: string;
	version: string;
	kind: TerrainDerivativeKind;
	inputSourceId: string;
	inputSourceVersion: string;
	inputTileHash: string;
	method: string;
	parameters: Record<string, number | string | boolean>;
	contentHash: string;
};

export type TerrainRasterValidation = {
	valid: boolean;
	errors: string[];
};

export type TerrainProvider = {
	getSource: (version?: string) => TerrainRaster | undefined;
	point: (
		x: number,
		y: number,
		options?: { interpolation?: TerrainInterpolation; version?: string },
	) => TerrainPointResult | undefined;
};

export type AsyncTerrainProvider = {
	point: (
		x: number,
		y: number,
		options?: { interpolation?: TerrainInterpolation; version?: string },
	) => Promise<TerrainPointResult | undefined>;
};

export class TerrainRemoteError extends Error {
	readonly cause?: unknown;

	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "TerrainRemoteError";
		this.cause = cause;
	}
}

const hash = (value: string) =>
	`sha256:${createHash("sha256").update(value).digest("hex")}`;

const sourceMetadata = (
	values: readonly (number | null)[],
): TerrainSourceMetadata => ({
	id: "fixture-england-lidar-dtm",
	version: "2026-01-fixture",
	tileHash: hash(JSON.stringify(values)),
	contentHash: hash(JSON.stringify(values)),
	crs: "EPSG:27700",
	horizontalDatum: "OSGB36",
	horizontalTransformation: "OSTN15",
	verticalDatum: "ODN",
	verticalModel: "OSGM15",
	resolutionMetres: 10,
	noData: null,
	uncertainty: { metric: "rmse", valueMetres: 0.15 },
	coverage: {
		kind: "bbox",
		bbox: [100, 200, 130, 230],
		footprintHash: hash("bbox:100,200,130,230"),
	},
});

export const validateTerrainRaster = (
	raster: TerrainRaster,
): TerrainRasterValidation => {
	const errors: string[] = [];
	if (!raster.id || !raster.version)
		errors.push("source id and version are required");
	if (!/^sha256:[a-f0-9]{64}$/.test(raster.tileHash))
		errors.push("tileHash must be a sha256 digest");
	if (!/^sha256:[a-f0-9]{64}$/.test(raster.contentHash))
		errors.push("contentHash must be a sha256 digest");
	if (raster.crs !== "EPSG:27700")
		errors.push("terrain rasters must use EPSG:27700");
	if (raster.verticalDatum !== "ODN")
		errors.push("terrain rasters must declare ODN");
	if (!(raster.resolutionMetres > 0))
		errors.push("resolution must be positive");
	if (!Number.isInteger(raster.width) || raster.width < 1)
		errors.push("width must be a positive integer");
	if (!Number.isInteger(raster.height) || raster.height < 1)
		errors.push("height must be a positive integer");
	if (raster.values.length !== raster.width * raster.height)
		errors.push("value count must equal width multiplied by height");
	const [minX, minY, maxX, maxY] = raster.coverage.bbox;
	if (!(minX < maxX && minY < maxY))
		errors.push("coverage bbox must have positive area");
	if (!(raster.uncertainty.valueMetres >= 0))
		errors.push("uncertainty must be non-negative");
	return { valid: errors.length === 0, errors };
};

const coordinate = (raster: TerrainRaster, x: number, y: number) => ({
	x: (x - raster.origin.x) / raster.resolutionMetres - 0.5,
	y: (y - raster.origin.y) / raster.resolutionMetres - 0.5,
});

const cell = (raster: TerrainRaster, column: number, row: number) => {
	if (
		column < 0 ||
		row < 0 ||
		column >= raster.width ||
		row >= raster.height
	) {
		return undefined;
	}
	return raster.values[row * raster.width + column];
};

const nearest = (raster: TerrainRaster, x: number, y: number) => {
	const coordinateValue = coordinate(raster, x, y);
	return cell(
		raster,
		Math.round(coordinateValue.x),
		Math.round(coordinateValue.y),
	);
};

const bilinear = (raster: TerrainRaster, x: number, y: number) => {
	const coordinateValue = coordinate(raster, x, y);
	const x0 = Math.floor(coordinateValue.x);
	const y0 = Math.floor(coordinateValue.y);
	const xFraction = coordinateValue.x - x0;
	const yFraction = coordinateValue.y - y0;
	const values = [
		cell(raster, x0, y0),
		cell(raster, x0 + 1, y0),
		cell(raster, x0, y0 + 1),
		cell(raster, x0 + 1, y0 + 1),
	];
	if (values.some((value) => value === undefined || value === null))
		return null;
	const [southWest, southEast, northWest, northEast] = values as number[];
	return (
		southWest * (1 - xFraction) * (1 - yFraction) +
		southEast * xFraction * (1 - yFraction) +
		northWest * (1 - xFraction) * yFraction +
		northEast * xFraction * yFraction
	);
};

export const createTerrainProvider = (
	rasters: readonly TerrainRaster[],
): TerrainProvider => {
	for (const raster of rasters) {
		const validation = validateTerrainRaster(raster);
		if (!validation.valid)
			throw new Error(
				`Invalid terrain raster: ${validation.errors.join("; ")}`,
			);
	}
	const getSource = (version?: string) =>
		rasters.find(
			(raster) => version === undefined || raster.version === version,
		);

	return {
		getSource,
		point: (x, y, options = {}) => {
			const raster = getSource(options.version);
			if (!raster) return undefined;
			const [minX, minY, maxX, maxY] = raster.coverage.bbox;
			if (x < minX || x > maxX || y < minY || y > maxY) {
				return {
					status: "outside_coverage",
					x,
					y,
					interpolation: options.interpolation ?? "bilinear",
					unit: "metres",
					value: null,
					source: raster,
				};
			}
			const interpolation = options.interpolation ?? "bilinear";
			const value =
				interpolation === "nearest"
					? nearest(raster, x, y)
					: bilinear(raster, x, y);
			return {
				status: value === null || value === undefined ? "nodata" : "ok",
				x,
				y,
				interpolation,
				unit: "metres",
				value: value ?? null,
				source: raster,
			};
		},
	};
};

/** A tiny deterministic fixture; no external terrain data is required. */
export const createSyntheticTerrainProvider = (
	values: readonly (number | null)[] = [10, 20, 30, 20, 30, 40, 30, 40, 50],
) => {
	const metadata = sourceMetadata(values);
	return createTerrainProvider([
		{
			...metadata,
			width: 3,
			height: 3,
			origin: { x: 100, y: 200 },
			values,
		},
	]);
};

export type RemoteTerrainProviderOptions = {
	/** ArcGIS ImageServer getSamples endpoint; no response is persisted. */
	endpoint: string;
	/** Optional ArcGIS FeatureServer query endpoint for exact coverage polygons. */
	coverageEndpoint?: string;
	source: Omit<TerrainSourceMetadata, "tileHash" | "contentHash">;
	fetcher?: typeof fetch;
	timeoutMs?: number;
	maxConcurrent?: number;
};

/**
 * Remote preview adapter for the EA elevation service. It requests one sample
 * at a time and keeps no raster or response cache. The service is mutable, so
 * the returned hash identifies the response, not a publishable local tile.
 */
export const createRemoteTerrainProvider = ({
	endpoint,
	coverageEndpoint,
	source,
	fetcher = fetch,
	timeoutMs = 5000,
	maxConcurrent = 4,
}: RemoteTerrainProviderOptions): AsyncTerrainProvider => {
	if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
		throw new Error("maxConcurrent must be a positive integer.");
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
		throw new Error("timeoutMs must be positive.");
	let active = 0;
	const waiters: Array<() => void> = [];
	const acquire = async () => {
		if (active < maxConcurrent) {
			active += 1;
			return;
		}
		await new Promise<void>((resolve) => waiters.push(resolve));
		active += 1;
	};
	const release = () => {
		active -= 1;
		waiters.shift()?.();
	};
	const requestJson = async (url: URL) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetcher(url, { signal: controller.signal });
			if (!response.ok)
				throw new TerrainRemoteError(
					`Remote terrain request failed (${response.status}).`,
				);
			return (await response.json()) as {
				samples?: Array<{
					value?: number | number[];
					values?: number[];
				}>;
				features?: unknown[];
				error?: { message?: string };
			};
		} catch (error) {
			if (error instanceof TerrainRemoteError) throw error;
			throw new TerrainRemoteError(
				"The remote terrain service did not respond in time or returned invalid JSON.",
				error,
			);
		} finally {
			clearTimeout(timeout);
		}
	};

	return {
		point: async (x, y, options = {}) => {
			const [minX, minY, maxX, maxY] = source.coverage.bbox;
			if (x < minX || x > maxX || y < minY || y > maxY) {
				return {
					status: "outside_coverage",
					x,
					y,
					interpolation: options.interpolation ?? "bilinear",
					unit: "metres",
					value: null,
					source: {
						...source,
						tileHash: hash(`outside:${x}:${y}`),
						contentHash: hash(endpoint),
					},
				};
			}
			await acquire();
			try {
				if (coverageEndpoint) {
					const coverageUrl = new URL(coverageEndpoint);
					coverageUrl.searchParams.set(
						"geometry",
						JSON.stringify({
							x,
							y,
							spatialReference: { wkid: 27700 },
						}),
					);
					coverageUrl.searchParams.set(
						"geometryType",
						"esriGeometryPoint",
					);
					coverageUrl.searchParams.set(
						"spatialRel",
						"esriSpatialRelIntersects",
					);
					coverageUrl.searchParams.set("returnGeometry", "false");
					coverageUrl.searchParams.set("f", "json");
					const coverage = await requestJson(coverageUrl);
					if (coverage.error)
						throw new TerrainRemoteError(
							coverage.error.message ??
								"Remote coverage query failed.",
						);
					if (!coverage.features?.length)
						return {
							status: "outside_coverage",
							x,
							y,
							interpolation: options.interpolation ?? "bilinear",
							unit: "metres",
							value: null,
							source: {
								...source,
								tileHash: hash(`outside:${x}:${y}`),
								contentHash: hash(endpoint),
							},
						};
				}
				const url = new URL(endpoint);
				url.searchParams.set(
					"geometry",
					JSON.stringify({ x, y, spatialReference: { wkid: 27700 } }),
				);
				url.searchParams.set("geometryType", "esriGeometryPoint");
				url.searchParams.set("returnFirstValueOnly", "true");
				url.searchParams.set(
					"interpolation",
					options.interpolation === "nearest"
						? "RSP_NearestNeighbor"
						: "RSP_BilinearInterpolation",
				);
				url.searchParams.set("f", "json");
				const payload = await requestJson(url);
				if (payload.error)
					throw new TerrainRemoteError(
						payload.error.message ??
							"Remote terrain service returned an error.",
					);
				const sample = payload.samples?.[0];
				const rawValue = sample?.value ?? sample?.values?.[0];
				const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
				const resultSource = {
					...source,
					tileHash: hash(JSON.stringify(payload)),
					contentHash: hash(endpoint),
				};
				return {
					status:
						value === undefined || value === source.noData
							? "nodata"
							: "ok",
					x,
					y,
					interpolation: options.interpolation ?? "bilinear",
					unit: "metres",
					value: value ?? null,
					source: resultSource,
				};
			} finally {
				release();
			}
		},
	};
};
