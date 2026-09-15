import { areaMetrics } from "./areaMetrics";
import {
	GENERALISATION_METHOD,
	GEOMETRY_TIERS,
	isGeometryTier,
	simplifyGeometry,
} from "./simplifyGeometry";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";
import { attributionFor, attributionText } from "./attribution";
import { measureCoverage } from "./measureCoverage";
import {
	areaMeasureSources,
	areaNotFound,
	findArea,
	relationshipsFor,
} from "./areaResources";
import { handleRoute } from "./routeHandlers";
import type { RouteContext } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

export { type ApiResponse } from "./routeResponse";

/**
 * Travels with every measurement, so a figure taken from one response can be
 * read without the documentation beside it. The last line is the one that
 * matters: this is the boundary as published, not a land-area statistic.
 */
const AREA_METRIC_METHOD = {
	area: "Ellipsoidal, through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical equal-area projection on the WGS 84 ellipsoid. Projected area equals area on the ellipsoid, so no correction is applied. Holes are subtracted.",
	perimeter:
		"Summed over every ring, holes included. Each edge's ground length comes from the ellipsoid's meridional and prime-vertical radii of curvature at its mid-latitude.",
	centroid:
		"The centre of area, taken in the same equal-area projection so each part weighs its true ground area, then inverted to WGS 84. It can fall outside a crescent or a split area.",
	labelPoint:
		"A point guaranteed inside the area. The centroid where that lies within the geometry, otherwise the midpoint of the widest run of interior found on latitudes sampled across the bounding box.",
	caveat: "Measured from the boundary as that release publishes it, at its own generalisation. This is not a published land-area statistic: a coastline-clipped boundary still encloses inland water, so these figures differ from the ONS Standard Area Measurement used by population density.",
} as const;

/**
 * Travels with a neighbour list, because the answer rests on a property of the
 * published release rather than on a distance anyone chose.
 */
const NEIGHBOUR_METHOD = {
	rule: "Two areas are neighbours where their boundaries share vertices. Adjacent areas in one release are drawn from the same vertices, so a shared border is the same coordinates on both sides and matches exactly. No distance threshold decides who is a neighbour.",
	sharedBorder:
		"Summed over the edges the two areas have in common, each counted once, with ground length from the ellipsoid's radii of curvature at the edge's mid-latitude.",
	unshared:
		"Perimeter less the border shared with the neighbours returned. For a landlocked area this is nothing; otherwise it is coastline, a national boundary, or a border with an area outside this release.",
	limits: "Within one geography and release only. Two areas that genuinely touch on the ground but were drawn from different vertices are not found, which is why this is not offered across releases.",
} as const;

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

/**
 * Route a request against named, independently-built catalogues. Keeping the
 * dependencies in one object prevents a newly added artifact from silently
 * shifting a long positional argument list at every call site.
 */
export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
): ApiResponse => {
	const {
		boundaryRegistry: registry,
		areaInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		areaRelationshipIndex,
		areaGeometryCache,
		validationReport,
		namedLocationInventory,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
	} = context;
	const releaseId = atlasRelease?.releaseId ?? registry.contentHash;
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}

	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const pathname = parsedUrl.pathname;
	const segments = pathname.split("/").filter(Boolean).map(decodePathSegment);
	if (segments.some((segment) => segment === undefined)) {
		return problem(
			400,
			"Invalid Path",
			"The request path contains invalid encoding.",
		);
	}
	const handledResponse = handleRoute({
		context,
		releaseId,
		parsedUrl,
		segments: segments as string[],
	});
	if (handledResponse) return handledResponse;

	if (segments.length === 1 && segments[0] === "v1") {
		return {
			status: 200,
			body: envelope(releaseId, {
				name: "UK Data Atlas API",
				links: [
					"/v1/geographies",
					"/v1/boundary-releases",
					"/v1/boundary-releases:resolve",
					"/v1/boundary-releases/{type}/{release}",
					"/v1/geography-inventory",
					"/v1/datasets",
					"/v1/datasets/{dataset-id}",
					"/v1/measures",
					"/v1/measures/{measure-id}",
					"/v1/measures/{measure-id}/compatibility",
					"/v1/measures/{measure-id}/coverage",
					"/v1/measures/{measure-id}/quality",
					"/v1/data/{measure-id}",
					"/v1/data/{measure-id}/series",
					"/v1/data/{measure-id}/rankings",
					"/v1/data/{measure-id}/change",
					"/v1/data/{measure-id}/value",
					"/v1/places",
					"/v1/data/{measure-id}/compare",
					"/v1/data/{measure-id}/aggregate",
					"/v1/data/{measure-id}/convert",
					"/v1/areas",
					"/v1/areas:contains",
					"/v1/areas:intersects",
					"/v1/areas:validate",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/areas/{type}/{release}/{code}/history",
					"/v1/areas/{type}/{release}/{code}/parents",
					"/v1/areas/{type}/{release}/{code}/children",
					"/v1/areas/{type}/{release}/{code}/children/geometry",
					"/v1/areas/{type}/{release}/{code}/relationships",
					"/v1/areas/{type}/{release}/{code}/neighbours",
					"/v1/areas/{type}/{release}/{code}/overlap",
					"/v1/areas/{type}/{release}/{code}/capabilities",
					"/v1/areas/{type}/{release}/{code}/citation",
					"/v1/areas/{type}/{release}/{code}/geometry",
					"/v1/areas/{type}/{release}/{code}/geometry/metadata",
					"/v1/translations",
					"/v1/attribution",
					"/v1/locations",
					"/v1/locations/{location-id}",
					"/v1/locations/{location-id}/members",
					"/v1/crosswalks",
					"/v1/crosswalks/{crosswalk-id}",
					"/v1/crosswalks/{crosswalk-id}/records",
					"/v1/relationship-candidates",
					"/v1/validation",
					"/v1/validation/boundary-releases/{type}/{release}",
					"/v1/validation/crosswalks/{crosswalk-id}",
					"/v1/validation/measures/{measure-id}",
					"/v1/validation/exports/{export-id}",
					"/v1/exports",
					"/v1/exports/{export-id}",
					"/v1/lookups",
					"/v1/lookups/{lookup-id}",
					"/v1/atlas-release",
					"/v1/atlas-releases",
					"/v1/atlas-releases/{release-id}",
					"/v1/atlas-releases/compare",
				],
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "neighbours"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before finding neighbours.",
			);
		const touches = parsedUrl.searchParams.get("touches") ?? "edge";
		if (touches !== "edge" && touches !== "any")
			return problem(
				400,
				"Invalid Query",
				"touches must be edge, for areas sharing a border, or any, which also returns areas meeting at a single point.",
			);
		try {
			const found = areaGeometryCache.findNeighbours(
				geography,
				boundaryRelease,
				code,
			);
			if (!found)
				return problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				);
			const geometry = areaGeometryCache.get(
				geography,
				boundaryRelease,
				code,
			)!;
			const metrics = areaMetrics(geometry);
			const kept = found.filter(
				(neighbour) => touches === "any" || neighbour.touch === "edge",
			);
			const sharedBorderM = kept.reduce(
				(total, neighbour) => total + neighbour.sharedBorderM,
				0,
			);
			const perimeterM = metrics?.perimeterM ?? 0;
			return {
				status: 200,
				body: envelope(releaseId, {
					id: `${geography}/${boundaryRelease}/${code}`,
					geography,
					boundaryRelease,
					...area,
					touches,
					border: {
						perimeterM,
						sharedBorderM,
						// A fully landlocked area shares every metre, and
						// summing its neighbours can land a hair over its own
						// perimeter, so the remainder is floored at nothing
						// rather than reported as a negative coastline.
						unsharedBorderM: Math.max(
							0,
							perimeterM - sharedBorderM,
						),
						pointOnlyTouches: found.filter(
							(neighbour) => neighbour.touch === "point",
						).length,
					},
					method: NEIGHBOUR_METHOD,
					neighbours: kept.flatMap((neighbour) => {
						const neighbourArea = findArea(
							areaLookup,
							geography,
							boundaryRelease,
							neighbour.code,
						);
						return [
							{
								id: `${geography}/${boundaryRelease}/${neighbour.code}`,
								...(neighbourArea ?? { code: neighbour.code }),
								touch: neighbour.touch,
								sharedBorderM: neighbour.sharedBorderM,
								shareOfPerimeter:
									perimeterM > 0
										? neighbour.sharedBorderM / perimeterM
										: 0,
								sharedEdges: neighbour.sharedEdges,
								sharedVertices: neighbour.sharedVertices,
							},
						];
					}),
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded for neighbour lookup.",
			);
		}
	}

	if (
		segments.length === 7 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "children" &&
		segments[6] === "geometry"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		if (!crosswalkLookup)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the crosswalk inventory before looking up area membership.",
			);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before retrieving geometry.",
			);
		const requestedTier = parsedUrl.searchParams.get("tier") ?? "full";
		if (!isGeometryTier(requestedTier))
			return problem(
				400,
				"Unknown Tier",
				`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
					GEOMETRY_TIERS,
				).join(", ")}.`,
			);
		const children = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		).filter((relationship) => relationship.relation === "contains");
		if (children.length === 0)
			return problem(
				404,
				"Not Found",
				"No published relationship names anything as contained by that area.",
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
			let geometry;
			try {
				geometry = areaGeometryCache.get(
					counterpart.geography,
					counterpart.boundaryRelease,
					counterpart.code,
				);
			} catch (error) {
				note(
					error instanceof Error
						? error.message
						: "Geometry could not be loaded.",
				);
				continue;
			}
			if (!geometry) {
				note("No feature for this code in the raw geometry source.");
				continue;
			}
			const simplified = simplifyGeometry(geometry, requestedTier);
			if (!simplified) {
				note(
					`Every part is smaller than the ${requestedTier} tier keeps.`,
				);
				continue;
			}
			vertices += simplified.verticesAfter;
			const childArea = findArea(
				areaLookup,
				counterpart.geography,
				counterpart.boundaryRelease,
				counterpart.code,
			);
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
					geometrySource: areaGeometryCache.provenance(
						counterpart.geography,
						counterpart.boundaryRelease,
						counterpart.code,
					),
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
	}

	if (
		segments.length === 7 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "geometry" &&
		segments[6] === "metadata"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5);
		const area = findArea(
			areaLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before retrieving geometry.",
			);
		try {
			const geometry = areaGeometryCache.get(
				geography as string,
				boundaryRelease as string,
				code as string,
			);
			if (!geometry)
				return problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				);
			const metrics = areaMetrics(geometry);
			if (!metrics)
				return problem(
					422,
					"Geometry Not Measurable",
					"That area's geometry carries no polygon to measure.",
				);
			return {
				status: 200,
				body: envelope(releaseId, {
					id: [geography, boundaryRelease, area.code].join("/"),
					geography,
					boundaryRelease,
					...area,
					boundingBox: metrics.boundingBox,
					centroid: metrics.centroid,
					labelPoint: metrics.labelPoint,
					labelPointMethod: metrics.labelPointMethod,
					area: {
						m2: metrics.areaM2,
						hectares: metrics.areaHectares,
						km2: metrics.areaKm2,
					},
					perimeter: {
						m: metrics.perimeterM,
						km: metrics.perimeterKm,
					},
					geometryExtent: {
						parts: metrics.parts,
						rings: metrics.rings,
						vertices: metrics.vertices,
					},
					method: AREA_METRIC_METHOD,
					geometrySource: areaGeometryCache.provenance(
						geography as string,
						boundaryRelease as string,
						code as string,
					),
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			);
		}
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "geometry"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5);
		const area = findArea(
			areaLookup,
			geography as string,
			boundaryRelease as string,
			code as string,
		);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		if (!areaGeometryCache)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before retrieving geometry.",
			);
		try {
			const geometry = areaGeometryCache.get(
				geography as string,
				boundaryRelease as string,
				code as string,
			);
			if (!geometry)
				return problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				);
			const requestedTier = parsedUrl.searchParams.get("tier") ?? "full";
			if (!isGeometryTier(requestedTier))
				return problem(
					400,
					"Unknown Tier",
					`No such generalisation tier: ${requestedTier}. Choose one of ${Object.keys(
						GEOMETRY_TIERS,
					).join(", ")}.`,
				);
			const simplified = simplifyGeometry(geometry, requestedTier);
			if (!simplified)
				return problem(
					404,
					"Not Found",
					`Every part of that area is smaller than the ${requestedTier} tier keeps. Ask for a finer tier.`,
				);
			return {
				status: 200,
				body: envelope(releaseId, {
					type: "Feature",
					id: [geography, boundaryRelease, code].join("/"),
					properties: {
						id: [geography, boundaryRelease, area.code].join("/"),
						geography,
						boundaryRelease,
						...area,
						generalisation: {
							tier: simplified.tier,
							toleranceM: simplified.toleranceM,
							minEffectiveAreaM2: simplified.minEffectiveAreaM2,
							vertices: simplified.verticesAfter,
							verticesAtFullResolution: simplified.verticesBefore,
							parts: simplified.partsAfter,
							partsAtFullResolution: simplified.partsBefore,
							...(requestedTier === "full"
								? {}
								: { method: GENERALISATION_METHOD }),
						},
						geometrySource: areaGeometryCache.provenance(
							geography as string,
							boundaryRelease as string,
							code as string,
						),
					},
					geometry: simplified.geometry,
				}),
			};
		} catch (error) {
			return problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			);
		}
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "citation"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		if (!dataCatalog || !crosswalkInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and crosswalk inventory before citing an area.",
			);
		}
		const measureIds = [
			...new Set(parsedUrl.searchParams.getAll("measure")),
		];
		const crosswalkIds = [
			...new Set(parsedUrl.searchParams.getAll("crosswalk")),
		];
		const releaseIdentity = `${geography}/${boundaryRelease}`;
		// Resolved here only to refuse unknown resources; the bundle's own
		// attribution is narrowed below to what this area actually draws on.
		const requested = attributionFor(
			{
				datasets: [],
				measures: measureIds,
				boundaryReleases: [releaseIdentity],
				crosswalks: crosswalkIds,
			},
			dataCatalog,
			registry,
			crosswalkInventory,
		);
		if (requested.status === "unknown") {
			return problem(
				404,
				"Not Found",
				`No published resource matches ${requested.unknownResources.join(", ")}.`,
			);
		}

		// A crosswalk is cited for an area only when it maps that area; citing
		// one that does not would lend it evidence it never supplied.
		const relationships = relationshipsFor(
			areaRelationshipIndex,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		);
		const unrelatedCrosswalks = crosswalkIds.filter(
			(id) =>
				!relationships.some(
					(relationship) => relationship.crosswalk.id === id,
				),
		);
		if (unrelatedCrosswalks.length > 0) {
			return problem(
				422,
				"Not Applicable To Area",
				`${unrelatedCrosswalks.map((id) => `crosswalk=${id}`).join(", ")} publishes no relationship for ${releaseIdentity}/${code}.`,
			);
		}

		// Likewise a measure is cited through the observation artifacts that
		// actually hold a value for this area, in partitions assessed against
		// this exact release.
		const measures = measureIds.map((measureId) => {
			const measure = dataCatalog.measures.find(
				(candidate) => candidate.id === measureId,
			) as DataCatalog["measures"][number];
			const coverage = measureCompatibilityInventory
				? measureCoverage(
						dataCatalog,
						measureCompatibilityInventory,
						measureId,
					)
				: undefined;
			const sources = areaMeasureSources(
				measure,
				coverage,
				boundaryRelease,
				code,
				{
					populationObservations,
					populationLocalAuthorityObservations,
					measureObservations,
				},
			).flatMap((source) => {
				const periods = source.periods.flatMap((period) =>
					period.availability === "present"
						? [
								{
									period: period.period,
									artifact: period.artifact,
									contentHash: period.contentHash,
									status: period.status,
								},
							]
						: [],
				);
				return periods.length > 0
					? [
							{
								dataset: source.dataset,
								sourceGeography: source.sourceGeography,
								codeSetCompatibility: {
									status: source.codeSetCompatibility.status,
									eligibleForCodeJoin:
										source.codeSetCompatibility
											.eligibleForCodeJoin,
								},
								periods,
							},
						]
					: [];
			});
			return {
				id: measure.id,
				label: measure.label,
				href: `/v1/measures/${measure.id}`,
				sources,
			};
		});
		const uncitedMeasures = measures.filter(
			(measure) => measure.sources.length === 0,
		);
		if (uncitedMeasures.length > 0) {
			return problem(
				422,
				"Not Applicable To Area",
				`${uncitedMeasures.map((measure) => `measure=${measure.id}`).join(", ")} publishes no observation for ${releaseIdentity}/${code} in a source assessed against this boundary release.`,
			);
		}

		// A measure's other partitions hold no value for this area, so only the
		// datasets cited above are credited, with any derived measure's
		// denominator, which is as much a part of the value.
		const attribution = attributionFor(
			{
				datasets: [
					...measures.flatMap((measure) =>
						measure.sources.map((source) => source.dataset.id),
					),
					...measureIds.flatMap(
						(id) =>
							dataCatalog.measures.find(
								(candidate) => candidate.id === id,
							)?.derivedFrom?.datasetIds ?? [],
					),
				],
				measures: [],
				boundaryReleases: [releaseIdentity],
				crosswalks: crosswalkIds,
			},
			dataCatalog,
			registry,
			crosswalkInventory,
		);
		if (attribution.status === "unknown") {
			return problem(
				404,
				"Not Found",
				`No published resource matches ${attribution.unknownResources.join(", ")}.`,
			);
		}

		const release = registry.releases.find(
			(candidate) =>
				candidate.geography === geography &&
				candidate.id === boundaryRelease,
		) as BoundaryRegistry["releases"][number];
		const identityArtifact = areaInventory?.releases.find(
			(candidate) =>
				candidate.geography === geography &&
				candidate.id === boundaryRelease,
		);
		const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
		const geometryHash = (inputHash?: string) =>
			inputHash
				? {
						status: "available" as const,
						scope: "source-file" as const,
						value: inputHash,
						note: "Hashes the whole source file this release's geometry is read from, not this area alone. Per-area geometry hashes are not compiled.",
					}
				: {
						status: "not-published" as const,
						note: "No hash of the geometry source is recorded for this release. The boundary release's metadataHash pins its metadata, which names the source file but does not hash its contents.",
					};
		const geometry = (() => {
			if (!areaGeometryCache)
				return {
					status: "not-published" as const,
					href: geometryHref,
					hash: geometryHash(),
				};
			try {
				const provenance = areaGeometryCache.get(
					geography,
					boundaryRelease,
					code,
				)
					? areaGeometryCache.provenance(
							geography,
							boundaryRelease,
							code,
						)
					: undefined;
				return provenance
					? {
							status: "available" as const,
							href: geometryHref,
							provenance,
							hash: geometryHash(provenance.inputHash),
						}
					: {
							status: "not-found" as const,
							href: geometryHref,
							hash: geometryHash(),
						};
			} catch (error) {
				return {
					status: "unavailable" as const,
					href: geometryHref,
					reason:
						error instanceof Error
							? error.message
							: "Geometry could not be loaded.",
					hash: geometryHash(),
				};
			}
		})();

		const crosswalks = crosswalkIds.map((id) => {
			const entry = crosswalkInventory.crosswalks.find(
				(candidate) => candidate.id === id,
			) as CrosswalkInventory["crosswalks"][number];
			const artifact = crosswalkLookup?.get(id);
			return {
				id,
				method: entry.method,
				quality: entry.quality,
				from: entry.from,
				to: entry.to,
				contentHash: entry.contentHash,
				...(artifact ? { provenance: artifact.provenance } : {}),
				href: `/v1/crosswalks/${id}`,
			};
		});

		const validationIds = [
			"atlas",
			`boundary-releases/${releaseIdentity}`,
			...crosswalkIds.map((id) => `crosswalks/${id}`),
		];
		const validation = validationReport
			? {
					status: "available" as const,
					reportHash: validationReport.contentHash,
					resources: validationIds.map((id) => {
						const resource = validationReport.resources.find(
							(candidate) => candidate.id === id,
						);
						const href =
							id === "atlas"
								? "/v1/validation"
								: `/v1/validation/${id}`;
						return resource
							? { ...resource, href }
							: { id, status: "not-validated" as const };
					}),
				}
			: { status: "not-published" as const };

		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${releaseIdentity}/${code}`,
				geography,
				boundaryRelease,
				...area,
				atlasRelease: atlasRelease
					? {
							id: releaseId,
							href: `/v1/atlas-releases/${releaseId}`,
						}
					: { id: releaseId, status: "not-published" as const },
				identity: identityArtifact
					? identityArtifact.status === "available"
						? {
								status: "available" as const,
								artifact: identityArtifact.artifact,
								contentHash: identityArtifact.contentHash,
								...(identityArtifact.derivedFrom
									? {
											derivedFrom:
												identityArtifact.derivedFrom,
										}
									: {}),
							}
						: {
								status: identityArtifact.status,
								reason: identityArtifact.reason,
							}
					: { status: "not-published" as const },
				boundary: {
					id: releaseIdentity,
					title: release.title,
					publisher: release.source.publisher,
					sourceUrl: release.source.url,
					...(release.source.retrievedAt
						? { retrievedAt: release.source.retrievedAt }
						: {}),
					licence: release.source.licence,
					metadataHash: release.metadataHash,
					href: `/v1/boundary-releases/${releaseIdentity}`,
				},
				geometry,
				measures,
				crosswalks,
				validation,
				resources: attribution.resources,
				licences: attribution.licences,
				text: attributionText(
					attribution.resources,
					attribution.licences,
					releaseId,
				),
				note: "Hashes pin the artifacts this Atlas release serves for the area. Licence names are reproduced as the publisher states them and are not interpreted here.",
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "capabilities"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
		const geometry = (() => {
			if (!areaGeometryCache)
				return { status: "not-published" as const, href: geometryHref };
			try {
				return areaGeometryCache.get(geography, boundaryRelease, code)
					? {
							status: "available" as const,
							href: geometryHref,
							provenance: areaGeometryCache.provenance(
								geography,
								boundaryRelease,
								code,
							),
						}
					: { status: "not-found" as const, href: geometryHref };
			} catch (error) {
				return {
					status: "unavailable" as const,
					href: geometryHref,
					reason:
						error instanceof Error
							? error.message
							: "Geometry could not be loaded.",
				};
			}
		})();
		const relationships = crosswalkLookup
			? relationshipsFor(
					areaRelationshipIndex,
					crosswalkLookup,
					geography,
					boundaryRelease,
					code,
				)
			: [];
		const relationCount = (relation: string) =>
			relationships.filter((candidate) => candidate.relation === relation)
				.length;
		const crosswalks = [
			...new Map(
				relationships.map((relationship) => [
					relationship.crosswalk.id,
					relationship.crosswalk,
				]),
			).values(),
		].map((crosswalk) => ({
			...crosswalk,
			href: `/v1/crosswalks/${crosswalk.id}`,
		}));
		const data =
			dataCatalog && measureCompatibilityInventory
				? {
						status: "available" as const,
						measures: dataCatalog.measures.flatMap((measure) => {
							const coverage = measureCoverage(
								dataCatalog,
								measureCompatibilityInventory,
								measure.id,
							);
							const sources = areaMeasureSources(
								measure,
								coverage,
								boundaryRelease,
								code,
								{
									populationObservations,
									populationLocalAuthorityObservations,
									measureObservations,
								},
							);
							return sources.length > 0
								? [
										{
											id: measure.id,
											valueKind: measure.valueKind,
											unit: measure.unit,
											availability: measure.availability,
											href: `/v1/measures/${measure.id}`,
											sources,
										},
									]
								: [];
						}),
						note: "Compatibility compares area-code membership only. It does not assert equal geometry between a source and this boundary release.",
					}
				: { status: "not-published" as const };
		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${geography}/${boundaryRelease}/${code}`,
				geography,
				boundaryRelease,
				...area,
				capabilities: {
					geometry,
					relationships: crosswalkLookup
						? {
								status: "available" as const,
								href: `/v1/areas/${geography}/${boundaryRelease}/${code}/relationships`,
								count: relationships.length,
								byRelation: Object.fromEntries(
									[
										...new Set(
											relationships.map(
												(relationship) =>
													relationship.relation,
											),
										),
									].map((relation) => [
										relation,
										relationCount(relation),
									]),
								),
								parents: {
									count: relationCount("within"),
									href: `/v1/areas/${geography}/${boundaryRelease}/${code}/parents`,
								},
								children: {
									count: relationCount("contains"),
									href: `/v1/areas/${geography}/${boundaryRelease}/${code}/children`,
								},
								crosswalks,
							}
						: { status: "not-published" as const },
					namedLocations: namedLocationInventory
						? {
								status: "available" as const,
								membership: "direct-code-match" as const,
								locations: namedLocationInventory.locations
									.filter((location) =>
										location.memberCodes.includes(code),
									)
									.map((location) => ({
										id: location.id,
										label: location.label,
										href: `/v1/locations/${location.id}/members?geography=${geography}&release=${boundaryRelease}`,
									})),
								note: "Named locations are editorial groupings. Membership is a direct code match and does not assert an official geography or equal geometry.",
							}
						: { status: "not-published" as const },
					data,
				},
			}),
		};
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
