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
import { AreasResolver } from "../../shared/resolver/areas";
import { CatalogueResolver } from "../../shared/resolver/catalogue";
import { LineageResolver } from "../../shared/resolver/lineage";
import { LocationsResolver } from "../../shared/resolver/locations";
import { SpatialResolver } from "../../shared/resolver/spatial";
import type { AreaIdentity } from "../../shared/areaIdentity";

export const readPlaceResolver = (apiRoot: string) => {
	const areaInventory = readSqliteAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, areaInventory);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const crosswalkLookup = readCrosswalkLookup(apiRoot, crosswalkInventory);
	readRelationshipPathInventory(apiRoot, crosswalkInventory);
	const namedLocationInventory = readNamedLocationInventory(apiRoot);
	const inputs = {
		areaInventory,
		areaLookup,
		crosswalkInventory,
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
	};
	const areas = new AreasResolver(inputs);
	const catalogue = new CatalogueResolver(inputs);
	const locations = new LocationsResolver(inputs, catalogue);
	const spatial = new SpatialResolver(
		createAreaGeometryCache(apiRoot),
		(identity) => areas.area(identity),
	);
	const lineage = new LineageResolver(
		crosswalkLookup,
		(identity) => areas.area(identity),
		(identity) => areas.sameCode(identity),
	);
	return {
		area: (identity: AreaIdentity) => areas.area(identity),
		areaCodes: (geography: string, release: string) =>
			areas.areaCodes(geography, release),
		areaReleases: () => areas.areaReleases(),
		areaGeometry: (identity: AreaIdentity) =>
			spatial.areaGeometry(identity),
		areaNeighbours: (identity: AreaIdentity) =>
			spatial.areaNeighbours(identity),
		areaRelationshipSummary: (identity: AreaIdentity) =>
			lineage.areaRelationshipSummary(identity),
		namedLocations: (asOf?: string) => locations.namedLocations(asOf),
		namedLocationsForArea: (identity: AreaIdentity, asOf?: string) =>
			locations.namedLocationsForArea(identity, asOf),
	};
};
