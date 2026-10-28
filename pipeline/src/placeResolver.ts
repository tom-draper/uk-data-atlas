import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { readBoundaryRegistry } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { createAreaGeometryCache } from "@uk-data-atlas/atlas-runtime/geometry";
import {
	createLocationProjectionStore,
	createNamedLocations,
	readLocationProjectionInventory,
	readNamedLocationInventory,
} from "@uk-data-atlas/atlas-runtime/places";
import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";
import { createRelationshipPathIndex } from "@uk-data-atlas/atlas-runtime/relationships";

export const readPlaceResolver = (apiRoot: string) => {
	const areaInventory = readSqliteAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, areaInventory);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const crosswalkLookup = readCrosswalkLookup(apiRoot, crosswalkInventory);
	const relationshipPathIndex = createRelationshipPathIndex(
		readRelationshipPathInventory(apiRoot, crosswalkInventory),
	);
	const namedLocationInventory = readNamedLocationInventory(apiRoot);
	return createGeographyResolver({
		areaInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		relationshipPathIndex,
		areaGeometryCache: createAreaGeometryCache(apiRoot),
		namedLocationInventory,
		boundaryRegistry: readBoundaryRegistry(apiRoot),
		namedLocationLookup: createNamedLocations(namedLocationInventory),
		locationProjectionStore: createLocationProjectionStore(
			apiRoot,
			readLocationProjectionInventory(
				apiRoot,
				namedLocationInventory,
				crosswalkInventory,
			),
		),
	});
};
