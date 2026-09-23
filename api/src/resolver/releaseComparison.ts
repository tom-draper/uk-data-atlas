import type { AreaLookup, AreaRecord } from "../areaInventory";
import type {
	CrosswalkArtifact,
	SameCodeContinuityCrosswalkArtifact,
} from "../crosswalkInventory";
import type { CrosswalkLookup, GeographyEndpoint } from "./translation";

const areaId = ({
	geography,
	boundaryRelease,
	code,
}: GeographyEndpoint & { code: string }) =>
	[geography, boundaryRelease, code].join("/");

export type BoundaryExtentChange = {
	code: string;
	relation: "changed" | "indeterminate";
	widestDifferenceM: number;
	fromShare: number;
	toShare: number;
};

/**
 * The cardinality of codes in a published crosswalk, viewed in the direction
 * requested by a release comparison. This describes its records, rather than
 * inferring a legal boundary change from them.
 */
export type PublishedRelationshipMapping = {
	shape:
		| "no-mappings"
		| "one-to-one"
		| "one-to-many"
		| "many-to-one"
		| "many-to-many";
	fromCodeCount: number;
	toCodeCount: number;
	pairCount: number;
	from: {
		noTargetCount: number;
		oneTargetCount: number;
		multipleTargetCount: number;
	};
	to: {
		oneSourceCount: number;
		multipleSourceCount: number;
	};
	examples: {
		oneToMany: Array<{ fromCode: string; toCodes: string[] }>;
		manyToOne: Array<{ toCode: string; fromCodes: string[] }>;
	};
	note: string;
};

export type BoundaryReleaseComparison = {
	geography: string;
	from: GeographyEndpoint;
	to: GeographyEndpoint;
	summary: {
		fromAreaCount: number;
		toAreaCount: number;
		sharedCodeCount: number;
		codesOnlyInFromCount: number;
		codesOnlyInToCount: number;
		continuousCodeCount: number;
		changedExtentCount: number;
		indeterminateExtentCount: number;
		unmeasuredCodeCount: number;
		unassessedSharedCodeCount: number;
		publishedRelationshipCount: number;
	};
	codes: {
		onlyInFrom: Array<AreaRecord & { id: string }>;
		onlyInTo: Array<AreaRecord & { id: string }>;
	};
	continuity:
		| {
				status: "available";
				crosswalks: string[];
				changedExtent: BoundaryExtentChange[];
				unmeasured: Array<{ code: string; reason: string }>;
				unassessedSharedCodes: string[];
			}
		| { status: "not-published"; reason: string };
	publishedRelationships: Array<{
		id: string;
		direction: "forward" | "reverse";
		method: CrosswalkArtifact["method"];
		quality: CrosswalkArtifact["quality"];
		relationshipPurpose?: "identity" | "membership";
		weighting: CrosswalkArtifact["weighting"];
		recordCount: number;
		mapping: PublishedRelationshipMapping;
	}>;
};

export type ReleaseComparisonSources = {
	areaLookup?: AreaLookup;
	crosswalkLookup?: CrosswalkLookup;
};

const summarisePublishedRelationshipMapping = (
	crosswalk: CrosswalkArtifact,
	direction: "forward" | "reverse",
	limit: number,
): PublishedRelationshipMapping => {
	const targetsByFrom = new Map<string, Set<string>>();
	const sourcesByTo = new Map<string, Set<string>>();
	for (const record of crosswalk.records) {
		const fromCode =
			direction === "forward" ? record.source.code : undefined;
		if (fromCode && !targetsByFrom.has(fromCode))
			targetsByFrom.set(fromCode, new Set());
		for (const target of record.targets) {
			const viewedFrom =
				direction === "forward" ? record.source.code : target.code;
			const viewedTo =
				direction === "forward" ? target.code : record.source.code;
			const targets = targetsByFrom.get(viewedFrom) ?? new Set<string>();
			targets.add(viewedTo);
			targetsByFrom.set(viewedFrom, targets);
			const sources = sourcesByTo.get(viewedTo) ?? new Set<string>();
			sources.add(viewedFrom);
			sourcesByTo.set(viewedTo, sources);
		}
	}
	const fromEntries = [...targetsByFrom].sort(([left], [right]) =>
		left.localeCompare(right),
	);
	const toEntries = [...sourcesByTo].sort(([left], [right]) =>
		left.localeCompare(right),
	);
	const from = {
		noTargetCount: fromEntries.filter(([, targets]) => targets.size === 0)
			.length,
		oneTargetCount: fromEntries.filter(([, targets]) => targets.size === 1)
			.length,
		multipleTargetCount: fromEntries.filter(([, targets]) => targets.size > 1)
			.length,
	};
	const to = {
		oneSourceCount: toEntries.filter(([, sources]) => sources.size === 1)
			.length,
		multipleSourceCount: toEntries.filter(([, sources]) => sources.size > 1)
			.length,
	};
	const pairCount = fromEntries.reduce(
		(count, [, targets]) => count + targets.size,
		0,
	);
	const shape =
		pairCount === 0
			? "no-mappings"
			: from.multipleTargetCount > 0 && to.multipleSourceCount > 0
				? "many-to-many"
				: from.multipleTargetCount > 0
					? "one-to-many"
					: to.multipleSourceCount > 0
						? "many-to-one"
						: "one-to-one";
	return {
		shape,
		fromCodeCount: fromEntries.length,
		toCodeCount: toEntries.length,
		pairCount,
		from,
		to,
		examples: {
			oneToMany: fromEntries
				.filter(([, targets]) => targets.size > 1)
				.slice(0, limit)
				.map(([fromCode, targets]) => ({
					fromCode,
					toCodes: [...targets].sort(),
				})),
			manyToOne: toEntries
				.filter(([, sources]) => sources.size > 1)
				.slice(0, limit)
				.map(([toCode, sources]) => ({
					toCode,
					fromCodes: [...sources].sort(),
				})),
		},
		note: "Cardinality describes codes in this crosswalk's published records, viewed from the requested release to the other release. It does not establish a legal boundary change or account for release codes absent from the records.",
	};
};

/**
 * Compare two compiled releases of one geography without promoting code-set
 * differences into geographical change claims. Same-code continuity is only
 * reported where its dedicated geometry comparison has published evidence.
 */
export const compareBoundaryReleases = (
sources: ReleaseComparisonSources,
	geography: string,
	fromRelease: string,
	toRelease: string,
	limit = 25,
): BoundaryReleaseComparison | undefined => {
	const from = { geography, boundaryRelease: fromRelease };
	const to = { geography, boundaryRelease: toRelease };
	const fromAreas = sources.areaLookup?.get(
		`${geography}/${fromRelease}`,
	);
	const toAreas = sources.areaLookup?.get(`${geography}/${toRelease}`);
	if (!fromAreas || !toAreas) return undefined;
	const onlyInFrom = [...fromAreas]
		.filter(([code]) => !toAreas.has(code))
		.map(([code, area]) => ({
			id: areaId({ ...from, code }),
			...area,
		}));
	const onlyInTo = [...toAreas]
		.filter(([code]) => !fromAreas.has(code))
		.map(([code, area]) => ({
			id: areaId({ ...to, code }),
			...area,
		}));
	const sharedCodes = [...fromAreas.keys()]
		.filter((code) => toAreas.has(code))
		.sort();
	const between: Array<{
		crosswalk: CrosswalkArtifact;
		direction: "forward" | "reverse";
	}> = [];
	for (const crosswalk of sources.crosswalkLookup?.values() ?? []) {
		const forward =
			crosswalk.from.geography === geography &&
			crosswalk.from.boundaryRelease === fromRelease &&
			crosswalk.to.geography === geography &&
			crosswalk.to.boundaryRelease === toRelease;
		const reverse =
			crosswalk.to.geography === geography &&
			crosswalk.to.boundaryRelease === fromRelease &&
			crosswalk.from.geography === geography &&
			crosswalk.from.boundaryRelease === toRelease;
		if (forward) between.push({ crosswalk, direction: "forward" });
		else if (reverse) between.push({ crosswalk, direction: "reverse" });
	}
	between.sort((left, right) =>
		left.crosswalk.id.localeCompare(right.crosswalk.id),
	);
	const continuityArtifacts = between.filter(
		(
			entry,
		): entry is {
			crosswalk: SameCodeContinuityCrosswalkArtifact;
			direction: "forward" | "reverse";
		} => entry.crosswalk.method === "same-code-continuity",
	);
	const continuousCodes = new Set<string>();
	const changedExtent = new Map<string, BoundaryExtentChange>();
	const unmeasured = new Map<string, string>();
	for (const { crosswalk, direction } of continuityArtifacts) {
		for (const record of crosswalk.records)
			for (const target of record.targets)
				continuousCodes.add(
					direction === "forward" ? record.source.code : target.code,
				);
		for (const finding of crosswalk.validation.continuity.changedExtent) {
			const current = changedExtent.get(finding.code);
			const candidate = {
				code: finding.code,
				relation: finding.relation,
				widestDifferenceM: finding.widestDifferenceM,
				fromShare:
					direction === "forward"
						? finding.sourceShare
						: finding.targetShare,
				toShare:
					direction === "forward"
						? finding.targetShare
						: finding.sourceShare,
			};
			if (!current || candidate.widestDifferenceM > current.widestDifferenceM)
				changedExtent.set(finding.code, candidate);
		}
		for (const finding of crosswalk.validation.continuity.unmeasured)
			unmeasured.set(finding.code, finding.reason);
	}
	const assessed = new Set([
		...continuousCodes,
		...changedExtent.keys(),
		...unmeasured.keys(),
	]);
	const unassessedSharedCodes = sharedCodes.filter((code) => !assessed.has(code));
	const changed = [...changedExtent.values()].sort(
		(left, right) =>
			right.widestDifferenceM - left.widestDifferenceM ||
			left.code.localeCompare(right.code),
	);
	const publishedRelationships = between
		.filter(({ crosswalk }) => crosswalk.method !== "same-code-continuity")
		.map(({ crosswalk, direction }) => ({
			id: crosswalk.id,
			direction,
			method: crosswalk.method,
			quality: crosswalk.quality,
			...(crosswalk.relationshipPurpose
				? { relationshipPurpose: crosswalk.relationshipPurpose }
				: {}),
			weighting: crosswalk.weighting,
			recordCount: crosswalk.records.length,
			mapping: summarisePublishedRelationshipMapping(
				crosswalk,
				direction,
				limit,
			),
		}));
	return {
		geography,
		from,
		to,
		summary: {
			fromAreaCount: fromAreas.size,
			toAreaCount: toAreas.size,
			sharedCodeCount: sharedCodes.length,
			codesOnlyInFromCount: onlyInFrom.length,
			codesOnlyInToCount: onlyInTo.length,
			continuousCodeCount: continuousCodes.size,
			changedExtentCount: changed.filter(
				({ relation }) => relation === "changed",
			).length,
			indeterminateExtentCount: changed.filter(
				({ relation }) => relation === "indeterminate",
			).length,
			unmeasuredCodeCount: unmeasured.size,
			unassessedSharedCodeCount: unassessedSharedCodes.length,
			publishedRelationshipCount: publishedRelationships.length,
		},
		codes: {
			onlyInFrom: onlyInFrom.slice(0, limit),
			onlyInTo: onlyInTo.slice(0, limit),
		},
		continuity:
			continuityArtifacts.length > 0
				? {
					status: "available",
					crosswalks: continuityArtifacts.map(
						({ crosswalk }) => crosswalk.id,
					),
					changedExtent: changed.slice(0, limit),
					unmeasured: [...unmeasured]
						.map(([code, reason]) => ({ code, reason }))
						.sort((left, right) => left.code.localeCompare(right.code))
						.slice(0, limit),
					unassessedSharedCodes: unassessedSharedCodes.slice(0, limit),
				}
				: {
					status: "not-published",
					reason:
						"No same-code continuity crosswalk has compared these releases' shared identifiers.",
				},
		publishedRelationships,
	};
};
