import type { BoundaryGeojson } from "@lib/types";
import type { BoundaryType } from "./boundaries";
import { BOUNDARY_CATALOG } from "./catalog";
import { localDataPath } from "./dataPath";
import { decodeBoundaryData } from "./decode";
import { areasLadFromGeometry } from "./wardLadGeometry";
import type { LsoaLadMapping } from "./lsoaLadMappings";

type BoundaryGroup = Record<number, BoundaryGeojson>;

async function loadBoundaryFile(
	read: (path: string) => Promise<string>,
	path: string,
): Promise<BoundaryGeojson> {
	return decodeBoundaryData(JSON.parse(await read(localDataPath(path))));
}

async function loadBoundaryGroup(
	read: (path: string) => Promise<string>,
	type: Extract<
		BoundaryType,
		"ward" | "constituency" | "localAuthority" | "lsoa"
	>,
): Promise<BoundaryGroup> {
	const paths = BOUNDARY_CATALOG[type].vintages;
	const entries = await Promise.all(
		Object.entries(paths).map(
			async ([year, path]) =>
				[Number(year), await loadBoundaryFile(read, path)] as const,
		),
	);
	return Object.fromEntries(entries);
}

/**
 * LSOA releases do not publish their local-authority parent in boundary
 * properties. Resolve it once from the release geometry and the current LAD
 * boundaries, then ship a small lookup rather than use named-location boxes.
 */
export async function loadLsoaLadMappings(
	read: (path: string) => Promise<string>,
): Promise<Record<number, LsoaLadMapping>> {
	const [lsoas, localAuthorities] = await Promise.all([
		loadBoundaryGroup(read, "lsoa"),
		loadBoundaryGroup(read, "localAuthority"),
	]);
	const newestLocalAuthorities =
		localAuthorities[
			Math.max(...Object.keys(localAuthorities).map(Number))
		];

	const lsoaToLad = Object.fromEntries(
		Object.entries(lsoas).map(([year, lsoa]) => [
			Number(year),
			areasLadFromGeometry(
				lsoa.features,
				BOUNDARY_CATALOG.lsoa.properties.code,
				newestLocalAuthorities.features,
				BOUNDARY_CATALOG.localAuthority.properties.code,
				() => true,
			),
		]),
	) as Record<number, Record<string, string>>;
	for (const [year, lsoa] of Object.entries(lsoas)) {
		const resolved = Object.keys(lsoaToLad[Number(year)] ?? {}).length;
		if (resolved !== lsoa.features.length) {
			throw new Error(
				`LSOA ${year}: resolved ${resolved}/${lsoa.features.length} local-authority parents`,
			);
		}
	}

	return Object.fromEntries(
		Object.entries(lsoaToLad).map(([year, mapping]) => [
			Number(year),
			{ version: 1, year: Number(year), lsoaToLad: mapping },
		]),
	);
}
