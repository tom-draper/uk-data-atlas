import { readSqliteAreaInventory } from "../../shared/atlasAreaReader";
import { readAreaLookup } from "../../shared/areaLookup";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "../../shared/crosswalkLoader";
import { createRelationshipPathIndex } from "../../shared/relationshipPaths";
import { createGeographyResolver } from "../../shared/geographyResolver";

export const readLookupResolver = (apiRoot: string) => {
	const inventory = readSqliteAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, inventory);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const crosswalkLookup = readCrosswalkLookup(apiRoot, crosswalkInventory);
	const relationshipPathIndex = createRelationshipPathIndex(
		readRelationshipPathInventory(apiRoot, crosswalkInventory),
	);
	return createGeographyResolver({
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		relationshipPathIndex,
	});
};
