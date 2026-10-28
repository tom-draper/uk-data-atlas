import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import {
	readAreaLookup,
	AreasResolver,
	CatalogueResolver,
	LocationsResolver,
	SpatialResolver,
	LineageResolver,
	type GeographyResolverInputs,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readBoundaryRegistry } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { createAreaGeometryCache } from "@uk-data-atlas/atlas-runtime/geometry";
import { readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";

export const createPlaceResolver = (
	inputs: Pick<
		GeographyResolverInputs,
		| "areaInventory"
		| "areaLookup"
		| "boundaryRegistry"
		| "crosswalkLookup"
		| "areaGeometryCache"
		| "namedLocationInventory"
	>,
) => {
	const areas = new AreasResolver(inputs);
	const locations = new LocationsResolver(
		inputs,
		new CatalogueResolver(inputs),
	);
	const spatial = new SpatialResolver(inputs.areaGeometryCache, (id) =>
		areas.area(id),
	);
	const lineage = new LineageResolver(
		inputs.crosswalkLookup,
		(id) => areas.area(id),
		(id) => areas.sameCode(id),
	);
	return {
		area: areas.area.bind(areas),
		areaCodes: areas.areaCodes.bind(areas),
		areaReleases: areas.areaReleases.bind(areas),
		areaGeometry: spatial.areaGeometry.bind(spatial),
		areaNeighbours: spatial.areaNeighbours.bind(spatial),
		areaRelationshipSummary: lineage.areaRelationshipSummary.bind(lineage),
		namedLocations: locations.namedLocations.bind(locations),
		namedLocationsForArea: locations.namedLocationsForArea.bind(locations),
	};
};

export const readPlaceResolver = (apiRoot: string) => {
	const areaInventory = readSqliteAreaInventory(apiRoot);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	return createPlaceResolver({
		areaInventory,
		areaLookup: readAreaLookup(apiRoot, areaInventory),
		crosswalkLookup: readCrosswalkLookup(apiRoot, crosswalkInventory),
		areaGeometryCache: createAreaGeometryCache(apiRoot),
		namedLocationInventory: readNamedLocationInventory(apiRoot),
		boundaryRegistry: readBoundaryRegistry(apiRoot),
	});
};
