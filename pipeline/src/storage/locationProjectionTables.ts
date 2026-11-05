import { LOCATION_PROJECTION_MEMBERS_VIEW } from "./deprecatedViews.ts";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { deflateRawSync } from "node:zlib";
import {
	locationProjectionKey,
	type compileLocationProjections,
	type LocationProjection,
	type LocationParentProjection,
} from "@uk-data-atlas/atlas-runtime/places";

/**
 * A value as JSON, deflated against a dictionary of text like it. Values read
 * one at a time are too small to compress well alone; a dictionary drawn from
 * their neighbours supplies the repetition a whole file would have.
 */
export const packJson = (value: unknown, dictionary?: Uint8Array) =>
	deflateRawSync(JSON.stringify(value), {
		level: 9,
		...(dictionary ? { dictionary } : {}),
	});

/** The most a deflate dictionary can use. */
const DICTIONARY_BYTES = 32 * 1024;

/** A dictionary for values like these: the JSON of the first, to 32 KB. */
export const jsonDictionary = (values: Iterable<unknown>) => {
	const parts: Buffer[] = [];
	let length = 0;
	for (const value of values) {
		if (length >= DICTIONARY_BYTES) break;
		const part = Buffer.from(JSON.stringify(value));
		parts.push(part);
		length += part.length;
	}
	return Buffer.concat(parts).subarray(0, DICTIONARY_BYTES);
};

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
		location_projection_member: {
			views: { location_projection_members: LOCATION_PROJECTION_MEMBERS_VIEW },
			columns: [
				"crosswalk_id TEXT NOT NULL",
				"key TEXT NOT NULL",
				"value BLOB NOT NULL",
			],
			key: ["crosswalk_id", "key"],
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
