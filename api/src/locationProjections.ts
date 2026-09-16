import { createHash } from "node:crypto";
import type { AreaLookup } from "./areaInventory";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import {
	membersThroughCrosswalk,
	membershipKindFor,
	type MembershipKind,
	type TraversedMember,
} from "./locationMembership";
import { reconcileMembers, type MemberCoverage } from "./memberReconciliation";
import type { NamedLocationInventory } from "./namedLocations";

export type LocationProjection = {
	locationId: string;
	geography: string;
	boundaryRelease: string;
	membership: MembershipKind;
	via: {
		id: string;
		method: CrosswalkArtifact["method"];
		quality: CrosswalkArtifact["quality"];
		weighting: CrosswalkArtifact["weighting"];
		from: CrosswalkArtifact["from"];
		to: CrosswalkArtifact["to"];
		contentHash: string;
	};
	members: TraversedMember[];
	partialMembers: number;
	parentGeography: string;
	parentBoundaryRelease: string;
	coverage: MemberCoverage;
};

export type LocationProjectionInventory = {
	schemaVersion: 1;
	contentHash: string;
	namedLocationInventoryHash: string;
	crosswalkInventoryHash: string;
	shards: Array<{
		crosswalkId: string;
		geography: string;
		boundaryRelease: string;
		recordCount: number;
		artifact: string;
		contentHash: string;
	}>;
};

export type LocationProjectionArtifact = {
	schemaVersion: 1;
	contentHash: string;
	namedLocationInventoryHash: string;
	crosswalkInventoryHash: string;
	crosswalkId: string;
	projections: LocationProjection[];
};

export type LocationProjectionLookup = Map<string, LocationProjection>;

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

export const locationProjectionKey = (
	locationId: string,
	geography: string,
	boundaryRelease: string,
	crosswalkId: string,
) => [locationId, geography, boundaryRelease, crosswalkId].join("/");

/**
 * Materialise every published route from a target geography into a named
 * location's direct local-authority members. This is deliberately a compiler
 * operation: request handlers only select a projection and join its area names.
 */
const compileLocationProjectionArtifact = (
	namedLocations: NamedLocationInventory,
	crosswalkInventoryHash: string,
	summary: CrosswalkInventory["crosswalks"][number],
	crosswalk: CrosswalkArtifact,
	areaLookup: AreaLookup,
	memberGeography = "localAuthority",

): LocationProjectionArtifact | undefined => {
	if (crosswalk.to.geography !== memberGeography) return undefined;
	const parents = areaLookup.get(
		`${memberGeography}/${crosswalk.to.boundaryRelease}`,
	);
	if (!parents) {
		throw new Error(
			`${crosswalk.id}: cannot materialise location membership because ${memberGeography}/${crosswalk.to.boundaryRelease} has no compiled areas.`,
		);
	}
	const projections = namedLocations.locations.map(
		(location): LocationProjection => {
			const parentCodes = new Set(
				location.memberCodes.filter((code) => parents.has(code)),
			);
			const members = membersThroughCrosswalk(crosswalk, parentCodes);
			return {
				locationId: location.id,
				geography: crosswalk.from.geography,
				boundaryRelease: crosswalk.from.boundaryRelease,
				membership: membershipKindFor(crosswalk),
				via: {
					id: crosswalk.id,
					method: crosswalk.method,
					quality: crosswalk.quality,
					weighting: crosswalk.weighting,
					from: crosswalk.from,
					to: crosswalk.to,
					contentHash: summary.contentHash,
				},
				members,
				partialMembers: members.filter((member) => member.partial).length,
				parentGeography: memberGeography,
				parentBoundaryRelease: crosswalk.to.boundaryRelease,
				coverage: reconcileMembers(
					areaLookup,
					memberGeography,
					crosswalk.to.boundaryRelease,
					location.memberCodes,
					parentCodes,
				),
			};
		},
	);
	projections.sort((left, right) => {
		const key = locationProjectionKey(
			left.locationId,
			left.geography,
			left.boundaryRelease,
			left.via.id,
		);
		const other = locationProjectionKey(
			right.locationId,
			right.geography,
			right.boundaryRelease,
			right.via.id,
		);
		return key.localeCompare(other);
	});
	const content = JSON.stringify({
		schemaVersion: 1,
		namedLocationInventoryHash: namedLocations.contentHash,
		crosswalkInventoryHash,
		crosswalkId: crosswalk.id,
		projections,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		namedLocationInventoryHash: namedLocations.contentHash,
		crosswalkInventoryHash,
		crosswalkId: crosswalk.id,
		projections,
	};
};

/** Compiles one shard per crosswalk, avoiding a monolithic location matrix. */
export const compileLocationProjections = (
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
	crosswalks: Iterable<CrosswalkArtifact>,
	areaLookup: AreaLookup,
	memberGeography = "localAuthority",
) => {
	const crosswalkById = new Map(
		[...crosswalks].map((crosswalk) => [crosswalk.id, crosswalk]),
	);
	const artifacts = crosswalkInventory.crosswalks.flatMap((summary) => {
		const crosswalk = crosswalkById.get(summary.id);
		if (!crosswalk) return [];
		const artifact = compileLocationProjectionArtifact(
			namedLocations,
			crosswalkInventory.contentHash,
			summary,
			crosswalk,
			areaLookup,
			memberGeography,
		);
		return artifact ? [artifact] : [];
	});
	const shards = artifacts
		.map((artifact) => {
			const first = artifact.projections[0];
			if (!first) throw new Error(`${artifact.crosswalkId}: no projections.`);
			return {
				crosswalkId: artifact.crosswalkId,
				geography: first.geography,
				boundaryRelease: first.boundaryRelease,
				recordCount: artifact.projections.length,
				artifact: `location-projections/${artifact.crosswalkId}.json`,
				contentHash: artifact.contentHash,
			};
		})
		.sort((left, right) => left.crosswalkId.localeCompare(right.crosswalkId));
	const content = JSON.stringify({
		schemaVersion: 1,
		namedLocationInventoryHash: namedLocations.contentHash,
		crosswalkInventoryHash: crosswalkInventory.contentHash,
		shards,
	});
	return {
		inventory: {
			schemaVersion: 1 as const,
			contentHash: sha256(content),
			namedLocationInventoryHash: namedLocations.contentHash,
			crosswalkInventoryHash: crosswalkInventory.contentHash,
			shards,
		},
		artifacts,
	};
};

export const createLocationProjectionLookup = (
	artifact: LocationProjectionArtifact,
): LocationProjectionLookup =>
	new Map(
		artifact.projections.map((projection) => [
			locationProjectionKey(
				projection.locationId,
				projection.geography,
				projection.boundaryRelease,
				projection.via.id,
			),
			projection,
		]),
	);

export class LocationProjectionStore {
	private readonly shards = new Map<
		string,
		LocationProjectionInventory["shards"][number]
	>();
	private readonly lookups = new Map<string, LocationProjectionLookup>();

	constructor(
		inventory: LocationProjectionInventory,
		private readonly load: (
			shard: LocationProjectionInventory["shards"][number],
		) => LocationProjectionArtifact,
	) {
		for (const shard of inventory.shards) this.shards.set(shard.crosswalkId, shard);
	}

	get(
		locationId: string,
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	): LocationProjection | undefined {
		const shard = this.shards.get(crosswalkId);
		if (
			!shard ||
			shard.geography !== geography ||
			shard.boundaryRelease !== boundaryRelease
		)
			return undefined;
		let lookup = this.lookups.get(crosswalkId);
		if (!lookup) {
			const artifact = this.load(shard);
			if (artifact.contentHash !== shard.contentHash) {
				throw new Error(`${crosswalkId}: location projection hash mismatch.`);
			}
			lookup = createLocationProjectionLookup(artifact);
			this.lookups.set(crosswalkId, lookup);
		}
		return lookup.get(
			locationProjectionKey(locationId, geography, boundaryRelease, crosswalkId),
		);
	}
}
