import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import {
	buildArtifactPath,
	readAreaLookup,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readFileSync } from "node:fs";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { releaseKey, type LookupResolver } from "@uk-data-atlas/geography";
import {
	CrosswalkTranslator,
	createRelationshipPathIndex,
	type CrosswalkInventory,
	type CrosswalkTranslatorInputs,
	type RelationshipPathInventory,
} from "@uk-data-atlas/relationships";

export const createLookupResolver = (
	inputs: CrosswalkTranslatorInputs & {
		crosswalkInventory: CrosswalkInventory;
	},
): LookupResolver => {
	const translator = new CrosswalkTranslator(inputs);
	return {
		hasAreaRelease: (geography, release) =>
			inputs.areaLookup?.has(releaseKey(geography, release)) ?? false,
		areaCodes: (geography, release) => {
			const areas = inputs.areaLookup?.get(
				releaseKey(geography, release),
			);
			return areas ? [...areas.keys()] : undefined;
		},
		crosswalkSummaries: () => inputs.crosswalkInventory.crosswalks,
		crosswalk: (id) => translator.artifact(id),
		sameArea: (source, to) => translator.sameArea(source, to),
		successorArea: (source, to) => translator.successorArea(source, to),
	};
};

export const readLookupResolver = (
	apiRoot: string,
	repositoryRoot: string,
	databasePath: string,
) => {
	const inventory = readSqliteAreaInventory(apiRoot, databasePath);
	const areaLookup = readAreaLookup(
		apiRoot,
		inventory,
		undefined,
		databasePath,
	);
	const crosswalkInventory = readCrosswalkInventory(apiRoot, databasePath);
	const crosswalkLookup = readCrosswalkLookup(
		apiRoot,
		crosswalkInventory,
		undefined,
		databasePath,
	);
	const path = buildArtifactPath(repositoryRoot, "relationship-paths.json");
	const paths = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipPathInventory;
	if (
		paths.schemaVersion !== 1 ||
		!Array.isArray(paths.paths) ||
		paths.crosswalkInventoryHash !== crosswalkInventory.contentHash
	)
		throw new Error(`Invalid relationship path inventory at ${path}`);
	const relationshipPathIndex = createRelationshipPathIndex(paths);
	return createLookupResolver({
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		relationshipPathIndex,
	});
};
