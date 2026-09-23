import type { AreaLookup, AreaRecord } from "../areaInventory";
import type { BoundaryRegistry } from "../boundaryRegistry";
import type { RelationshipCandidateInventory } from "../relationshipCandidates";
import type { AreaRelation, AreaRelationship } from "../areaRelationships";
import type { RelationshipPurpose } from "../relationshipPaths";
import type { AreaIdentity, GeographyEndpoint } from "./areas";
import {
	ConversionCapabilities,
	type GeographyReach,
	type RelationshipOperation,
	type ResolvedConversionPlan,
	type ResolvedRelationshipCapability,
} from "./conversionCapability";
import type { CrosswalkTranslator } from "./translation";
import { releaseKey } from "../geographyKeys";
import { areaId } from "./areas";

export {
	RELATIONSHIP_OPERATIONS,
	type GeographyReach,
	type RelationshipOperation,
	type RelationshipPathStepCoverage,
	type RelationshipPrerequisite,
	type ResolvedConversionPlan,
	type ResolvedRelationshipCapability,
	type ResolvedRelationshipPath,
} from "./conversionCapability";

export type ResolvedRelationshipCoverage = {
	areaCount: number;
	relatedAreaCount: number;
	relationshipCount: number;
	byRelation: Partial<Record<AreaRelation, number>>;
	crosswalkIds: string[];
	uncoveredAreas: Array<AreaRecord & { id: string }>;
};

export type GeographyHealth = {
	geography: string;
	boundaryRelease: string;
	status: "available" | "partial" | "unsupported" | "not-built";
	areaCount: number;
	relatedAreaCount: number;
	gapCount: number;
	countries: string[];
	reach: GeographyReach;
};

export type RelationshipRepair = {
	candidate: RelationshipCandidateInventory["candidates"][number];
	action: "publish-crosswalk" | "review-candidate" | "compile-target-release";
};

export type CapabilityResolverInputs = {
	areaLookup?: AreaLookup;
	boundaryRegistry?: BoundaryRegistry;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
};

/** Conversion evidence, release coverage, operational health and repair advice. */
export class CapabilityResolver {
	private readonly conversions: ConversionCapabilities;

	constructor(
		inputs: CapabilityResolverInputs & ConstructorParameters<typeof ConversionCapabilities>[0],
		translator: CrosswalkTranslator,
		private readonly relationships: (identity: AreaIdentity) => AreaRelationship[],
		private readonly hasRelationships: () => boolean,
		private readonly boundaryRelease: (geography: string, release: string) => BoundaryRegistry["releases"][number] | undefined,
	) {
		this.inputs = inputs;
		this.conversions = new ConversionCapabilities(inputs, translator);
	}
	private readonly inputs: CapabilityResolverInputs;

	relationshipCapability(from: GeographyEndpoint, to: GeographyEndpoint, purpose: RelationshipPurpose): ResolvedRelationshipCapability {
		return this.conversions.relationshipCapability(from, to, purpose);
	}
	conversionPlan(from: GeographyEndpoint, to: GeographyEndpoint, purpose: RelationshipPurpose, operation?: RelationshipOperation): ResolvedConversionPlan {
		return this.conversions.conversionPlan(from, to, purpose, operation);
	}
	relationshipCapabilitiesFrom(from: GeographyEndpoint) { return this.conversions.relationshipCapabilitiesFrom(from); }

	relationshipCoverage(geography: string, boundaryRelease: string, relation?: AreaRelation, limit = 25): ResolvedRelationshipCoverage | undefined {
		const areas = this.inputs.areaLookup?.get(releaseKey(geography, boundaryRelease));
		if (!areas || !this.hasRelationships()) return undefined;
		const byRelation: Partial<Record<AreaRelation, number>> = {};
		const crosswalkIds = new Set<string>();
		let relatedAreaCount = 0;
		let relationshipCount = 0;
		const uncoveredAreas: ResolvedRelationshipCoverage["uncoveredAreas"] = [];
		for (const [code, area] of areas) {
			const relationships = this.relationships({ geography, boundaryRelease, code }).filter((candidate) => !relation || candidate.relation === relation);
			if (relationships.length > 0) {
				relatedAreaCount += 1;
				relationshipCount += relationships.length;
				for (const candidate of relationships) {
					byRelation[candidate.relation] = (byRelation[candidate.relation] ?? 0) + 1;
					crosswalkIds.add(candidate.crosswalk.id);
				}
			} else if (uncoveredAreas.length < limit) uncoveredAreas.push({ id: areaId({ geography, boundaryRelease, code }), ...area });
		}
		return { areaCount: areas.size, relatedAreaCount, relationshipCount, byRelation, crosswalkIds: [...crosswalkIds].sort(), uncoveredAreas };
	}

	geographyHealth(): GeographyHealth[] {
		if (!this.inputs.areaLookup) return [];
		const reach = this.conversions.conversionReach();
		return [...this.inputs.areaLookup.keys()].map((identity) => {
			const [geography, boundaryRelease] = identity.split("/", 2) as [string, string];
			const coverage = this.relationshipCoverage(geography, boundaryRelease, undefined, 1);
			const areaCount = this.inputs.areaLookup?.get(identity)?.size ?? 0;
			const countries = this.boundaryRelease(geography, boundaryRelease)?.coverage.countries ?? [];
			const found = reach.get(identity) ?? { status: "isolated" as const, reaches: [], reachedFrom: [], vintagePathCount: 0 };
			if (!coverage) return { geography, boundaryRelease, status: "not-built" as const, areaCount, relatedAreaCount: 0, gapCount: areaCount, countries, reach: found };
			return { geography, boundaryRelease, status: coverage.relatedAreaCount === coverage.areaCount ? "available" as const : coverage.relatedAreaCount > 0 ? "partial" as const : "unsupported" as const, areaCount: coverage.areaCount, relatedAreaCount: coverage.relatedAreaCount, gapCount: coverage.areaCount - coverage.relatedAreaCount, countries, reach: found };
	}).sort((left, right) => releaseKey(left.geography, left.boundaryRelease).localeCompare(releaseKey(right.geography, right.boundaryRelease)));
	}

	relationshipRepairs(): RelationshipRepair[] {
		const actionFor = (candidate: RelationshipRepair["candidate"]): RelationshipRepair["action"] => candidate.status === "eligible" ? "publish-crosswalk" : candidate.status === "needs-review" ? "review-candidate" : "compile-target-release";
		const order = { "publish-crosswalk": 0, "review-candidate": 1, "compile-target-release": 2 } as const;
		return (this.inputs.relationshipCandidateInventory?.candidates ?? []).filter((candidate) => !candidate.publishedCrosswalkId).map((candidate) => ({ candidate, action: actionFor(candidate) })).sort((left, right) => order[left.action] - order[right.action] || left.candidate.id.localeCompare(right.candidate.id));
	}
}
