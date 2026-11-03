import { NamedLocationResolver } from "@uk-data-atlas/places";
import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import {
	readAreaLookup,
	AreasResolver,
	SpatialResolver,
	LineageResolver,
	type GeographyResolverInputs,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readBuildBoundaryRegistry } from "./buildBoundaryRegistry";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";
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
	const locations = new NamedLocationResolver(inputs.namedLocationInventory);
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

export const readPlaceResolver = (
	repositoryRoot: string,
	databasePath: string,
) => {
	const apiRoot = apiRootOf(repositoryRoot);
	const areaInventory = readSqliteAreaInventory(apiRoot, databasePath);
	const crosswalkInventory = readCrosswalkInventory(apiRoot, databasePath);
	return createPlaceResolver({
		areaInventory,
		areaLookup: readAreaLookup(
			apiRoot,
			areaInventory,
			undefined,
			databasePath,
		),
		crosswalkLookup: readCrosswalkLookup(
			apiRoot,
			crosswalkInventory,
			undefined,
			databasePath,
		),
		areaGeometryCache: createAreaGeometryCache(repositoryRoot),
		namedLocationInventory: readNamedLocationInventory(
			apiRoot,
			databasePath,
		),
		boundaryRegistry: readBuildBoundaryRegistry(repositoryRoot),
	});
};
