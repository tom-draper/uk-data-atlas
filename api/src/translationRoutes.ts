import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** An area code translated to another geography or release, only through a published crosswalk fit for the stated purpose. */
export const handleTranslationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "translations"
	)
		return undefined;
	const { crosswalkLookup } = context;
	if (!crosswalkLookup) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the crosswalk inventory before translating area codes.",
		);
	}
	const source = {
		geography: parsedUrl.searchParams.get("sourceGeography"),
		boundaryRelease: parsedUrl.searchParams.get("sourceRelease"),
		code: parsedUrl.searchParams.get("code"),
	};
	const target = {
		geography: parsedUrl.searchParams.get("targetGeography"),
		boundaryRelease: parsedUrl.searchParams.get("targetRelease"),
	};
	const purpose = parsedUrl.searchParams.get("purpose") ?? "membership";
	if (
		!source.geography ||
		!source.boundaryRelease ||
		!source.code ||
		!target.geography ||
		!target.boundaryRelease ||
		!["identity", "membership", "apportion"].includes(purpose)
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography, sourceRelease, code, targetGeography and targetRelease are required; purpose must be identity, membership or apportion.",
		);
	}
	const matches = [...crosswalkLookup.values()].flatMap((crosswalk) => {
		const validForPurpose =
			(purpose === "identity" &&
				(crosswalk.method === "official-lookup" ||
					crosswalk.method === "same-code-continuity")) ||
			(purpose === "membership" &&
				crosswalk.method === "clean-containment") ||
			(purpose === "apportion" && crosswalk.method === "area-overlap");
		if (!validForPurpose) return [];
		const crosswalkSummary = {
			id: crosswalk.id,
			method: crosswalk.method,
			quality: crosswalk.quality,
			weighting: crosswalk.weighting,
			provenance: crosswalk.provenance,
		};
		if (
			crosswalk.from.geography === source.geography &&
			crosswalk.from.boundaryRelease === source.boundaryRelease &&
			crosswalk.to.geography === target.geography &&
			crosswalk.to.boundaryRelease === target.boundaryRelease
		) {
			const record = crosswalk.records.find(
				(candidate) => candidate.source.code === source.code,
			);
			return record
				? [
						{
							crosswalk: {
								...crosswalkSummary,
								direction: "forward",
							},
							source: record.source,
							targets: record.targets,
						},
					]
				: [];
		}
		if (
			crosswalk.to.geography !== source.geography ||
			crosswalk.to.boundaryRelease !== source.boundaryRelease ||
			crosswalk.from.geography !== target.geography ||
			crosswalk.from.boundaryRelease !== target.boundaryRelease
		)
			return [];
		if (crosswalk.method === "area-overlap") {
			const reverseRecords = crosswalk.records.flatMap((record) => {
				const matchedTarget = record.targets.find(
					(candidate) => candidate.code === source.code,
				);
				return matchedTarget ? [{ record, matchedTarget }] : [];
			});
			if (reverseRecords.length === 0) return [];
			const reverseSource = {
				code: source.code,
				labels: [
					...new Set(
						reverseRecords.flatMap(
							({ matchedTarget }) => matchedTarget.labels,
						),
					),
				].sort(),
			};
			const coverage = reverseRecords.reduce(
				(sum, { matchedTarget }) => sum + matchedTarget.targetShare,
				0,
			);
			return coverage > 0
				? [
						{
							crosswalk: {
								...crosswalkSummary,
								direction: "reverse",
							},
							source: reverseSource,
							sourceCoverage: coverage,
							targets: reverseRecords.map(
								({ record, matchedTarget }) => ({
									...record.source,
									weight:
										matchedTarget.targetShare / coverage,
									overlapAreaM2: matchedTarget.overlapAreaM2,
									// These shares are expressed against the reversed direction.
									sourceShare: matchedTarget.targetShare,
									targetShare: matchedTarget.sourceShare,
								}),
							),
						},
					]
				: [];
		}
		const reverseRecords = crosswalk.records.flatMap((record) => {
			const matchedTarget = record.targets.find(
				(candidate) => candidate.code === source.code,
			);
			return matchedTarget ? [{ record, matchedTarget }] : [];
		});
		if (reverseRecords.length === 0) return [];
		const reverseSource = {
			code: source.code,
			labels: [
				...new Set(
					reverseRecords.flatMap(
						({ matchedTarget }) => matchedTarget.labels,
					),
				),
			].sort(),
		};
		return [
			{
				crosswalk: { ...crosswalkSummary, direction: "reverse" },
				source: reverseSource,
				targets: reverseRecords.map(({ record }) => record.source),
			},
		];
	});
	return matches.length > 0
		? {
				status: 200,
				body: envelope(releaseId, {
					source,
					target,
					purpose,
					matches,
				}),
			}
		: problem(
				422,
				"Conversion Unavailable",
				"No published crosswalk supports this source, target and purpose. Same codes across releases are not treated as proof of geographic identity.",
			);
};
