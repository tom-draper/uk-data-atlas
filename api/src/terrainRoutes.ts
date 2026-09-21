import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import {
	TerrainRemoteError,
	type TerrainInterpolation,
} from "./terrainProvider";

const parseNumber = (value: string | null) => {
	if (value === null || value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const handleElevationPoint = ({
	context,
	releaseId,
	parsedUrl,
}: RouteRequest): ApiResponse => {
	const x = parseNumber(parsedUrl.searchParams.get("x"));
	const y = parseNumber(parsedUrl.searchParams.get("y"));
	if (x === undefined || y === undefined)
		return problem(
			400,
			"Invalid Terrain Point",
			"x and y must be finite EPSG:27700 coordinates.",
		);
	const interpolation =
		parsedUrl.searchParams.get("interpolation") ?? "bilinear";
	if (interpolation !== "bilinear" && interpolation !== "nearest")
		return problem(
			400,
			"Invalid Interpolation",
			"interpolation must be bilinear or nearest.",
		);
	const provider = context.terrainProvider;
	if (!provider)
		return problem(
			503,
			"Terrain Data Unavailable",
			"No versioned terrain source has been installed for this environment.",
		);
	const result = provider.point(x, y, {
		interpolation: interpolation as TerrainInterpolation,
		version: parsedUrl.searchParams.get("version") ?? undefined,
	});
	if (!result)
		return problem(
			404,
			"Terrain Version Not Found",
			"No terrain source matches the requested version.",
		);
	return { status: 200, body: envelope(releaseId, result) };
};

export const handleTerrainRoutesAsync = async ({
	context,
	releaseId,
	segments,
	parsedUrl,
}: RouteRequest): Promise<ApiResponse | undefined> => {
	if (segments[0] !== "v1" || segments[1] !== "terrain") return undefined;
	if (
		segments[2] !== "elevation" ||
		segments[3] !== "point" ||
		segments.length !== 4
	)
		return handleTerrainRoutes({
			context,
			releaseId,
			segments,
			parsedUrl,
			dispatch: () => {
				throw new Error("Terrain point dispatch is not supported.");
			},
		});
	const x = parseNumber(parsedUrl.searchParams.get("x"));
	const y = parseNumber(parsedUrl.searchParams.get("y"));
	if (x === undefined || y === undefined)
		return problem(
			400,
			"Invalid Terrain Point",
			"x and y must be finite EPSG:27700 coordinates.",
		);
	const interpolation =
		parsedUrl.searchParams.get("interpolation") ?? "bilinear";
	if (interpolation !== "bilinear" && interpolation !== "nearest")
		return problem(
			400,
			"Invalid Interpolation",
			"interpolation must be bilinear or nearest.",
		);
	const provider = context.terrainAsyncProvider;
	if (!provider)
		return handleTerrainRoutes({
			context,
			releaseId,
			segments,
			parsedUrl,
			dispatch: () => {
				throw new Error("Terrain point dispatch is not supported.");
			},
		});
	let result;
	try {
		result = await provider.point(x, y, {
			interpolation: interpolation as TerrainInterpolation,
			version: parsedUrl.searchParams.get("version") ?? undefined,
		});
	} catch (error) {
		if (error instanceof TerrainRemoteError)
			return problem(
				503,
				"Terrain Upstream Unavailable",
				"The remote terrain provider could not answer this point.",
			);
		throw error;
	}
	if (!result)
		return problem(
			404,
			"Terrain Version Not Found",
			"No terrain source matches the requested version.",
		);
	return { status: 200, body: envelope(releaseId, result) };
};

/** Versioned terrain-product discovery. Values and tiles arrive in a later product. */
export const handleTerrainRoutes = ({
	context,
	releaseId,
	segments,
	parsedUrl,
}: RouteRequest): ApiResponse | undefined => {
	if (segments[0] !== "v1" || segments[1] !== "terrain") return undefined;
	if (
		segments[2] === "elevation" &&
		segments[3] === "point" &&
		segments.length === 4
	)
		return handleElevationPoint({
			context,
			releaseId,
			segments,
			parsedUrl,
			dispatch: () => {
				throw new Error("Terrain point dispatch is not supported.");
			},
		});
	const catalogue = context.terrainCatalogue;
	if (!catalogue)
		return problem(
			503,
			"Terrain Catalogue Unavailable",
			"Build the terrain catalogue before discovering terrain products.",
		);
	if (segments.length === 2)
		return { status: 200, body: envelope(releaseId, catalogue) };
	if (segments.length === 3) {
		const product = catalogue.products.find(
			(candidate) => candidate.id === segments[2],
		);
		return product
			? { status: 200, body: envelope(releaseId, product) }
			: problem(404, "Not Found", "No terrain product matches that id.");
	}
	return undefined;
};
