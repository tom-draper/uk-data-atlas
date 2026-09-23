import type { CrosswalkArtifact } from "./crosswalkInventory";
import type { MeasureSource } from "./dataCatalog";
import type {
	CompatibilityCandidate,
	MeasureCompatibilityInventory,
} from "./measureCompatibility";
import { fullMembership, membershipClaimFor } from "./aggregationMembership";
import type { GeographyResolver } from "./geographyResolver";
import { problem, type ApiResponse } from "./routeResponse";

export type AggregationTarget = {
	crosswalk: CrosswalkArtifact;
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

/** Resolve an explicit membership target without inferring a crosswalk. */
export const resolveAggregationTarget = ({
	targetCode,
	regionCode,
	crosswalkId,
	sourceRelease,
	source,
	compatibleReleases,
	geographyResolver,
	measureCompatibilityInventory,
}: {
	targetCode: string | null;
	regionCode: string | null;
	crosswalkId: string | null;
	sourceRelease: string | null;
	source: MeasureSource;
	compatibleReleases: CompatibilityCandidate[];
	geographyResolver: GeographyResolver;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
}): AggregationTarget | ApiResponse | undefined => {
	if (!targetCode) return undefined;
	if (!crosswalkId || !sourceRelease) {
		return problem(
			400,
			"Invalid Query",
			"targetCode aggregation requires crosswalk and sourceRelease, so membership is explicit rather than inferred.",
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
	if (!compatibility) {
		return problem(
			422,
			"Operation Not Supported",
			"The requested sourceRelease is not code-set compatible with this source partition.",
			{ code: "conversion_not_available" },
		);
	}
	const crosswalk = geographyResolver.crosswalk(crosswalkId);
	if (
		!crosswalk ||
		crosswalk.from.geography !== source.sourceGeography.type ||
		crosswalk.from.boundaryRelease !== sourceRelease
	) {
		return problem(
			422,
			"Operation Not Supported",
			"That crosswalk does not map the caller-selected compatible source release.",
			{ code: "conversion_not_available" },
		);
	}
	if (regionCode && crosswalk.to.geography !== "region") {
		return problem(
			422,
			"Operation Not Supported",
			"That crosswalk does not map to regions. Use targetCode to aggregate onto another geography.",
			{ code: "conversion_not_available" },
		);
	}
	const claim = membershipClaimFor(crosswalk);
	if (!claim) {
		return problem(
			422,
			"Operation Not Supported",
			`The ${crosswalk.method} crosswalk ${crosswalk.id} does not declare membership, so its records are conversion data rather than the parts of one area.`,
			{ code: "conversion_not_available" },
		);
	}
	const membership = fullMembership(crosswalk, targetCode);
	if (!membership || membership.unsafeSourceCount > 0) {
		return problem(
			422,
			"Operation Not Supported",
			`The selected ${crosswalk.to.geography} is not represented by complete one-to-one source-area membership in that crosswalk.`,
			{ code: "conversion_not_available" },
		);
	}
	if (membership.memberCodes.length === 0) {
		return problem(
			404,
			"Not Found",
			`${crosswalk.id} maps no ${crosswalk.from.geography} to ${targetCode}.`,
		);
	}
	return {
		crosswalk,
		claim,
		sourceRelease,
		memberCodes: new Set(membership.memberCodes),
		target: {
			id: `${crosswalk.to.geography}/${crosswalk.to.boundaryRelease}/${targetCode}`,
			geography: crosswalk.to.geography,
			boundaryRelease: crosswalk.to.boundaryRelease,
			code: targetCode,
			...geographyResolver.area({ geography: crosswalk.to.geography, boundaryRelease: crosswalk.to.boundaryRelease, code: targetCode }),
		},
	};
};
