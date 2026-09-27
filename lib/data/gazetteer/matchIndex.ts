/**
 * Builds the upload match index (docs/gazetteer-design.md, 9.1): per boundary
 * level and vintage, its codes, every code behind each lowercased name, and
 * the parents that tell same-named areas apart. Upload matching reads it
 * instead of boundary geometry, so a CSV can be matched against every
 * geography the atlas serves without loading any of it.
 *
 * Built by precompile, straight after the boundary mappings it takes ward
 * parents from, so it cannot fall behind the boundary catalogue.
 */
import {
	compactMatchIndexLevel,
	type CompactMatchIndexLevel,
	type MatchIndex,
} from "../areaBank";
import { BOUNDARY_CATALOG, BOUNDARY_TYPES } from "../boundaries/catalog";
import { localDataPath } from "../boundaries/dataPath";
import { decodeBoundaryData } from "../boundaries/decode";
import { getProp } from "../boundaries/properties";

export type CompactMatchIndex = Record<string, CompactMatchIndexLevel>;

/**
 * @param wardToLad The precompiled ward -> LAD map. Ward releases from
 * December 2017 to 2021 publish no local authority; this fills those gaps.
 */
export async function loadMatchIndex(
	read: (path: string) => Promise<string>,
	wardToLad: Record<string, string>,
): Promise<CompactMatchIndex> {
	const index: MatchIndex = {};
	// Every geography the catalogue serves, so a new one is matchable as soon
	// as it has a release. One file at a time: together they are large.
	for (const boundaryType of BOUNDARY_TYPES) {
		const { vintages, properties } = BOUNDARY_CATALOG[boundaryType];
		const parentKeys = (properties as { parentCode?: readonly string[] })
			.parentCode;
		for (const [year, path] of Object.entries(
			vintages as Record<number, string>,
		)) {
			const { features } = decodeBoundaryData(
				JSON.parse(await read(localDataPath(path))),
			);
			const codes = new Set<string>();
			const names: Record<string, string[]> = {};
			const parentOf: Record<string, string> = {};
			for (const feature of features) {
				const code = getProp(feature.properties, properties.code);
				if (!code) continue;
				codes.add(code);
				const name = getProp(feature.properties, properties.name);
				if (name) {
					const nameCodes = (names[name.toLowerCase()] ??= []);
					if (!nameCodes.includes(code)) nameCodes.push(code);
				}
				const parent =
					(parentKeys && getProp(feature.properties, parentKeys)) ||
					(boundaryType === "ward" && wardToLad[code]);
				if (parent) parentOf[code] = parent;
			}
			// Parents only matter where a name is shared, so ship only those.
			const parents: Record<string, string[]> = {};
			for (const nameCodes of Object.values(names))
				if (nameCodes.length > 1)
					for (const code of nameCodes)
						if (parentOf[code]) parents[code] = [parentOf[code]];
			(index[boundaryType] ??= {})[Number(year)] = {
				codes: [...codes],
				names,
				...(Object.keys(parents).length > 0 && { parents }),
			};
		}
	}
	return Object.fromEntries(
		Object.entries(index).map(([boundaryType, byYear]) => [
			boundaryType,
			compactMatchIndexLevel(byYear),
		]),
	);
}
