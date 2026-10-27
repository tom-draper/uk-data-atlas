import { readSqliteAreaInventory } from "../../shared/atlasAreaReader";
import { readAreaLookup } from "../../shared/areaLookup";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "../../shared/crosswalkLoader";
import { createRelationshipPathIndex } from "../../shared/relationshipPaths";
import { CrosswalkTranslator } from "../../shared/translation";
import type { AreaLookup } from "../../shared/areaInventory";
import type { CrosswalkInventory } from "../../shared/crosswalkInventory";
import type { CrosswalkLookup } from "../../shared/translation";
import type { RelationshipPath } from "../../shared/relationshipPaths";
import type {
	AreaIdentity,
	GeographyEndpoint,
} from "../../shared/areaIdentity";

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

export const createLookupResolver = ({
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	relationshipPathIndex,
}: {
	areaLookup: AreaLookup;
	crosswalkInventory: CrosswalkInventory;
	crosswalkLookup: CrosswalkLookup;
	relationshipPathIndex: Map<string, RelationshipPath[]>;
}) => {
	const translator = new CrosswalkTranslator({
		areaLookup,
		crosswalkLookup,
		relationshipPathIndex,
	});
	return {
		hasAreaRelease: (geography: string, release: string) =>
			areaLookup.has(`${geography}/${release}`),
		areaCodes: (geography: string, release: string) => {
			const areas = areaLookup.get(`${geography}/${release}`);
			return areas ? [...areas.keys()] : undefined;
		},
		crosswalkSummaries: () => crosswalkInventory.crosswalks,
		crosswalk: (id: string) => translator.artifact(id),
		sameArea: (source: AreaIdentity, to: GeographyEndpoint) =>
			translator.sameArea(source, to),
		successorArea: (source: AreaIdentity, to: GeographyEndpoint) =>
			translator.successorArea(source, to),
	};
};
