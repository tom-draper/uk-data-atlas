import { createHash } from "node:crypto";
import type { AreaLookup } from "./areaInventory";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import {
	isParentCrosswalk,
	memberReach,
	membersThroughCrosswalk,
	membershipKindFor,
	parentsThroughCrosswalk,
	type MemberReach,
	type MembershipKind,
	type ParentProjection,
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
	reach: MemberReach;
	coverage: MemberCoverage;
};

type ProjectionVia = LocationProjection["via"];

/** A location seen from a coarser geography: which parents it covers or meets. */
export type LocationParentProjection = ParentProjection & {
	locationId: string;
	geography: string;
	boundaryRelease: string;
	via: ProjectionVia;
	memberGeography: string;
	memberBoundaryRelease: string;
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
	/** One shard per crosswalk from the member geography to a coarser one. */
	parentShards: Array<{
		crosswalkId: string;
		geography: string;
		boundaryRelease: string;
		recordCount: number;
		artifact: string;
		contentHash: string;
	}>;
};

export type LocationParentProjectionArtifact = {
	schemaVersion: 1;
	contentHash: string;
	namedLocationInventoryHash: string;
	crosswalkInventoryHash: string;
	crosswalkId: string;
	parentProjections: LocationParentProjection[];
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
 * location's direct members in its declared geography. This is deliberately a
 * compiler operation: request handlers only select a projection and join its
 * area names.
 */
const compileLocationProjectionArtifact = (
	namedLocations: NamedLocationInventory,
	crosswalkInventoryHash: string,
	summary: CrosswalkInventory["crosswalks"][number],
	crosswalk: CrosswalkArtifact,
	areaLookup: AreaLookup,
): LocationProjectionArtifact | undefined => {
	const memberGeography = crosswalk.to.geography;
	const locations = namedLocations.locations.filter(
		(location) => location.memberGeography === memberGeography,
	);
	if (locations.length === 0) return undefined;
	const parents = areaLookup.get(
		`${memberGeography}/${crosswalk.to.boundaryRelease}`,
	);
	if (!parents) {
		throw new Error(
			`${crosswalk.id}: cannot materialise location membership because ${memberGeography}/${crosswalk.to.boundaryRelease} has no compiled areas.`,
		);
	}
	const projections = locations.map(
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
				partialMembers: members.filter((member) => member.partial)
					.length,
				parentGeography: memberGeography,
				parentBoundaryRelease: crosswalk.to.boundaryRelease,
				reach: memberReach(crosswalk, parentCodes),
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

const viaFor = (
	summary: CrosswalkInventory["crosswalks"][number],
	crosswalk: CrosswalkArtifact,
): ProjectionVia => ({
	id: crosswalk.id,
	method: crosswalk.method,
	quality: crosswalk.quality,
	weighting: crosswalk.weighting,
	from: crosswalk.from,
	to: crosswalk.to,
	contentHash: summary.contentHash,
});

/**
 * Materialise, for every location, the parents a crosswalk out of the member
 * geography places its members in, and whether it covers each.
 */
const compileLocationParentArtifact = (
	namedLocations: NamedLocationInventory,
	crosswalkInventoryHash: string,
	summary: CrosswalkInventory["crosswalks"][number],
	crosswalk: CrosswalkArtifact,
	areaLookup: AreaLookup,
): LocationParentProjectionArtifact | undefined => {
	const memberGeography = crosswalk.from.geography;
	if (
		crosswalk.to.geography === memberGeography ||
		!isParentCrosswalk(crosswalk)
	)
		return undefined;
	const locations = namedLocations.locations.filter(
		(location) => location.memberGeography === memberGeography,
	);
	if (locations.length === 0) return undefined;
	const members = areaLookup.get(
		`${memberGeography}/${crosswalk.from.boundaryRelease}`,
	);
	if (!members) {
		throw new Error(
			`${crosswalk.id}: cannot materialise location parents because ${memberGeography}/${crosswalk.from.boundaryRelease} has no compiled areas.`,
		);
	}
	const parentProjections = locations
		.map((location): LocationParentProjection => {
			const memberCodes = new Set(
				location.memberCodes.filter((code) => members.has(code)),
			);
			return {
				locationId: location.id,
				geography: crosswalk.to.geography,
				boundaryRelease: crosswalk.to.boundaryRelease,
				via: viaFor(summary, crosswalk),
				memberGeography,
				memberBoundaryRelease: crosswalk.from.boundaryRelease,
				...parentsThroughCrosswalk(crosswalk, memberCodes),
				coverage: reconcileMembers(
					areaLookup,
					memberGeography,
					crosswalk.from.boundaryRelease,
					location.memberCodes,
					memberCodes,
				),
			};
		})
		.sort((left, right) => left.locationId.localeCompare(right.locationId));
	const content = JSON.stringify({
		schemaVersion: 1,
		namedLocationInventoryHash: namedLocations.contentHash,
		crosswalkInventoryHash,
		crosswalkId: crosswalk.id,
		parentProjections,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		namedLocationInventoryHash: namedLocations.contentHash,
		crosswalkInventoryHash,
		crosswalkId: crosswalk.id,
		parentProjections,
	};
};

/** Compiles one shard per crosswalk, avoiding a monolithic location matrix. */
export const compileLocationProjections = (
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
	crosswalks: Iterable<CrosswalkArtifact>,
	areaLookup: AreaLookup,
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
		);
		return artifact ? [artifact] : [];
	});
	const shards = artifacts
		.map((artifact) => {
			const first = artifact.projections[0];
			if (!first)
				throw new Error(`${artifact.crosswalkId}: no projections.`);
			return {
				crosswalkId: artifact.crosswalkId,
				geography: first.geography,
				boundaryRelease: first.boundaryRelease,
				recordCount: artifact.projections.length,
				artifact: `location-projections/${artifact.crosswalkId}.json`,
				contentHash: artifact.contentHash,
			};
		})
		.sort((left, right) =>
			left.crosswalkId.localeCompare(right.crosswalkId),
		);
	const parentArtifacts = crosswalkInventory.crosswalks.flatMap((summary) => {
		const crosswalk = crosswalkById.get(summary.id);
		if (!crosswalk) return [];
		const artifact = compileLocationParentArtifact(
			namedLocations,
			crosswalkInventory.contentHash,
			summary,
			crosswalk,
			areaLookup,
		);
		return artifact ? [artifact] : [];
	});
	const parentShards = parentArtifacts
		.map((artifact) => {
			const first = artifact.parentProjections[0];
			if (!first)
				throw new Error(`${artifact.crosswalkId}: no projections.`);
			return {
				crosswalkId: artifact.crosswalkId,
				geography: first.geography,
				boundaryRelease: first.boundaryRelease,
				recordCount: artifact.parentProjections.length,
				artifact: `location-parent-projections/${artifact.crosswalkId}.json`,
				contentHash: artifact.contentHash,
			};
		})
		.sort((left, right) =>
			left.crosswalkId.localeCompare(right.crosswalkId),
		);
	const content = JSON.stringify({
		schemaVersion: 1,
		namedLocationInventoryHash: namedLocations.contentHash,
		crosswalkInventoryHash: crosswalkInventory.contentHash,
		shards,
		parentShards,
	});
	return {
		inventory: {
			schemaVersion: 1 as const,
			contentHash: sha256(content),
			namedLocationInventoryHash: namedLocations.contentHash,
			crosswalkInventoryHash: crosswalkInventory.contentHash,
			shards,
			parentShards,
		},
		artifacts,
		parentArtifacts,
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
	private readonly parentShards = new Map<
		string,
		LocationProjectionInventory["parentShards"][number]
	>();
	private readonly parentLookups = new Map<
		string,
		Map<string, LocationParentProjection>
	>();

	constructor(
		inventory: LocationProjectionInventory,
		private readonly load: (
			shard: LocationProjectionInventory["shards"][number],
		) => LocationProjectionArtifact,
		private readonly loadParents?: (
			shard: LocationProjectionInventory["parentShards"][number],
		) => LocationParentProjectionArtifact,
	) {
		for (const shard of inventory.shards)
			this.shards.set(shard.crosswalkId, shard);
		for (const shard of inventory.parentShards ?? [])
			this.parentShards.set(shard.crosswalkId, shard);
	}

	/** Crosswalks with parent projections into a geography and release. */
	parentCrosswalks(geography: string, boundaryRelease: string) {
		return [...this.parentShards.values()].filter(
			(shard) =>
				shard.geography === geography &&
				shard.boundaryRelease === boundaryRelease,
		);
	}

	parents(
		locationId: string,
		crosswalkId: string,
	): LocationParentProjection | undefined {
		const shard = this.parentShards.get(crosswalkId);
		if (!shard || !this.loadParents) return undefined;
		let lookup = this.parentLookups.get(crosswalkId);
		if (!lookup) {
			const artifact = this.loadParents(shard);
			if (artifact.contentHash !== shard.contentHash) {
				throw new Error(
					`${crosswalkId}: location parent projection hash mismatch.`,
				);
			}
			lookup = new Map(
				artifact.parentProjections.map((projection) => [
					projection.locationId,
					projection,
				]),
			);
			this.parentLookups.set(crosswalkId, lookup);
		}
		return lookup.get(locationId);
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
				throw new Error(
					`${crosswalkId}: location projection hash mismatch.`,
				);
			}
			lookup = createLocationProjectionLookup(artifact);
			this.lookups.set(crosswalkId, lookup);
		}
		return lookup.get(
			locationProjectionKey(
				locationId,
				geography,
				boundaryRelease,
				crosswalkId,
			),
		);
	}
}
