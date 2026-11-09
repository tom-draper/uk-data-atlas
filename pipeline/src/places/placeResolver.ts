import { NamedLocationResolver } from "@uk-data-atlas/places";

import {
	readAreaLookup,
	AreasResolver,
	SpatialResolver,
	LineageResolver,
	readSqliteAreaInventory,
} from "@uk-data-atlas/atlas-runtime/areas";
import { type GeographyResolverInputs } from "@uk-data-atlas/atlas-runtime/loader";
import { readBuildBoundaryRegistry } from "../buildBoundaryRegistry.ts";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { createAreaGeometryCache } from "@uk-data-atlas/geometry";
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
	const areaInventory = readSqliteAreaInventory(repositoryRoot, databasePath);
	const crosswalkInventory = readCrosswalkInventory(
		repositoryRoot,
		databasePath,
	);
	return createPlaceResolver({
		areaInventory,
		areaLookup: readAreaLookup(
			repositoryRoot,
			areaInventory,
			undefined,
			databasePath,
		),
		crosswalkLookup: readCrosswalkLookup(
			repositoryRoot,
			crosswalkInventory,
			undefined,
			databasePath,
		),
		areaGeometryCache: createAreaGeometryCache(repositoryRoot),
		namedLocationInventory: readNamedLocationInventory(
			repositoryRoot,
			databasePath,
		),
		boundaryRegistry: readBuildBoundaryRegistry(repositoryRoot),
	});
};
