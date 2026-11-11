import { SERVED_WARD_CODES_UNTIL } from "@uk-data-atlas/datasets";
import { type DatasetInput, readDatasetInput } from "./input.ts";
import type {
	PopulationObservation,
	CategoricalObservation,
} from "@uk-data-atlas/catalogue/node";
import { type PrecompiledFile, string, number, object } from "./values.ts";

export type ElectionMeasureField =
	| { kind: "field"; field: string }
	| { kind: "partyVotes"; party: string }
	| { kind: "partyVoteShare"; party: string; denominator: string };

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
export const electionFieldPeriods = (
	path: DatasetInput,
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
	const source = JSON.parse(readDatasetInput(path)) as PrecompiledFile;
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
			// Keep modern election observations on codes held by their own
			// boundary-year release. Legacy equivalence corrections can point
			// to retired codes that are no longer present from 2021 onward.
			const corrections =
				entry.boundaryYear >= SERVED_WARD_CODES_UNTIL
					? undefined
					: wardCodeCorrections;
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
								corrections?.get(areaCode) ?? areaCode;
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
								corrections?.has(areaCode)),
					)
					.map(([areaCode, record]): [string, string] => [
						typeof (record as { sourceWardCode?: unknown })
							.sourceWardCode === "string"
							? (record as { sourceWardCode: string })
									.sourceWardCode
							: areaCode,
						corrections?.get(areaCode) ?? areaCode,
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
export const electionWinnerPeriods = (
	path: DatasetInput,
	geography: "constituency" | "ward",
	wardCodeCorrections: ReadonlyMap<string, string> = new Map(),
): Array<{
	period: string;
	boundaryYear: number;
	records: CategoricalObservation[];
}> => {
	const source = JSON.parse(readDatasetInput(path)) as PrecompiledFile;
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
			// These corrections normalize older polls to codes retained in their
			// release; applying them to modern polls emits codes retired before
			// the declared 2021+ boundary vintage.
			const corrections =
				entry.boundaryYear >= SERVED_WARD_CODES_UNTIL
					? undefined
					: wardCodeCorrections;
			const results = object(entry.results, `${path}.${period}.results`);
			return {
				period,
				boundaryYear: entry.boundaryYear,
				records: Object.entries(results)
					.flatMap(([areaCode, category]) => {
						if (electionCodeKind(areaCode) !== geography) return [];
						const servedAreaCode =
							corrections?.get(areaCode) ?? areaCode;
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
