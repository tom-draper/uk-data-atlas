import {
	GENERALISATION_METHOD,
	GEOMETRY_TIERS,
	isGeometryTier,
	simplifyGeometry,
} from "./simplifyGeometry";
import { areaNotFound } from "./areaResources";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** The geometry of every area a published relationship places inside one area, as a feature collection. */
export const handleAreaChildGeometryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 7 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "children" ||
		segments[6] !== "geometry"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	const area = geographyResolver.area({
		geography,
		boundaryRelease,
		code,
	});
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	const relationshipsUnavailable = geographyResolver.requires("relationships");
	if (relationshipsUnavailable) return relationshipsUnavailable;
	const geometryUnavailable = geographyResolver.requires("geometry");
	if (geometryUnavailable) return geometryUnavailable;
	const requestedTier = parsedUrl.searchParams.get("tier") ?? "full";
	if (!isGeometryTier(requestedTier))
		return problem(
			400,
			"Unknown Tier",
			`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
				GEOMETRY_TIERS,
			).join(", ")}.`,
		);
	const contained = geographyResolver
		.relationships({ geography, boundaryRelease, code })
		.filter((relationship) => relationship.relation === "contains");
	if (contained.length === 0)
		return problem(
			404,
			"Not Found",
			"No published relationship names anything as contained by that area.",
		);
	// Children of different geographies, such as a district's wards and its
	// LSOAs, overlap one another, so they are never drawn as one collection.
	const childGeography = parsedUrl.searchParams.get("childGeography");
	const layers = [
		...new Set(
			contained.map(
				({ counterpart }) =>
					`${counterpart.geography}/${counterpart.boundaryRelease}`,
			),
		),
	].sort();
	const children = childGeography
		? contained.filter(
				({ counterpart }) =>
					counterpart.geography === childGeography ||
					`${counterpart.geography}/${counterpart.boundaryRelease}` ===
						childGeography,
			)
		: contained;
	const chosenLayers = new Set(
		children.map(
			({ counterpart }) =>
				`${counterpart.geography}/${counterpart.boundaryRelease}`,
		),
	);
	if (childGeography && children.length === 0)
		return problem(
			404,
			"Not Found",
			`No published relationship names a ${childGeography} area as contained by that area. Its children are published as ${layers.join(", ")}.`,
			{ choices: layers },
		);
	if (chosenLayers.size > 1)
		return problem(
			409,
			"Ambiguous Children",
			`That area's children are published in ${chosenLayers.size} geography releases, which overlap one another. Choose one with childGeography, as a geography or {geography}/{release}.`,
			{ choices: [...chosenLayers].sort() },
		);
	const features: unknown[] = [];
	// A child can be published as a relationship and still have no servable
	// geometry, and a whole release can be missing its geometry source.
	// Both are listed rather than passed over, so a caller can tell a
	// partial collection from a complete one.
	const withoutGeometry: unknown[] = [];
	let vertices = 0;
	for (const child of children) {
		const { counterpart, crosswalk } = child;
		const note = (reason: string) => {
			withoutGeometry.push({
				id: counterpart.id,
				geography: counterpart.geography,
				boundaryRelease: counterpart.boundaryRelease,
				code: counterpart.code,
				reason,
			});
		};
		let resolved;
		try {
			resolved = geographyResolver.geometryFor({
				geography: counterpart.geography,
				boundaryRelease: counterpart.boundaryRelease,
				code: counterpart.code,
			});
		} catch (error) {
			note(
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			);
			continue;
		}
		if (!resolved) {
			note("No feature for this code in the raw geometry source.");
			continue;
		}
		const simplified = simplifyGeometry(resolved.geometry, requestedTier);
		if (!simplified) {
			note(`Every part is smaller than the ${requestedTier} tier keeps.`);
			continue;
		}
		vertices += simplified.verticesAfter;
		const childArea = geographyResolver.area({
			geography: counterpart.geography,
			boundaryRelease: counterpart.boundaryRelease,
			code: counterpart.code,
		});
		features.push({
			type: "Feature",
			id: counterpart.id,
			properties: {
				id: counterpart.id,
				geography: counterpart.geography,
				boundaryRelease: counterpart.boundaryRelease,
				code: counterpart.code,
				...(childArea ?? { labels: counterpart.labels }),
				// Membership here is a published crosswalk's claim, not a
				// geometric test run at request time.
				membership: crosswalk,
				// The tier itself is stated once for the collection; only
				// what it cost this member is worth repeating, so that a
				// member which lost parts can be told from one that did not.
				generalisation: {
					vertices: simplified.verticesAfter,
					verticesAtFullResolution: simplified.verticesBefore,
					parts: simplified.partsAfter,
					partsAtFullResolution: simplified.partsBefore,
				},
				geometrySource: resolved.geometrySource,
			},
			geometry: simplified.geometry,
		});
	}
	return {
		status: 200,
		body: envelope(releaseId, {
			type: "FeatureCollection",
			id: `${geography}/${boundaryRelease}/${code}/children`,
			parent: {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
			},
			collection: {
				members: children.length,
				withGeometry: features.length,
				vertices,
				tier: requestedTier,
				toleranceM: GEOMETRY_TIERS[requestedTier],
				minEffectiveAreaM2: GEOMETRY_TIERS[requestedTier] ** 2,
				...(requestedTier === "full"
					? {}
					: { generalisationMethod: GENERALISATION_METHOD }),
			},
			withoutGeometry,
			features,
		}),
	};
};
