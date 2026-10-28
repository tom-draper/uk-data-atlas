import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { createRelationshipPathIndex } from "@uk-data-atlas/atlas-runtime/relationships";
import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";

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
