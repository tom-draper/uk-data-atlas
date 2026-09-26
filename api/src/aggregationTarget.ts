import type { CrosswalkArtifact } from "./crosswalkInventory";
import type { MeasureSource } from "./dataCatalog";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "./measureCompatibility";
import {
	membershipClaimFor,
	membershipThroughSteps,
	pathMembershipClaims,
} from "./aggregationMembership";
import type { GeographyResolver } from "./geographyResolver";
import { problem, type ApiResponse } from "./routeResponse";
import { areaKey } from "./geographyKeys";

export type AggregationTarget = {
	/** The caller-selected crosswalk, when membership comes from one. */
	crosswalk?: CrosswalkArtifact;
	/** The caller-selected published path, when membership is composed. */
	path?: {
		id: string;
		steps: Array<{ crosswalk: CrosswalkArtifact; claim: string }>;
	};
	claim: string;
	sourceRelease: string;
	memberCodes: Set<string>;
	target: {
		id: string;
		geography: string;
		boundaryRelease: string;
		code: string;
		[key: string]: unknown;
	};
};

const refuse = (detail: string) =>
	problem(422, "Operation Not Supported", detail, {
		code: "conversion_not_available",
	});

/** Resolve an explicit membership target without inferring a crosswalk. */
export const resolveAggregationTarget = ({
	targetCode,
	regionCode,
	crosswalkId,
	pathId,
	sourceRelease,
	source,
	compatibleReleases,
	geographyResolver,
	measureCompatibilityInventory,
}: {
	targetCode: string | null;
	regionCode: string | null;
	crosswalkId: string | null;
	pathId: string | null;
	sourceRelease: string | null;
	source: MeasureSource;
	compatibleReleases: CompatibilityCandidate[];
	geographyResolver: GeographyResolver;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
}): AggregationTarget | ApiResponse | undefined => {
	if (!targetCode) return undefined;
	if (crosswalkId && pathId)
		return problem(
			400,
			"Invalid Query",
			"Name either crosswalk or path, not both. A path already names every crosswalk it uses.",
		);
	if ((!crosswalkId && !pathId) || !sourceRelease) {
		return problem(
			400,
			"Invalid Query",
			"targetCode aggregation requires crosswalk, or a published membership path, and sourceRelease, so membership is explicit rather than inferred.",
		);
	}
	if (!measureCompatibilityInventory) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build crosswalk and measure compatibility inventories before aggregating over a membership crosswalk.",
		);
	}
	const compatibility = compatibleReleases.find(
		(candidate) => candidate.boundaryRelease === sourceRelease,
	);
	if (!compatibility)
		return refuse(
			"The requested sourceRelease is not code-set compatible with this source partition.",
		);
	// One crosswalk, or every step of a published path; either way the
	// caller names the route, and it must start on the selected release.
	let route: {
		from: { geography: string; boundaryRelease: string };
		to: { geography: string; boundaryRelease: string };
		crosswalks: CrosswalkArtifact[];
		/** Why the route establishes membership, or why it cannot. */
		claim: () =>
			{ claim: string; path?: AggregationTarget["path"] } | ApiResponse;
		pathId?: string;
	};
	if (crosswalkId) {
		const crosswalk = geographyResolver.crosswalk(crosswalkId);
		if (
			!crosswalk ||
			crosswalk.from.geography !== source.sourceGeography.type ||
			crosswalk.from.boundaryRelease !== sourceRelease
		)
			return refuse(
				"That crosswalk does not map the caller-selected compatible source release.",
			);
		route = {
			from: crosswalk.from,
			to: crosswalk.to,
			crosswalks: [crosswalk],
			claim: () => {
				const claim = membershipClaimFor(crosswalk);
				return claim
					? { claim }
					: refuse(
							`The ${crosswalk.method} crosswalk ${crosswalk.id} does not declare membership, so its records are conversion data rather than the parts of one area.`,
						);
			},
		};
	} else {
		const path = geographyResolver.relationshipPath(pathId!);
		if (!path)
			return problem(
				404,
				"Not Found",
				"No published relationship path matches that id.",
			);
		if (
			path.from.geography !== source.sourceGeography.type ||
			path.from.boundaryRelease !== sourceRelease
		)
			return refuse(
				"That path does not start on the caller-selected compatible source release.",
			);
		const indexed = geographyResolver.indexedPathSteps(path);
		if ("missingCrosswalkId" in indexed)
			return problem(
				503,
				"Catalogue Unavailable",
				`The crosswalk ${indexed.missingCrosswalkId} required by path ${path.id} is not built.`,
			);
		route = {
			from: path.from,
			to: path.to,
			crosswalks: indexed.steps.map(({ artifact }) => artifact),
			pathId: path.id,
			claim: () => {
				const claims = pathMembershipClaims(indexed.steps);
				if ("refusal" in claims) return refuse(claims.refusal);
				return {
					claim: "composed-membership-path",
					path: {
						id: path.id,
						steps: indexed.steps.map(({ artifact }, index) => ({
							crosswalk: artifact,
							claim: claims.claims[index]!,
						})),
					},
				};
			},
		};
	}
	const noun = route.pathId ? "path" : "crosswalk";
	if (regionCode && route.to.geography !== "region")
		return refuse(
			`That ${noun} does not map to regions. Use targetCode to aggregate onto another geography.`,
		);
	const established = route.claim();
	if ("status" in established) return established;
	const membership = membershipThroughSteps(route.crosswalks, targetCode);
	if (!membership || membership.unsafeSourceCount > 0)
		return refuse(
			`The selected ${route.to.geography} is not represented by complete one-to-one source-area membership in that ${noun}.`,
		);
	if (membership.memberCodes.length === 0)
		return problem(
			404,
			"Not Found",
			`${route.pathId ?? route.crosswalks[0]!.id} maps no ${route.from.geography} to ${targetCode}.`,
		);
	return {
		...(established.path
			? { path: established.path }
			: { crosswalk: route.crosswalks[0]! }),
		claim: established.claim,
		sourceRelease,
		memberCodes: new Set(membership.memberCodes),
		target: {
			id: areaKey(
				route.to.geography,
				route.to.boundaryRelease,
				targetCode,
			),
			geography: route.to.geography,
			boundaryRelease: route.to.boundaryRelease,
			code: targetCode,
			...geographyResolver.area({
				geography: route.to.geography,
				boundaryRelease: route.to.boundaryRelease,
				code: targetCode,
			}),
		},
	};
};
