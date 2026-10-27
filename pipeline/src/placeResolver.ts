import { readSqliteAreaInventory } from "../../shared/atlasAreaReader";
import { readAreaLookup } from "../../shared/areaLookup";
import { readBoundaryRegistry } from "../../shared/boundaryCatalogue";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "../../shared/crosswalkLoader";
import { createAreaGeometryCache } from "../../shared/geometryLoader";
import {
	createLocationProjectionStore,
	createNamedLocations,
	readLocationProjectionInventory,
	readNamedLocationInventory,
} from "../../shared/locationLoader";
import { createGeographyResolver } from "../../shared/geographyResolver";
import { createRelationshipPathIndex } from "../../shared/relationshipPaths";

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
