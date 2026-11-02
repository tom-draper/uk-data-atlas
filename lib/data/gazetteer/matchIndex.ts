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
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
	propertiesAsset,
} from "../boundaries/catalog";
import { localDataPath } from "@uk-data-atlas/datasets/data/boundaries/dataPath";
import { getProp } from "@uk-data-atlas/datasets/data/boundaries/properties";

export type CompactMatchIndex = Record<string, CompactMatchIndexLevel>;

/**
 * @param wardToLad The precompiled ward -> LAD map. Ward releases from
 * December 2017 to 2021 publish no local authority; this fills those gaps.
 * @param parishToLad Each parish release's local authorities, by parish
 * release year, as the geography resolver places them: parish releases
 * publish no parent.
 */
export async function loadMatchIndex(
	read: (path: string) => Promise<string>,
	wardToLad: Record<string, string>,
	parishToLad: Record<number, Record<string, string>>,
): Promise<CompactMatchIndex> {
	const index: MatchIndex = {};
	// Matching needs the required sidecar, never polygon coordinates.
	const propertiesOf = async (path: string) =>
		(
			JSON.parse(await read(localDataPath(propertiesAsset(path)))) as {
				features: Record<string, unknown>[];
			}
		).features;
	// Every geography the catalogue serves, so a new one is matchable as soon
	// as it has a release. One file at a time: together they are large.
	for (const boundaryType of BOUNDARY_TYPES) {
		const { vintages, properties } = BOUNDARY_CATALOG[boundaryType];
		const parentKeys = (properties as { parentCode?: readonly string[] })
			.parentCode;
		for (const [year, path] of Object.entries(
			vintages as Record<number, string>,
		)) {
			const features = await propertiesOf(path);
			const codes = new Set<string>();
			const names: Record<string, string[]> = {};
			const parentOf: Record<string, string> = {};
			for (const featureProperties of features) {
				const code = getProp(featureProperties, properties.code);
				if (!code) continue;
				codes.add(code);
				const name = getProp(featureProperties, properties.name);
				if (name) {
					const nameCodes = (names[name.toLowerCase()] ??= []);
					if (!nameCodes.includes(code)) nameCodes.push(code);
				}
				const parent =
					(parentKeys && getProp(featureProperties, parentKeys)) ||
					(boundaryType === "ward" && wardToLad[code]) ||
					(boundaryType === "parish" &&
						parishToLad[Number(year)]?.[code]);
				if (parent) parentOf[code] = parent;
			}
			// Parents only matter where a name is shared, so ship only those.
			const shared = new Set(
				Object.values(names)
					.filter((nameCodes) => nameCodes.length > 1)
					.flat(),
			);
			const parents: Record<string, string[]> = {};
			for (const code of shared)
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
