import type { AreaLookup } from "@uk-data-atlas/areas";
import type { CrosswalkArtifact } from "../relationships/crosswalkTypes";
import type { CrosswalkInventory } from "../relationships/crosswalkInventory";
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
import {
	reconcileMembers,
	type MemberCoverage,
} from "../relationships/memberReconciliation";
import type { NamedLocationInventory } from "./namedLocationTypes";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { SQLInputValue } from "node:sqlite";
import {
	jsonDictionary,
	packJson,
	SqliteIndex,
	unpackJson,
	type SqliteTable,
} from "../storage/sqliteIndex";

export type LocationProjection = {
	locationId: string;
	/** Curated location definition revision used to compile this projection. */
	locationDefinitionRevision: number;
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
	/** Curated location definition revision used to compile this projection. */
	locationDefinitionRevision: number;
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
	const projections = locations.map((location): LocationProjection => {
		const parentCodes = new Set(
			location.memberCodes.filter((code) => parents.has(code)),
		);
		const members = membersThroughCrosswalk(crosswalk, parentCodes);
		return {
			locationId: location.id,
			locationDefinitionRevision: location.definitionRevision,
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
			reach: memberReach(crosswalk, parentCodes),
			coverage: reconcileMembers(
				areaLookup,
				memberGeography,
				crosswalk.to.boundaryRelease,
				location.memberCodes,
				parentCodes,
			),
		};
	});
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
				locationDefinitionRevision: location.definitionRevision,
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

/**
 * How the member projection cache has behaved since the server started. A
 * rising eviction count says it holds too few shards for the traffic.
 */
export type LocationProjectionCacheStats = {
	maxShards: number;
	loadedShards: string[];
	/** Projection reads answered from a shard already in memory. */
	reads: number;
	loads: number;
	evictions: number;
	loadSeconds: number;
};

/**
 * Where location projections are read from: the shards a release lists, and
 * the projections themselves.
 */
export abstract class LocationProjections {
	protected readonly shards = new Map<
		string,
		LocationProjectionInventory["shards"][number]
	>();
	protected readonly parentShards = new Map<
		string,
		LocationProjectionInventory["parentShards"][number]
	>();

	constructor(inventory: LocationProjectionInventory) {
		for (const shard of inventory.shards)
			this.shards.set(shard.crosswalkId, shard);
		for (const shard of inventory.parentShards ?? [])
			this.parentShards.set(shard.crosswalkId, shard);
	}

	/** How the shard cache has behaved, where shards are cached. */
	abstract stats(): LocationProjectionCacheStats | undefined;

	abstract parents(
		locationId: string,
		crosswalkId: string,
	): LocationParentProjection | undefined;

	abstract get(
		locationId: string,
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	): LocationProjection | undefined;

	/** Crosswalks with parent projections into a geography and release. */
	parentCrosswalks(geography: string, boundaryRelease: string) {
		return [...this.parentShards.values()].filter(
			(shard) =>
				shard.geography === geography &&
				shard.boundaryRelease === boundaryRelease,
		);
	}

	/** Every materialised member projection shard, without loading its rows. */
	memberProjectionShards() {
		return [...this.shards.values()].sort((left, right) =>
			left.crosswalkId.localeCompare(right.crosswalkId),
		);
	}

	/** Every materialised parent projection shard, without loading its rows. */
	parentProjectionShards() {
		return [...this.parentShards.values()].sort((left, right) =>
			left.crosswalkId.localeCompare(right.crosswalkId),
		);
	}

	/** The member shard for a crosswalk, if it projects into this release. */
	protected memberShard(
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	) {
		const shard = this.shards.get(crosswalkId);
		return shard &&
			shard.geography === geography &&
			shard.boundaryRelease === boundaryRelease
			? shard
			: undefined;
	}
}

/** Projections read from their JSON shards, a few shards held at a time. */
export class LocationProjectionStore extends LocationProjections {
	/** Loaded member lookups by crosswalk, least recently used first. */
	private readonly lookups = new Map<string, LocationProjectionLookup>();
	private readonly parentLookups = new Map<
		string,
		Map<string, LocationParentProjection>
	>();
	private readonly counts = {
		reads: 0,
		loads: 0,
		evictions: 0,
		loadSeconds: 0,
	};

	constructor(
		inventory: LocationProjectionInventory,
		private readonly load: (
			shard: LocationProjectionInventory["shards"][number],
		) => LocationProjectionArtifact,
		private readonly loadParents?: (
			shard: LocationProjectionInventory["parentShards"][number],
		) => LocationParentProjectionArtifact,
		/**
		 * How many member shards stay in memory. Most are well under a
		 * megabyte, but the LSOA shards are some 13 MB on disk and 20 MB of
		 * heap once read, so a handful of them is the most worth holding.
		 * Parent shards are a few megabytes in all and are kept without a
		 * limit.
		 */
		private readonly capacity = 8,
	) {
		super(inventory);
	}

	stats(): LocationProjectionCacheStats {
		return {
			maxShards: this.capacity,
			loadedShards: [...this.lookups.keys()],
			...this.counts,
		};
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
		const shard = this.memberShard(geography, boundaryRelease, crosswalkId);
		if (!shard) return undefined;
		let lookup = this.lookups.get(crosswalkId);
		if (lookup) {
			this.counts.reads += 1;
			this.lookups.delete(crosswalkId);
			this.lookups.set(crosswalkId, lookup);
		} else {
			const started = performance.now();
			const artifact = this.load(shard);
			if (artifact.contentHash !== shard.contentHash) {
				throw new Error(
					`${crosswalkId}: location projection hash mismatch.`,
				);
			}
			lookup = createLocationProjectionLookup(artifact);
			this.lookups.set(crosswalkId, lookup);
			this.counts.loads += 1;
			this.counts.loadSeconds += (performance.now() - started) / 1000;
			if (this.lookups.size > this.capacity) {
				this.lookups.delete(this.lookups.keys().next().value!);
				this.counts.evictions += 1;
			}
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

/**
 * Write every member and parent projection to one database, each found by
 * its crosswalk and location, and deflated against a dictionary drawn from
 * its shard. A request then reads the one projection it needs rather than
 * parsing its whole shard.
 */
export const locationProjectionTables = ({
	artifacts,
	parentArtifacts,
}: Pick<
	ReturnType<typeof compileLocationProjections>,
	"artifacts" | "parentArtifacts"
>) => {
	const shards = [
		...artifacts.map((artifact) => ({
			table: "members",
			crosswalkId: artifact.crosswalkId,
			projections: artifact.projections,
			key: (projection: LocationProjection) =>
				locationProjectionKey(
					projection.locationId,
					projection.geography,
					projection.boundaryRelease,
					projection.via.id,
				),
		})),
		...parentArtifacts.map((artifact) => ({
			table: "parents",
			crosswalkId: artifact.crosswalkId,
			projections: artifact.parentProjections,
			key: (projection: LocationParentProjection) =>
				projection.locationId,
		})),
	].map((shard) => ({
		...shard,
		dictionary: jsonDictionary(shard.projections),
	}));
	const rows = (table: string) =>
		shards
			.filter((shard) => shard.table === table)
			.flatMap(({ crosswalkId, projections, key, dictionary }) =>
				projections.map((projection) => [
					crosswalkId,
					(key as (projection: unknown) => string)(projection),
					packJson(projection, dictionary),
				]),
			);
	return {
		location_projection_dictionaries: {
			columns: [
				"kind TEXT NOT NULL",
				"crosswalkId TEXT NOT NULL",
				"dictionary BLOB NOT NULL",
			],
			key: ["kind", "crosswalkId"],
			rows: shards.map(({ table, crosswalkId, dictionary }) => [
				table,
				crosswalkId,
				dictionary,
			]),
		},
		location_projection_members: {
			columns: [
				"crosswalkId TEXT NOT NULL",
				"key TEXT NOT NULL",
				"value BLOB NOT NULL",
			],
			key: ["crosswalkId", "key"],
			rows: rows("members"),
		},
		location_projection_parents: {
			columns: [
				"crosswalkId TEXT NOT NULL",
				"key TEXT NOT NULL",
				"value BLOB NOT NULL",
			],
			key: ["crosswalkId", "key"],
			rows: rows("parents"),
		},
	} satisfies Record<string, SqliteTable>;
};

/** Projections read a row at a time from their database. */
export class LocationProjectionDatabase extends LocationProjections {
	private readonly database: SqliteIndex;
	private readonly dictionary: (
		kind: string,
		crosswalkId: string,
	) => SQLInputValue | undefined;
	private readonly dictionaries = new Map<string, Uint8Array>();
	private readonly rows: Record<
		"members" | "parents",
		(crosswalkId: string, key: string) => SQLInputValue | undefined
	>;

	constructor(path: string, inventory: LocationProjectionInventory) {
		super(inventory);
		this.database = new SqliteIndex(path);
		const payload = this.database.lookup(
			"payloads",
			["id"],
			"payload",
		)("location-projection-inventory");
		if (typeof payload !== "string")
			throw new Error(`Missing location projection inventory at ${path}`);
		const recorded: LocationProjectionInventory = JSON.parse(payload);
		if (
			recorded.schemaVersion !== 1 ||
			recorded.contentHash !== inventory.contentHash ||
			recorded.namedLocationInventoryHash !==
				inventory.namedLocationInventoryHash ||
			recorded.crosswalkInventoryHash !== inventory.crosswalkInventoryHash
		)
			throw new Error(
				`The location projections at ${path} were built from another projection inventory.`,
			);
		this.dictionary = this.database.lookup(
			"location_projection_dictionaries",
			["kind", "crosswalkId"],
			"dictionary",
		);
		this.rows = {
			members: this.database.lookup(
				"location_projection_members",
				["crosswalkId", "key"],
				"value",
			),
			parents: this.database.lookup(
				"location_projection_parents",
				["crosswalkId", "key"],
				"value",
			),
		};
	}

	private read<T>(
		kind: "members" | "parents",
		crosswalkId: string,
		key: string,
	): T | undefined {
		const value = this.rows[kind](crosswalkId, key);
		if (value === undefined) return undefined;
		const id = `${kind}/${crosswalkId}`;
		let dictionary = this.dictionaries.get(id);
		if (!dictionary) {
			dictionary = this.dictionary(kind, crosswalkId) as Uint8Array;
			this.dictionaries.set(id, dictionary);
		}
		return unpackJson<T>(value, dictionary);
	}

	/** Nothing is cached but each shard's dictionary: a read is one row. */
	stats() {
		return undefined;
	}

	parents(locationId: string, crosswalkId: string) {
		if (!this.parentShards.has(crosswalkId)) return undefined;
		return this.read<LocationParentProjection>(
			"parents",
			crosswalkId,
			locationId,
		);
	}

	get(
		locationId: string,
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	) {
		if (!this.memberShard(geography, boundaryRelease, crosswalkId))
			return undefined;
		return this.read<LocationProjection>(
			"members",
			crosswalkId,
			locationProjectionKey(
				locationId,
				geography,
				boundaryRelease,
				crosswalkId,
			),
		);
	}
}
