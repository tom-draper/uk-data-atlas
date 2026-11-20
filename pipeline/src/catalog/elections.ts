import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import {
	measureSeriesKey,
	type MeasureSeriesIdentity,
} from "@uk-data-atlas/measures";
import type {
	SourceGeography,
	MeasureAggregation,
	Measure,
	PopulationObservation,
	CategoricalObservation,
} from "@uk-data-atlas/catalogue/node";
import { sha256 } from "./values.ts";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import type { CatalogManifest } from "./manifest.ts";
import type { CatalogueRows } from "./rows.ts";

/** What a metric of an election measures, in terms of the rows' measures. */
type ElectionMeasureField =
	| { kind: "field"; field: string }
	| { kind: "partyVotes"; party: string }
	| { kind: "partyVoteShare"; party: string; denominator: string };

/** One polling year of an election, as its declaration names it. */
type Edition = {
	period: string;
	boundaryYear: number;
	/** Whether the source names its wards rather than coding them. */
	nameMatched: boolean;
};

/** The polling years an election dataset declares, with their code vintages. */
const editionsOf = (datasetId: string): Edition[] => {
	const declaration = DATASET_DECLARATIONS.find(
		(candidate) => candidate.id === datasetId,
	);
	const parts = declaration?.statistics?.payload?.parts?.([]);
	if (!parts) throw new Error(`${datasetId} declares no election parts`);
	return parts
		.map(({ key, header }) => {
			const boundaryYear = (header as { boundaryYear?: unknown })
				.boundaryYear;
			if (typeof boundaryYear !== "number")
				throw new Error(
					`${datasetId} ${key} declares no boundary year`,
				);
			return {
				period: key,
				boundaryYear,
				nameMatched:
					(header as { wardCodes?: unknown }).wardCodes ===
					"name-matched",
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
};

/** One polling year's records of a measure, with what notes need of them. */
type ElectionPeriod<R = PopulationObservation> = {
	period: string;
	boundaryYear: number;
	records: R[];
	nameMatched: boolean;
	/** Source areas left out because no single official code fits. */
	excludedAreaCount: number;
	/** County electoral divisions, held beside the wards but not served as them. */
	otherGeographyRecordCount: number;
	/** Areas served under a code other than their published one, as [source, served]. */
	correctedCodes: Array<[string, string]>;
};

/**
 * Elections are source-exact, polling-year measures. A constituency or ward
 * code can be reused in a later boundary release, but that does not move an
 * election result onto the later map; every distinct source boundary year is
 * therefore its own partition. Vote counts add within one election. Turnout
 * is a ratio; party shares are published only when a source provides a valid
 * ballot denominator, and carry that denominator for weighted aggregation.
 */
export const compileElections = (
	{ manifestPath, datasets }: CatalogManifest,
	rows: CatalogueRows,
) => {
	const partyNames: Record<string, string> = {
		APNI: "Alliance Party",
		BRX: "Brexit Party",
		CON: "Conservative",
		DUP: "Democratic Unionist Party",
		GREEN: "Green",
		IND: "Independent",
		LAB: "Labour",
		LD: "Liberal Democrat",
		OTHER: "Other candidates",
		PC: "Plaid Cymru",
		REF: "Reform",
		RUK: "Reform UK",
		SDLP: "Social Democratic and Labour Party",
		SF: "Sinn Féin",
		SNP: "Scottish National Party",
		UKIP: "UKIP",
		UUP: "Ulster Unionist Party",
	};
	/**
	 * Every polling year of a series, read from the rows. A year the rows hold
	 * nothing of, such as turnout before it was reported, comes back empty.
	 */
	const readPeriods = <R = PopulationObservation>(
		datasetId: "general-election" | "local-election",
		geography: "constituency" | "ward",
		series: MeasureSeriesIdentity,
		editions: Edition[],
	) =>
		editions.map((edition): ElectionPeriod<R> => {
			const source = {
				series,
				datasetId,
				geography,
				boundaryYear: edition.boundaryYear,
			};
			const records = rows.periods(source, [edition.period])[0]!
				.records as unknown as Array<
				R & { areaCode: string; sourceAreaCode?: string }
			>;
			return {
				...edition,
				records,
				excludedAreaCount: rows.coverageGaps(
					datasetId,
					edition.period,
					"election-ward",
				).length,
				otherGeographyRecordCount: 0,
				correctedCodes: [
					...new Map([
						...rows.publishedAs(datasetId, edition.period),
						...records.flatMap((record) =>
							record.sourceAreaCode === undefined
								? []
								: [
										[
											record.sourceAreaCode,
											record.areaCode,
										] as [string, string],
									],
						),
					]),
				].sort(([left], [right]) => left.localeCompare(right)),
			};
		});
	/**
	 * The declared polling years the rows hold results of. A year the rows
	 * hold nothing of is not published, and the manifest's count of election
	 * periods is what notices one that should have been held.
	 */
	const heldEditions = (
		datasetId: "general-election" | "local-election",
		geography: "constituency" | "ward",
	) =>
		editionsOf(datasetId).filter(
			(edition) =>
				readPeriods(
					datasetId,
					geography,
					{
						measure:
							datasetId === "general-election"
								? "valid-votes"
								: "effective-votes",
						datasetId,
					},
					[edition],
				)[0]!.records.length > 0,
		);
	/** The county electoral divisions an election holds beside its wards, by polling year. */
	const divisionCounts = (
		datasetId: "general-election" | "local-election",
		editions: Edition[],
	) => {
		return new Map(
			editions.map((edition) => [
				edition.period,
				rows.areasHeld(
					datasetId,
					"countyElectoralDivision",
					"party-votes",
					edition.period,
				),
			]),
		);
	};
	const electionMeasures = (election: {
		datasetId: "general-election" | "local-election";
		geography: "constituency" | "ward";
		label: string;
		countId: string;
		countLabel: string;
		countNote: string;
		/** How a party's votes in one area are counted, when it needs saying. */
		partyVoteNote?: string;
		turnoutPeriods: "all" | "reported";
		partyShareDenominator?: {
			field: string;
			measureId: string;
			label: string;
		};
	}) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === election.datasetId,
		);
		if (!dataset)
			throw new Error(
				`${manifestPath} has no ${election.datasetId} dataset`,
			);
		const editions = heldEditions(election.datasetId, election.geography);
		const divisions = divisionCounts(election.datasetId, editions);
		const countSeries = {
			measure:
				election.datasetId === "general-election"
					? "valid-votes"
					: "effective-votes",
			datasetId: election.datasetId,
		};
		const countPeriods = readPeriods(
			election.datasetId,
			election.geography,
			countSeries,
			editions,
		).map((period) => ({
			...period,
			otherGeographyRecordCount: divisions.get(period.period) ?? 0,
		}));
		const recordCount = countPeriods.reduce(
			(total, period) => total + period.records.length,
			0,
		);
		const otherGeographyRecordCount = countPeriods.reduce(
			(total, period) => total + period.otherGeographyRecordCount,
			0,
		);
		if (
			recordCount + otherGeographyRecordCount !==
			dataset.summary.dataRecordCount
		) {
			throw new Error(
				`${election.datasetId}: expected ${dataset.summary.dataRecordCount} records from the manifest, found ${recordCount} ${election.geography} records and ${otherGeographyRecordCount} records in another geography`,
			);
		}
		if (countPeriods.length !== dataset.summary.datasetCount) {
			throw new Error(
				`${election.datasetId}: expected ${dataset.summary.datasetCount} election periods from the manifest, found ${countPeriods.length}`,
			);
		}

		const parties = rows
			.partyCodes(election.datasetId)
			.map((party) => party.toUpperCase())
			.sort();
		const partyShareDenominator = election.partyShareDenominator;
		const metrics: Array<{
			id: string;
			label: string;
			field: ElectionMeasureField;
			aggregation: MeasureAggregation;
			notes: string[];
			filter?: (period: ElectionPeriod) => boolean;
		}> = [
			{
				id: election.countId,
				label: election.countLabel,
				field: { kind: "field", field: "count" },
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				notes: [
					election.countNote,
					...(otherGeographyRecordCount > 0
						? [
								`${otherGeographyRecordCount} source row${otherGeographyRecordCount === 1 ? "" : "s"} with county-electoral-division codes is excluded from this ${election.geography} measure. Historical county-electoral-division boundary vintages are not yet published by the API.`,
							]
						: []),
				],
			},
			{
				id: `${election.datasetId}-turnout`,
				label: `${election.label} turnout`,
				field: { kind: "field", field: "turnoutPercent" },
				aggregation: {
					kind: "intensive",
					operation: "weighted-mean",
					weight: {
						description:
							"The electorate for the same election and area.",
						datasetField: "electorate",
					},
					available: false,
				},
				notes: [
					"Turnout is a percentage of the electorate, so it does not add across areas. A combined turnout needs the summed electorate as its denominator.",
					...(election.turnoutPeriods === "reported"
						? [
								"The Local Elections Archive Project files for 2016–2019 do not publish electorate or turnout, so those polling years are deliberately absent rather than represented as zero turnout.",
							]
						: []),
				],
				...(election.turnoutPeriods === "reported"
					? {
							filter: (period) =>
								period.records.some(
									(record) => record.value > 0,
								),
						}
					: {}),
			},
			...parties.map((party) => ({
				id: `${election.datasetId}-${party.toLowerCase()}-votes`,
				label: `${election.label} votes for ${partyNames[party] ?? party}`,
				field: { kind: "partyVotes" as const, party },
				aggregation: {
					kind: "extensive" as const,
					operation: "sum" as const,
					available: true,
				},
				notes: [
					`Votes for ${partyNames[party] ?? party}. An area where the party did not stand is recorded as zero votes; this is a count, not a vote share.`,
					...(election.partyVoteNote ? [election.partyVoteNote] : []),
				],
			})),
			...(partyShareDenominator
				? parties.map((party) => ({
						id: `${election.datasetId}-${party.toLowerCase()}-vote-share`,
						label: `${election.label} vote share for ${partyNames[party] ?? party}`,
						field: {
							kind: "partyVoteShare" as const,
							party,
							denominator: partyShareDenominator.field,
						},
						aggregation: {
							kind: "intensive" as const,
							operation: "weighted-mean" as const,
							weight: {
								description: `The area's ${partyShareDenominator.label.toLowerCase()} for the same election.`,
								datasetField: partyShareDenominator.field,
								measureId: partyShareDenominator.measureId,
							},
							available: true,
						},
						notes: [
							`${partyNames[party] ?? party} votes divided by the source-published ${partyShareDenominator.label.toLowerCase()}. The percentage does not add across areas; the API combines it by summing party votes and valid ballots through this weight.`,
						],
					}))
				: []),
		];

		return metrics.flatMap((metric) => {
			const series = {
				measure:
					metric.field.kind === "partyVotes"
						? "party-votes"
						: metric.field.kind === "partyVoteShare"
							? "party-vote-share"
							: metric.field.field === "turnoutPercent"
								? "turnout"
								: election.datasetId === "general-election"
									? "valid-votes"
									: "effective-votes",
				...(metric.field.kind !== "field"
					? {
							dimensions: {
								party: metric.field.party.toLowerCase(),
							},
						}
					: {}),
				datasetId: election.datasetId,
			};
			const seriesKey = measureSeriesKey(series);
			const periods = readPeriods(
				election.datasetId,
				election.geography,
				series,
				editions,
			)
				.map((period) => ({
					...period,
					otherGeographyRecordCount:
						divisions.get(period.period) ?? 0,
				}))
				.filter(metric.filter ?? (() => true));
			const byBoundaryYear = new Map<number, typeof periods>();
			for (const period of periods) {
				const partition = byBoundaryYear.get(period.boundaryYear) ?? [];
				partition.push(period);
				byBoundaryYear.set(period.boundaryYear, partition);
			}
			const sources = [...byBoundaryYear.entries()]
				.sort(([left], [right]) => left - right)
				.map(([boundaryYear, sourcePeriods]) => {
					const sourceOtherGeographyRecordCount =
						sourcePeriods.reduce(
							(total, period) =>
								total + period.otherGeographyRecordCount,
							0,
						);
					const excludedAreaCount = sourcePeriods.reduce(
						(total, period) => total + period.excludedAreaCount,
						0,
					);
					const correctedCodes = sourcePeriods.flatMap(
						(period) => period.correctedCodes,
					);
					const nameMatched = sourcePeriods.some(
						(period) => period.nameMatched,
					);
					const sourceGeography = {
						type: election.geography,
						boundaryYear,
					} as SourceGeography;
					const observationArtifact = `${metric.id}-${election.geography}-${boundaryYear}-observations`;
					return {
						datasetId: election.datasetId,
						periods: sourcePeriods.map((period) => period.period),
						sourceGeography,
						observationArtifact,
						coverage: {
							kind: "partial" as const,
							countries: countriesFor(
								sourcePeriods[0]?.records ?? [],
							),
							recordCount: sourcePeriods[0]?.records.length ?? 0,
							note: `${
								nameMatched
									? `${election.label} records for the listed polling years. The source publishes no area codes, so each code was found by exact authority and area name in the official ${boundaryYear} boundary release.`
									: `${correctedCodes.length > 0 ? `${election.label}` : `Source-exact ${election.label.toLowerCase()}`} records for the listed polling years.`
							} Record coverage varies with the areas that held an election.${correctedCodes.length > 0 ? ` The source gives ${correctedCodes.length} area${correctedCodes.length === 1 ? "" : "s"} a code other than that of the area the election was held in, and ${correctedCodes.length === 1 ? "it is" : "they are"} served under the code in force at the election: ${correctedCodes.map(([source, served]) => `${source} as ${served}`).join(", ")}.` : ""}${excludedAreaCount > 0 ? ` ${excludedAreaCount} source area${excludedAreaCount === 1 ? " is" : "s are"} excluded because no single official code fits ${excludedAreaCount === 1 ? "it" : "them"}.` : ""}${sourceOtherGeographyRecordCount > 0 ? " County-electoral-division rows are excluded from this ward measure pending historical boundary releases." : ""}`,
						},
					};
				});
			const measure: Measure = {
				id: metric.id,
				series,
				label: metric.label,
				valueKind:
					metric.id.endsWith("turnout") ||
					metric.id.endsWith("vote-share")
						? "ratio"
						: "count",
				unit:
					metric.id.endsWith("turnout") ||
					metric.id.endsWith("vote-share")
						? "percent"
						: "votes",
				aggregation: metric.aggregation,
				sources,
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: metric.aggregation.available,
				},
				links: { data: `/v1/data/${metric.id}` },
				notes: metric.notes,
			};
			return sources.map((source) => {
				const sourcePeriods =
					byBoundaryYear.get(source.sourceGeography.boundaryYear) ??
					[];
				const artifactPeriods = sourcePeriods.map(
					({ period, records }) => ({
						period,
						records,
					}),
				);
				const content = JSON.stringify({
					schemaVersion: 1,
					measureId: seriesKey,
					sourceGeography: source.sourceGeography,
					periods: artifactPeriods,
				});
				return {
					measure,
					artifact: {
						schemaVersion: 1 as const,
						contentHash: sha256(content),
						measureId: seriesKey,
						sourceGeography: source.sourceGeography,
						periods: artifactPeriods,
					},
				};
			});
		});
	};
	const electionWinnerMeasures = (election: {
		datasetId: "general-election" | "local-election";
		geography: "constituency" | "ward";
		label: string;
	}) => {
		const periods = readPeriods<CategoricalObservation>(
			election.datasetId,
			election.geography,
			{ measure: "winning-party", datasetId: election.datasetId },
			heldEditions(election.datasetId, election.geography),
		);
		const byBoundaryYear = new Map<number, typeof periods>();
		for (const period of periods) {
			const partition = byBoundaryYear.get(period.boundaryYear) ?? [];
			partition.push(period);
			byBoundaryYear.set(period.boundaryYear, partition);
		}
		const measureId = `${election.datasetId}-winning-party`;
		const series = {
			measure: "winning-party",
			datasetId: election.datasetId,
		};
		const seriesKey = measureSeriesKey(series);
		const sources = [...byBoundaryYear.entries()]
			.sort(([left], [right]) => left - right)
			.map(([boundaryYear, sourcePeriods]) => ({
				datasetId: election.datasetId,
				periods: sourcePeriods.map((period) => period.period),
				sourceGeography: {
					type: election.geography,
					boundaryYear,
				} as SourceGeography,
				observationArtifact: `${measureId}-${election.geography}-${boundaryYear}-observations`,
				coverage: {
					kind: "partial" as const,
					countries: countriesFor(sourcePeriods[0]?.records ?? []),
					recordCount: sourcePeriods[0]?.records.length ?? 0,
					note: `Source-reported ${election.label.toLowerCase()} winning-party labels for the listed polling years. This is categorical data, not a vote count or party ranking.`,
				},
			}));
		const measure: Measure = {
			id: measureId,
			series,
			label: `${election.label} winning party`,
			valueKind: "categorical",
			unit: "party",
			aggregation: {
				kind: "categorical",
				available: false,
				note: "A winning-party label has no numeric order and cannot be summed, averaged, ranked or converted across areas.",
			},
			sources,
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: `/v1/data/${measureId}` },
			notes: [
				"The label records the party that won the source area. It is not a numeric score, and a group of areas can have a distribution of winners rather than one additive outcome.",
			],
		};
		return sources.map((source) => {
			const sourcePeriods =
				byBoundaryYear.get(source.sourceGeography.boundaryYear) ?? [];
			const artifactPeriods = sourcePeriods.map(
				({ period, records }) => ({
					period,
					records,
				}),
			);
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId: seriesKey,
				sourceGeography: source.sourceGeography,
				periods: artifactPeriods,
			});
			return {
				measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId: seriesKey,
					sourceGeography: source.sourceGeography,
					periods: artifactPeriods,
				},
			};
		});
	};
	const electionObservations = [
		...electionMeasures({
			datasetId: "general-election",
			geography: "constituency",
			label: "General election",
			countId: "general-election-valid-votes",
			countLabel: "General election valid votes",
			countNote:
				"Valid ballot papers counted in each constituency. Invalid ballot papers are excluded, as in the source field.",
			turnoutPeriods: "all",
			partyShareDenominator: {
				field: "validVotes",
				measureId: "general-election-valid-votes",
				label: "valid ballot papers",
			},
		}),
		...electionWinnerMeasures({
			datasetId: "general-election",
			geography: "constituency",
			label: "General election",
		}),
		...electionMeasures({
			datasetId: "local-election",
			geography: "ward",
			label: "Local election",
			countId: "local-election-effective-votes",
			countLabel: "Local election effective votes",
			countNote:
				"The sum across parties of each party's highest-polling candidate's votes in each ward, the House of Commons Library's basis for vote share in multi-member wards, applied to every polling year. It is not a count of ballot papers, and not every candidate's votes added up.",
			partyVoteNote:
				"Only the party's highest-polling candidate in a ward counts, so a party fielding several candidates in a multi-member ward is counted once. Independents are counted the same way, and every other party or group as its own party within Other candidates.",
			turnoutPeriods: "reported",
		}),
		...electionWinnerMeasures({
			datasetId: "local-election",
			geography: "ward",
			label: "Local election",
		}),
	];
	const electionMeasureDefinitions = [
		...new Map(
			electionObservations.map(({ measure }) => [measure.id, measure]),
		).values(),
	];
	return {
		measures: electionMeasureDefinitions,
		artifacts: electionObservations.map(({ artifact }) => artifact),
		observationDatasets: new Map(
			electionObservations.map(({ measure, artifact }) => [
				artifact,
				measure.sources[0]!.datasetId,
			]),
		),
	};
};
