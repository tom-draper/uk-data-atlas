import { readFileSync } from "node:fs";
import type {
	SourceGeography,
	MeasureAggregation,
	Measure,
	PopulationObservation,
	CategoricalObservation,
} from "../dataCatalog";
import { type PrecompiledFile, sha256, string, number, object } from "./values";
import { countriesFor } from "./countries";
import type { CatalogManifest } from "./manifest";

type ElectionMeasureField =
	| { kind: "field"; field: string }
	| { kind: "partyVotes"; party: string }
	| { kind: "partyVoteShare"; party: string; denominator: string };

/**
 * LEAP source codes with the same official ward extent as the polling year's
 * release under the Atlas's published 99% overlap rule. Materially different
 * boundaries deliberately remain on the publisher's code.
 */
const servedLocalElectionWardCodeCorrections = new Map<string, string>([
	["E05011348", "E05010919"],
	["E05011349", "E05010920"],
	["E05012969", "E05010931"],
	["E05008537", "E05008939"],
	["W05000868", "W05001012"],
	["E05012841", "E05011382"],
	["E05012842", "E05011383"],
	["E05012647", "E05011386"],
	["E05012648", "E05011392"],
	["E05013830", "E05011393"],
	["E05013831", "E05011412"],
]);

const electionCodeKind = (code: string) =>
	/^[EW]05\d{6}$/.test(code)
		? "ward"
		: /^E58\d{6}$/.test(code)
			? "countyElectoralDivision"
			: /^(E14|W07|S14|N0[56])\d{6}$/.test(code)
				? "constituency"
				: undefined;

/**
 * Read one numeric series from a compiled election dataset. Election boundary
 * vintages legitimately change between polling years, so the caller later
 * splits these periods into source-geography partitions rather than claiming
 * one timeless constituency or ward geography.
 */
const electionFieldPeriods = (
	path: string,
	geography: "constituency" | "ward",
	field: ElectionMeasureField,
	wardCodeCorrections: ReadonlyMap<string, string> = new Map(),
): Array<{
	period: string;
	boundaryYear: number;
	records: PopulationObservation[];
	unaddressableRecordCount: number;
	otherGeographyRecordCount: number;
	/** Whether the source published the area codes or they were matched by name. */
	areaCodes: "published" | "name-matched";
	/** Source areas left out upstream because no single official code fits. */
	excludedAreaCount: number;
	/**
	 * Areas the source gave a code other than that of the area the election
	 * was held in, as [source code, served code].
	 */
	correctedCodes: Array<[string, string]>;
}> => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PrecompiledFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			if (!/^\d{4}$/.test(period))
				throw new Error(`${path}: invalid election period ${period}`);
			const entry = object(value, `${path}.${period}`);
			if (
				entry.year !== Number(period) ||
				entry.boundaryType !== geography ||
				typeof entry.boundaryYear !== "number"
			) {
				throw new Error(
					`${path}.${period}: expected ${geography} election data with a boundary year`,
				);
			}
			const data = object(entry.data, `${path}.${period}.data`);
			const unaddressableCodes = Object.keys(data).filter(
				(areaCode) => !electionCodeKind(areaCode) && areaCode !== "NA",
			);
			if (unaddressableCodes.length > 0) {
				throw new Error(
					`${path}.${period}: unsupported area code ${unaddressableCodes[0]}`,
				);
			}
			const otherGeographyRecordCount = Object.keys(data).filter(
				(areaCode) => {
					const kind = electionCodeKind(areaCode);
					return kind !== undefined && kind !== geography;
				},
			).length;
			return {
				period,
				boundaryYear: entry.boundaryYear,
				records: Object.entries(data)
					.map(
						([areaCode, record]):
							PopulationObservation | undefined => {
							if (electionCodeKind(areaCode) !== geography) {
								return undefined;
							}
							const row = object(
								record,
								`${path}.${period}.${areaCode}`,
							);
							const observed =
								field.kind === "field"
									? row[field.field]
									: field.kind === "partyVotes"
										? (object(
												row.partyVotes,
												`${path}.${period}.${areaCode}.partyVotes`,
											)[field.party] ?? 0)
										: (() => {
												const denominator = number(
													row[field.denominator],
													`${path}.${period}.${areaCode}.${field.denominator}`,
												);
												if (denominator <= 0) {
													throw new Error(
														`${path}.${period}.${areaCode}.${field.denominator} must be greater than zero for a party vote share`,
													);
												}
												const partyVotes =
													object(
														row.partyVotes,
														`${path}.${period}.${areaCode}.partyVotes`,
													)[field.party] ?? 0;
												return (
													(100 *
														number(
															partyVotes,
															`${path}.${period}.${areaCode}.partyVotes.${field.party}`,
														)) /
													denominator
												);
											})();
							const servedAreaCode =
								wardCodeCorrections.get(areaCode) ?? areaCode;
							return {
								areaCode: servedAreaCode,
								...(servedAreaCode === areaCode
									? {}
									: { sourceAreaCode: areaCode }),
								value: number(
									observed,
									`${path}.${period}.${areaCode}.${
										field.kind === "field"
											? field.field
											: field.kind === "partyVotes"
												? `partyVotes.${field.party}`
												: `partyVoteShare.${field.party}`
									}`,
								),
								status: "observed" as const,
							};
						},
					)
					.filter(
						(record): record is PopulationObservation =>
							record !== undefined,
					)
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
				unaddressableRecordCount: Object.keys(data).filter(
					(areaCode) => areaCode === "NA",
				).length,
				otherGeographyRecordCount,
				areaCodes:
					entry.wardCodes === "name-matched"
						? ("name-matched" as const)
						: ("published" as const),
				excludedAreaCount: Array.isArray(entry.excludedWards)
					? entry.excludedWards.length
					: 0,
				correctedCodes: Object.entries(data)
					.filter(
						([areaCode, record]) =>
							electionCodeKind(areaCode) === geography &&
							(typeof (record as { sourceWardCode?: unknown })
								.sourceWardCode === "string" ||
								wardCodeCorrections.has(areaCode)),
					)
					.map(([areaCode, record]): [string, string] => [
						typeof (record as { sourceWardCode?: unknown })
							.sourceWardCode === "string"
							? (record as { sourceWardCode: string })
									.sourceWardCode
							: areaCode,
						wardCodeCorrections.get(areaCode) ?? areaCode,
					])
					.sort(([left], [right]) => left.localeCompare(right)),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0)
		throw new Error(`${path} has no election periods`);
	return periods;
};

/** Read the publisher's winning-party label without coercing it to a number. */
const electionWinnerPeriods = (
	path: string,
	geography: "constituency" | "ward",
	wardCodeCorrections: ReadonlyMap<string, string> = new Map(),
): Array<{
	period: string;
	boundaryYear: number;
	records: CategoricalObservation[];
}> => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PrecompiledFile;
	const periods = Object.entries(source)
		.map(([period, value]) => {
			const entry = object(value, `${path}.${period}`);
			if (
				!/^\d{4}$/.test(period) ||
				entry.year !== Number(period) ||
				entry.boundaryType !== geography ||
				typeof entry.boundaryYear !== "number"
			) {
				throw new Error(
					`${path}.${period}: expected ${geography} election results with a boundary year`,
				);
			}
			const results = object(entry.results, `${path}.${period}.results`);
			return {
				period,
				boundaryYear: entry.boundaryYear,
				records: Object.entries(results)
					.flatMap(([areaCode, category]) => {
						if (electionCodeKind(areaCode) !== geography) return [];
						const servedAreaCode =
							wardCodeCorrections.get(areaCode) ?? areaCode;
						return [
							{
								areaCode: servedAreaCode,
								...(servedAreaCode === areaCode
									? {}
									: { sourceAreaCode: areaCode }),
								category: string(
									category,
									`${path}.${period}.results.${areaCode}`,
								),
								status: "observed" as const,
							},
						];
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0)
		throw new Error(`${path} has no election result periods`);
	return periods;
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
	generalElectionPath: string,
	localElectionPath: string,
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
	const electionMeasures = (election: {
		datasetId: "general-election" | "local-election";
		path: string;
		geography: "constituency" | "ward";
		label: string;
		countField: string;
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
		wardCodeCorrections?: ReadonlyMap<string, string>;
	}) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === election.datasetId,
		);
		if (!dataset)
			throw new Error(
				`${manifestPath} has no ${election.datasetId} dataset`,
			);
		const countPeriods = electionFieldPeriods(
			election.path,
			election.geography,
			{
				kind: "field",
				field: election.countField,
			},
			election.wardCodeCorrections,
		);
		const recordCount = countPeriods.reduce(
			(total, period) => total + period.records.length,
			0,
		);
		const unaddressableRecordCount = countPeriods.reduce(
			(total, period) => total + period.unaddressableRecordCount,
			0,
		);
		const otherGeographyRecordCount = countPeriods.reduce(
			(total, period) => total + period.otherGeographyRecordCount,
			0,
		);
		if (
			recordCount +
				unaddressableRecordCount +
				otherGeographyRecordCount !==
			dataset.summary.dataRecordCount
		) {
			throw new Error(
				`${election.path}: expected ${dataset.summary.dataRecordCount} records from the manifest, found ${recordCount} ${election.geography} records, ${otherGeographyRecordCount} records in another geography and ${unaddressableRecordCount} unaddressable`,
			);
		}
		if (countPeriods.length !== dataset.summary.datasetCount) {
			throw new Error(
				`${election.path}: expected ${dataset.summary.datasetCount} election periods from the manifest, found ${countPeriods.length}`,
			);
		}

		const parties = [
			...new Set(
				Object.values(
					JSON.parse(
						readFileSync(election.path, "utf8"),
					) as PrecompiledFile,
				).flatMap((value) =>
					Object.values(
						object(value, election.path).data as Record<
							string,
							unknown
						>,
					).flatMap((record) =>
						Object.keys(
							object(record, election.path).partyVotes as Record<
								string,
								unknown
							>,
						),
					),
				),
			),
		].sort();
		const partyShareDenominator = election.partyShareDenominator;
		const metrics: Array<{
			id: string;
			label: string;
			field: ElectionMeasureField;
			aggregation: MeasureAggregation;
			notes: string[];
			filter?: (period: (typeof countPeriods)[number]) => boolean;
		}> = [
			{
				id: election.countId,
				label: election.countLabel,
				field: { kind: "field", field: election.countField },
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				notes: [
					election.countNote,
					...(unaddressableRecordCount > 0
						? [
								`${unaddressableRecordCount} source row${unaddressableRecordCount === 1 ? "" : "s"} with the literal ward code NA is excluded: it has no official area identity to which the API can attach a value.`,
							]
						: []),
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
			const periods = electionFieldPeriods(
				election.path,
				election.geography,
				metric.field,
				election.wardCodeCorrections,
			).filter(metric.filter ?? (() => true));
			const byBoundaryYear = new Map<number, typeof periods>();
			for (const period of periods) {
				const partition = byBoundaryYear.get(period.boundaryYear) ?? [];
				partition.push(period);
				byBoundaryYear.set(period.boundaryYear, partition);
			}
			const sources = [...byBoundaryYear.entries()]
				.sort(([left], [right]) => left - right)
				.map(([boundaryYear, sourcePeriods]) => {
					const sourceUnaddressableRecordCount = sourcePeriods.reduce(
						(total, period) =>
							total + period.unaddressableRecordCount,
						0,
					);
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
						(period) => period.areaCodes === "name-matched",
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
							} Record coverage varies with the areas that held an election.${correctedCodes.length > 0 ? ` The source gives ${correctedCodes.length} area${correctedCodes.length === 1 ? "" : "s"} a code other than that of the area the election was held in, and ${correctedCodes.length === 1 ? "it is" : "they are"} served under the code in force at the election: ${correctedCodes.map(([source, served]) => `${source} as ${served}`).join(", ")}.` : ""}${sourceUnaddressableRecordCount > 0 ? " Rows with the literal, unaddressable code NA are excluded." : ""}${excludedAreaCount > 0 ? ` ${excludedAreaCount} source area${excludedAreaCount === 1 ? " is" : "s are"} excluded because no single official code fits ${excludedAreaCount === 1 ? "it" : "them"}.` : ""}${sourceOtherGeographyRecordCount > 0 ? " County-electoral-division rows are excluded from this ward measure pending historical boundary releases." : ""}`,
						},
					};
				});
			const measure: Measure = {
				id: metric.id,
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
					measureId: metric.id,
					sourceGeography: source.sourceGeography,
					periods: artifactPeriods,
				});
				return {
					measure,
					artifact: {
						schemaVersion: 1 as const,
						contentHash: sha256(content),
						measureId: metric.id,
						sourceGeography: source.sourceGeography,
						periods: artifactPeriods,
					},
				};
			});
		});
	};
	const electionWinnerMeasures = (election: {
		datasetId: "general-election" | "local-election";
		path: string;
		geography: "constituency" | "ward";
		label: string;
		wardCodeCorrections?: ReadonlyMap<string, string>;
	}) => {
		const periods = electionWinnerPeriods(
			election.path,
			election.geography,
			election.wardCodeCorrections,
		);
		const byBoundaryYear = new Map<number, typeof periods>();
		for (const period of periods) {
			const partition = byBoundaryYear.get(period.boundaryYear) ?? [];
			partition.push(period);
			byBoundaryYear.set(period.boundaryYear, partition);
		}
		const measureId = `${election.datasetId}-winning-party`;
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
				measureId,
				sourceGeography: source.sourceGeography,
				periods: artifactPeriods,
			});
			return {
				measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId,
					sourceGeography: source.sourceGeography,
					periods: artifactPeriods,
				},
			};
		});
	};
	const electionObservations = [
		...electionMeasures({
			datasetId: "general-election",
			path: generalElectionPath,
			geography: "constituency",
			label: "General election",
			countField: "validVotes",
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
			path: generalElectionPath,
			geography: "constituency",
			label: "General election",
		}),
		...electionMeasures({
			datasetId: "local-election",
			path: localElectionPath,
			geography: "ward",
			label: "Local election",
			countField: "totalVotes",
			countId: "local-election-effective-votes",
			countLabel: "Local election effective votes",
			countNote:
				"The sum across parties of each party's highest-polling candidate's votes in each ward, the House of Commons Library's basis for vote share in multi-member wards, applied to every polling year. It is not a count of ballot papers, and not every candidate's votes added up.",
			partyVoteNote:
				"Only the party's highest-polling candidate in a ward counts, so a party fielding several candidates in a multi-member ward is counted once. Independents are counted the same way, and every other party or group as its own party within Other candidates.",
			turnoutPeriods: "reported",
			wardCodeCorrections: servedLocalElectionWardCodeCorrections,
		}),
		...electionWinnerMeasures({
			datasetId: "local-election",
			path: localElectionPath,
			geography: "ward",
			label: "Local election",
			wardCodeCorrections: servedLocalElectionWardCodeCorrections,
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
	};
};
