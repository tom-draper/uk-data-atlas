import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geometryBounds } from "../src/areaContainment";
import {
	countyMemberships,
	SCOTTISH_LIEUTENANCY_AREAS,
	withCeremonialCounties,
	withHistoricCounties,
	type CountyShape,
} from "../src/ceremonialCounties";
import { compileNamedLocations, membersAt } from "../src/namedLocations";
import { releaseMonth } from "../src/releaseForDate";
import { toWgs84Geometry } from "../src/reprojection";
import { readShapefileFeatures } from "../src/shapefile";
import { createAreaGeometryCache } from "../src/geometryLoader";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import { compileNamedLocationGeometry } from "../src/namedLocationGeometry";

/**
 * Ordnance Survey's ceremonial counties of England and Wales, in WGS84. The
 * file's Scottish lieutenancy areas are left out: see ceremonialCounties.ts.
 */
const readCountyShapes = (
	repositoryRoot: string,
	directory: string,
	file: string,
	excludeScottishLieutenancy = false,
): CountyShape[] =>
	readShapefileFeatures(
		join(repositoryRoot, "data", "geography", directory, "source", file),
	)
		.filter(
			({ properties }) =>
				!excludeScottishLieutenancy ||
				!SCOTTISH_LIEUTENANCY_AREAS.has(properties.NAME!),
		)
		.map(({ properties, geometry }) => {
			const wgs84 = toWgs84Geometry(geometry, "EPSG:27700");
			return {
				name: properties.NAME!,
				geometry: wgs84,
				bounds: geometryBounds(wgs84)!,
			};
		});

const readCeremonialCounties = (repositoryRoot: string) =>
	readCountyShapes(
		repositoryRoot,
		"ceremonial-counties",
		"Boundary-line-ceremonial-counties_region.shp",
		true,
	);

const readHistoricCounties = (repositoryRoot: string) =>
	readCountyShapes(
		repositoryRoot,
		"historic-counties",
		"Boundary-line-historic-counties_region.shp",
	);

export const buildNamedLocations = (repositoryRoot: string) => {
	const source = join(
		repositoryRoot,
		"public",
		"data",
		"datasets",
		"gazetteer.core.json",
	);
	if (!existsSync(source)) {
		throw new Error(
			`Build the gazetteer core before named locations: ${source}`,
		);
	}
	const outputPath = join(
		repositoryRoot,
		"services",
		"api",
		"public",
		"named-locations.json",
	);
	const parsed = compileNamedLocations(source);
	const areaInventory = readAreaInventory(
		join(repositoryRoot, "services", "api"),
	);
	const areas = readAreaLookup(
		join(repositoryRoot, "services", "api"),
		areaInventory,
	);
	const cache = createAreaGeometryCache(
		join(repositoryRoot, "services", "api"),
		1,
	);
	const counties = readCeremonialCounties(repositoryRoot);
	const authorityReleases = areaInventory.releases
		.filter(
			(release) =>
				release.status === "available" &&
				release.geography === "localAuthority" &&
				releaseMonth(release.id) !== undefined,
		)
		.map((release) => ({
			month: releaseMonth(release.id)!,
			codes: cache.codes("localAuthority", release.id),
			// Read as each authority is placed, so no release's geometry is
			// held beyond its turn.
			geometry: (code: string) =>
				cache.get("localAuthority", release.id, code),
		}));
	const historicCounties = readHistoricCounties(repositoryRoot);
	const withCounties = withHistoricCounties(
		withCeremonialCounties(
			parsed.locations,
			countyMemberships(authorityReleases, counties),
			counties,
		),
		countyMemberships(authorityReleases, historicCounties),
		historicCounties,
	);
	const locations = withCounties.map((location) => {
		// The members current at the latest release, so a location whose
		// members were reorganised is drawn as it is now.
		const current = membersAt(location, "9999-12-31");
		const release = areaInventory.releases
			.filter(
				(candidate) =>
					candidate.status === "available" &&
					candidate.geography === location.memberGeography &&
					areas
						.get(`${candidate.geography}/${candidate.id}`)
						?.has(current[0] ?? "") &&
					current.every((code) =>
						areas
							.get(`${candidate.geography}/${candidate.id}`)
							?.has(code),
					),
			)
			.sort((left, right) => right.id.localeCompare(left.id))[0];
		if (!release) return location;
		try {
			const geometry = compileNamedLocationGeometry(
				cache,
				location.memberGeography,
				release.id,
				current,
			);
			return geometry
				? { ...location, bbox: geometry.bbox, geometry }
				: location;
		} catch {
			return location;
		}
	});
	const content = JSON.stringify({
		schemaVersion: 1,
		source: parsed.source,
		locations,
	});
	const inventory = {
		...parsed,
		contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
		locations,
	};
	writeFileSync(outputPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { outputPath, count: inventory.locations.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildNamedLocations(repositoryRoot);
	console.log(
		`Wrote ${result.count} named locations to ${result.outputPath}`,
	);
}
