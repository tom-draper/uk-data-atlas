import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { releaseKey, type LookupResolver } from "@uk-data-atlas/geography";
import {
	CrosswalkTranslator,
	createRelationshipPathIndex,
	type CrosswalkInventory,
	type CrosswalkTranslatorInputs,
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

export const readLookupResolver = (apiRoot: string) => {
	const inventory = readSqliteAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, inventory);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const crosswalkLookup = readCrosswalkLookup(apiRoot, crosswalkInventory);
	const relationshipPathIndex = createRelationshipPathIndex(
		readRelationshipPathInventory(apiRoot, crosswalkInventory),
	);
	return createLookupResolver({
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		relationshipPathIndex,
	});
};
