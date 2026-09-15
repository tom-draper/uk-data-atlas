import { isNumericObservation } from "./dataCatalog";
import { observationsFor } from "./observationArtifacts";
import { rankObservations, readRankingOrder } from "./ranking";
import {
	changeRefusal,
	changeValue,
	computeChanges,
	periodsOverlap,
	relativeChangeRefusal,
	type ChangeBasis,
} from "./change";
import { sourceSeriesProvenance } from "./sourceExactProvenance";
import {
	cursorFor,
	keyFromCursor,
	MAX_PAGE_SIZE,
	readPageSize,
} from "./pagination";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** Change between two periods of a measure for areas published in both, ranked in stable pages. */
export const handleDataChangeRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "change"
	)
		return undefined;
	const {
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	} = context;
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before measuring change.",
		);
	}
	const measureId = segments[2] as string;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure) {
		return problem(
			404,
			"Not Found",
			"No published measure serves change at that path.",
		);
	}
	const refusal = changeRefusal(measure);
	if (refusal) {
		return problem(422, "Operation Not Supported", refusal);
	}
	if (
		parsedUrl.searchParams.has("release") ||
		parsedUrl.searchParams.has("conversion") ||
		parsedUrl.searchParams.has("aggregate")
	) {
		return problem(
			422,
			"Operation Not Supported",
			"Change is measured within one source partition. It does not select geometry releases, convert observations or aggregate them.",
		);
	}
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryYear = parsedUrl.searchParams.get("boundaryYear");
	const startPeriod = parsedUrl.searchParams.get("startPeriod");
	const endPeriod = parsedUrl.searchParams.get("endPeriod");
	const partitions = measure.sources
		.map(
			(candidate) =>
				`geography=${candidate.sourceGeography.type}&boundaryYear=${candidate.sourceGeography.boundaryYear} (${candidate.periods.length} period${candidate.periods.length === 1 ? "" : "s"})`,
		)
		.join("; ");
	/*
	 * Change is measured inside one partition, never across two. The
	 * publisher restates every period of a partition on a single set of
	 * codes, so an area code names the same ground at the start and the
	 * end; pairing periods from partitions on different codes would pair
	 * areas that are not the same place.
	 */
	const source = measure.sources.find(
		(candidate) =>
			candidate.sourceGeography.type === geography &&
			String(candidate.sourceGeography.boundaryYear) === boundaryYear,
	);
	if (!source || !startPeriod || !endPeriod) {
		return problem(
			400,
			"Invalid Query",
			`${measureId} measures change within one source partition: give geography, boundaryYear, startPeriod and endPeriod. Published partitions: ${partitions}.`,
		);
	}
	if (source.periods.length < 2) {
		return problem(
			422,
			"Operation Not Supported",
			`${measureId} publishes a single period (${source.periods[0]}) for this partition, so there is no change to measure.`,
		);
	}
	const startIndex = source.periods.indexOf(startPeriod);
	const endIndex = source.periods.indexOf(endPeriod);
	if (startIndex === -1 || endIndex === -1) {
		return problem(
			400,
			"Invalid Query",
			`startPeriod and endPeriod must be published periods of this partition: ${source.periods.join(", ")}.`,
		);
	}
	if (startIndex >= endIndex) {
		return problem(
			400,
			"Invalid Query",
			"startPeriod must come before endPeriod, so the sign of a change is never ambiguous.",
		);
	}
	if (periodsOverlap(startPeriod, endPeriod)) {
		return problem(
			422,
			"Operation Not Supported",
			`${startPeriod} and ${endPeriod} share years, so most of the apparent change between them is the same data counted twice. Choose periods that do not overlap.`,
		);
	}
	const basisParameter = parsedUrl.searchParams.get("by") ?? "absolute";
	if (basisParameter !== "absolute" && basisParameter !== "relative") {
		return problem(
			400,
			"Invalid Query",
			"by must be absolute or relative.",
		);
	}
	const basis: ChangeBasis = basisParameter;
	if (basis === "relative") {
		const relativeRefusal = relativeChangeRefusal(measure);
		if (relativeRefusal) {
			return problem(400, "Invalid Query", relativeRefusal);
		}
	}
	const order = readRankingOrder(parsedUrl.searchParams.get("order"));
	if (!order) {
		return problem(400, "Invalid Query", "order must be asc or desc.");
	}
	const artifacts = {
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const startObservations = observationsFor(
		measureId,
		source,
		startPeriod,
		artifacts,
	);
	const endObservations = observationsFor(
		measureId,
		source,
		endPeriod,
		artifacts,
	);
	if (!startObservations || !endObservations) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain both declared periods.`,
		);
	}
	const startRecords = startObservations.records.filter(isNumericObservation);
	const endRecords = endObservations.records.filter(isNumericObservation);
	if (
		startRecords.length !== startObservations.records.length ||
		endRecords.length !== endObservations.records.length
	) {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for change.`,
		);
	}
	const changeSet = computeChanges(measure, startRecords, endRecords);
	const rankable = changeSet.changes.flatMap((change) => {
		const value = changeValue(change, basis);
		return value === undefined
			? []
			: [
					{
						areaCode: change.areaCode,
						value,
						status: "derived" as const,
					},
				];
	});
	const changeByCode = new Map(
		changeSet.changes.map((change) => [change.areaCode, change]),
	);
	const ranked = rankObservations(rankable, order).map((entry) => {
		const change = changeByCode.get(entry.areaCode)!;
		return {
			areaCode: entry.areaCode,
			rank: entry.rank,
			tieCount: entry.tieCount,
			start: { period: startPeriod, ...change.start },
			end: { period: endPeriod, ...change.end },
			absoluteChange: change.absoluteChange,
			relativeChange: change.relativeChange,
			...(change.intervalsOverlap === undefined
				? {}
				: { intervalsOverlap: change.intervalsOverlap }),
		};
	});

	// One area, with its place among all of them: "rose 12%, fifth fastest".
	const areaCode = parsedUrl.searchParams.get("areaCode");
	let records = ranked;
	let nextCursor: string | null = null;
	if (areaCode) {
		const record = ranked.find((entry) => entry.areaCode === areaCode);
		if (!record) {
			const reason = changeSet.onlyAtStart.includes(areaCode)
				? `it has a value in ${startPeriod} but none in ${endPeriod}`
				: changeSet.onlyAtEnd.includes(areaCode)
					? `it has a value in ${endPeriod} but none in ${startPeriod}`
					: changeByCode.has(areaCode)
						? "its start value is zero, so it has no relative change"
						: "it is not in this partition";
			return problem(
				404,
				"Not Found",
				`No change for ${areaCode}: ${reason}.`,
			);
		}
		records = [record];
	} else {
		const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
		if (pageSize === undefined) {
			return problem(
				400,
				"Invalid Query",
				`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
			);
		}
		const cursor = parsedUrl.searchParams.get("cursor");
		const cursorCode = cursor ? keyFromCursor(cursor) : undefined;
		if (cursor && !cursorCode) {
			return problem(400, "Invalid Query", "cursor is invalid.");
		}
		const offset = cursorCode
			? ranked.findIndex((entry) => entry.areaCode === cursorCode) + 1
			: 0;
		if (cursorCode && offset === 0) {
			return problem(
				400,
				"Invalid Query",
				"cursor is not valid for this change query.",
			);
		}
		records = ranked.slice(offset, offset + pageSize);
		const last = records.at(-1);
		nextCursor =
			offset + records.length < ranked.length && last
				? cursorFor(last.areaCode)
				: null;
	}
	const withIntervals = changeSet.changes.some(
		(change) => change.intervalsOverlap !== undefined,
	);
	return {
		status: 200,
		body: envelope(
			releaseId,
			{
				measure,
				source,
				sourceGeography: source.sourceGeography,
				startPeriod,
				endPeriod,
				provenance: sourceSeriesProvenance({
					atlasRelease: releaseId,
					measure,
					source,
					periods: [startPeriod, endPeriod],
					observations: endObservations,
				}),
				change: {
					direction: "end-minus-start",
					basis,
					order,
					unit: basis === "relative" ? "proportion" : measure.unit,
					interpretation:
						measure.valueKind === "currency"
							? `Nominal change in ${measure.unit}. Values are as published and not adjusted for inflation.`
							: measure.valueKind === "ratio"
								? "Change in points of the source-published ratio."
								: "Change in the source-published unit.",
					ranking: {
						method: "competition",
						note: "Equal changes share a rank; the following rank accounts for every preceding area (for example 1, 1, 3).",
					},
					...(withIntervals
						? {
								uncertainty:
									"intervalsOverlap reports whether the published intervals at the start and end overlap. Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do not show that it is.",
							}
						: {}),
				},
				coverage: {
					areasRanked: ranked.length,
					areasWithBothPeriods: changeSet.changes.length,
					onlyAtStart: changeSet.onlyAtStart,
					onlyAtEnd: changeSet.onlyAtEnd,
					// Only ever non-zero for relative change, where a zero start
					// has no share to express the change as.
					withoutRelativeChange:
						changeSet.changes.length - ranked.length,
					note: "Change is measured only for areas with a value in both periods. Areas in one period only are listed, not paired with anything.",
				},
				records,
			},
			nextCursor,
		),
	};
};
