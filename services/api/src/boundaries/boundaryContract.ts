import { z } from "zod";
import { resolveBoundaryMetadata } from "./resolveBoundaryMetadata";
import { compareBoundaryMetadata } from "./compareBoundaryMetadata";
import { boundariesMetadata } from "./boundariesMetadata";
import { boundaryReleaseMetadata } from "./boundaryReleaseMetadata";
import { boundaryReleasesMetadata } from "./boundaryReleasesMetadata";

const envelope = (data: z.ZodType) =>
	z.looseObject({
		apiVersion: z.literal("v1"),
		atlasRelease: z.string(),
		meta: z.looseObject({ nextCursor: z.string().nullable() }),
		data,
	});
const geography = z.looseObject({
	id: z.string(),
	latestRelease: z.string(),
	releaseCount: z.number().int(),
});
const release = z.looseObject({
	id: z.string(),
	geography: z.string(),
	title: z.string(),
	description: z.string().optional(),
	temporalCoverage: z.string().optional(),
	coverage: z.looseObject({ countries: z.array(z.string()) }),
	source: z.looseObject({
		publisher: z.string(),
		url: z.string().meta({ format: "uri" }),
		retrievedAt: z.string().meta({ format: "date" }).optional(),
		licence: z.looseObject({
			name: z.string(),
			url: z.string().meta({ format: "uri" }).optional(),
		}),
	}),
	metadataHash: z.string(),
	deprecation: z
		.looseObject({
			deprecated: z
				.string()
				.meta({ format: "date" })
				.describe("The date the release was deprecated."),
			sunset: z
				.string()
				.meta({ format: "date" })
				.describe(
					"The date after which the release may be removed. Absent until one is set.",
				)
				.optional(),
			replacedBy: z
				.string()
				.describe(
					"The id of the release, of the same geography, to use instead.",
				),
			reason: z.string(),
		})
		.describe(
			"Present on a release that has been superseded. The release stays published and is not chosen by date or `latest` while its replacement covers the date; clients should move to `replacedBy` before `sunset`.",
		)
		.optional(),
});
export const boundaries = {
	...boundariesMetadata,
	method: "get",
	path: "/boundaries",
	responses: {
		...boundariesMetadata.responses,
		200: {
			...boundariesMetadata.responses[200],
			content: {
				"application/json": {
					...boundariesMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(z.array(geography)),
				},
			},
		},
	},
} as const;
export const boundaryReleases = {
	...boundaryReleasesMetadata,
	method: "get",
	path: "/boundary-releases",
	responses: {
		...boundaryReleasesMetadata.responses,
		200: {
			...boundaryReleasesMetadata.responses[200],
			content: {
				"application/json": {
					...boundaryReleasesMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(z.array(release)),
				},
			},
		},
	},
} as const;

const downloads = z
	.discriminatedUnion("status", [
		z.looseObject({
			status: z.literal("available"),
			mapResource: z
				.string()
				.describe(
					"The descriptor, with sizes, hashes and attribution.",
				),
			pmtiles: z.string(),
			tileJson: z.string(),
			geojson: z
				.record(z.string(), z.string())
				.describe("The download for the medium and low tiers."),
			geoparquet: z
				.record(z.string(), z.string())
				.describe("GeoParquet downloads by tier."),
		}),
		z.looseObject({
			status: z.literal("untiled"),
			reason: z.string(),
			geoparquet: z
				.record(z.string(), z.string())
				.describe("GeoParquet downloads by tier."),
		}),
		z.looseObject({ status: z.literal("unavailable"), reason: z.string() }),
	])
	.describe(
		"Where to get the whole release. Available releases have vector tiles and GeoParquet downloads. Untiled releases have GeoParquet at full detail only. Unavailable releases have no readable geometry. Each remains available area by area.",
	);
export const boundaryReleaseDetail = {
	...boundaryReleaseMetadata,
	method: "get",
	path: "/boundary-releases/:geography/:release",
	responses: {
		...boundaryReleaseMetadata.responses,
		200: {
			...boundaryReleaseMetadata.responses[200],
			content: {
				"application/json": {
					...boundaryReleaseMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(
						release.extend({
							documents: z.looseObject({
								validation: z.string(),
								health: z.string(),
							}),
							downloads,
						}),
					),
				},
			},
		},
	},
} as const;

const reference = z.looseObject({
	id: z.string(),
	month: z.string(),
	title: z.string(),
	countries: z.array(z.string()),
	href: z.string(),
	deprecation: release.shape.deprecation,
});
const resolveData = z.looseObject({
	geography: z.string(),
	date: z.string(),
	month: z.string(),
	country: z.string().optional(),
	selected: reference,
	sameMonth: z.boolean(),
	previous: reference.nullable(),
	next: reference.nullable(),
	setAside: z.array(reference.extend({ reason: z.string() })),
	notCovering: z.array(reference),
	undated: z.array(z.string()).optional(),
	basis: z.literal("latest-release-dated-on-or-before"),
	note: z.string(),
});
const comparisonData = z.looseObject({
	geography: z.string(),
	from: z.looseObject({ geography: z.string(), boundaryRelease: z.string() }),
	to: z.looseObject({ geography: z.string(), boundaryRelease: z.string() }),
	summary: z.looseObject({
		fromAreaCount: z.number().int(),
		toAreaCount: z.number().int(),
		sharedCodeCount: z.number().int(),
		codesOnlyInFromCount: z.number().int(),
		codesOnlyInToCount: z.number().int(),
		continuousCodeCount: z.number().int(),
		recodedCodeCount: z.number().int(),
		changedExtentCount: z.number().int(),
		indeterminateExtentCount: z.number().int(),
		unmeasuredCodeCount: z.number().int(),
		unassessedSharedCodeCount: z.number().int(),
		publishedRelationshipCount: z.number().int(),
	}),
	codes: z.looseObject({
		onlyInFrom: z.array(
			z.looseObject({
				id: z.string(),
				code: z.string(),
				name: z.string(),
				aliases: z.array(z.string()).optional(),
			}),
		),
		onlyInTo: z.array(
			z.looseObject({
				id: z.string(),
				code: z.string(),
				name: z.string(),
				aliases: z.array(z.string()).optional(),
			}),
		),
	}),
	continuity: z.discriminatedUnion("status", [
		z.looseObject({
			status: z.literal("not-published"),
			reason: z.string(),
		}),
		z.looseObject({
			status: z.literal("available"),
			crosswalks: z.array(z.string()),
			recoded: z.array(
				z.looseObject({
					fromCode: z.string(),
					toCode: z.string(),
					widestDifferenceM: z.number(),
				}),
			),
			changedExtent: z.array(
				z.looseObject({
					code: z.string(),
					relation: z.string(),
					widestDifferenceM: z.number(),
					fromShare: z.number(),
					toShare: z.number(),
				}),
			),
			unmeasured: z.array(
				z.looseObject({ code: z.string(), reason: z.string() }),
			),
			unassessedSharedCodes: z.array(z.string()),
		}),
	]),
	publishedRelationships: z.array(
		z.looseObject({
			id: z.string(),
			direction: z.enum(["forward", "reverse"]),
			method: z.string(),

			quality: z.string(),
			relationshipPurpose: z.enum(["identity", "membership"]).optional(),
			weighting: z.union([
				z.looseObject({ status: z.literal("not-provided") }),
				z.looseObject({ status: z.literal("not-applicable") }),
				z.looseObject({
					status: z.literal("provided"),
					basis: z.literal("area"),
					normalisation: z.literal("per-source"),
				}),
				z.looseObject({
					status: z.literal("provided"),
					basis: z.literal("population"),
					normalisation: z.literal("per-source"),
					population: z.string(),
					date: z.string(),
					blocks: z.looseObject({
						geography: z.string(),
						boundaryRelease: z.string(),
					}),
				}),
			]),
			mapping: z.looseObject({
				shape: z.enum([
					"no-mappings",
					"one-to-one",
					"one-to-many",
					"many-to-one",
					"many-to-many",
				]),
				fromCodeCount: z.number().int(),
				toCodeCount: z.number().int(),
				pairCount: z.number().int(),
				from: z.looseObject({
					noTargetCount: z.number().int(),
					oneTargetCount: z.number().int(),
					multipleTargetCount: z.number().int(),
				}),
				to: z.looseObject({
					oneSourceCount: z.number().int(),
					multipleSourceCount: z.number().int(),
				}),
				examples: z.looseObject({
					oneToMany: z.array(
						z.looseObject({
							fromCode: z.string(),
							toCodes: z.array(z.string()),
						}),
					),
					manyToOne: z.array(
						z.looseObject({
							toCode: z.string(),
							fromCodes: z.array(z.string()),
						}),
					),
				}),
				note: z.string(),
			}),
			recordCount: z.number().int(),
		}),
	),
	limit: z.number().int(),
	note: z.string(),
});
export const resolveBoundary = {
	...resolveBoundaryMetadata,
	method: "get",
	path: "/boundary-releases::resolve",
	responses: {
		...resolveBoundaryMetadata.responses,
		200: {
			...resolveBoundaryMetadata.responses[200],
			content: {
				"application/json": {
					...resolveBoundaryMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(resolveData),
				},
			},
		},
	},
} as const;
export const compareBoundary = {
	...compareBoundaryMetadata,
	method: "get",
	path: "/boundary-releases::compare",
	responses: {
		...compareBoundaryMetadata.responses,
		200: {
			...compareBoundaryMetadata.responses[200],
			content: {
				"application/json": {
					...compareBoundaryMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(comparisonData),
				},
			},
		},
	},
} as const;
