import type { PopulationObservation } from "./dataCatalog";
import type { NamedLocation } from "./namedLocations";

export const aggregateLocationMembers = (
	location: NamedLocation,
	records: PopulationObservation[],
) => {
	const byCode = new Map(records.map((record) => [record.areaCode, record]));
	const members = location.memberCodes.flatMap((code) => {
		const record = byCode.get(code);
		return record ? [record] : [];
	});
	const unresolvedMemberCodes = location.memberCodes.filter(
		(code) => !byCode.has(code),
	);
	return {
		members,
		unresolvedMemberCodes,
		value: members.reduce((sum, record) => sum + record.value, 0),
	};
};

/**
 * The GSS code letter every area in a country shares with the country itself.
 *
 * This is definitional rather than geometric: the coding scheme assigns the
 * first character by country, so membership needs no boundary comparison and
 * cannot drift between releases.
 */
const COUNTRY_BY_LETTER: Record<string, string> = {
	E: "E92000001",
	N: "N92000002",
	S: "S92000003",
	W: "W92000004",
};

export const countryCodeFor = (areaCode: string): string | undefined =>
	COUNTRY_BY_LETTER[areaCode.slice(0, 1)];

export const isCountryCode = (code: string): boolean =>
	Object.values(COUNTRY_BY_LETTER).includes(code);

/**
 * Sum the observations of one country within a source partition.
 *
 * The total covers every area of that country the partition publishes, which
 * is not the same as national completeness: a partition covering England and
 * Wales only will still answer for England, and says so.
 */
export const aggregateCountryMembers = (
	countryCode: string,
	records: PopulationObservation[],
) => {
	const members = records.filter(
		(record) => countryCodeFor(record.areaCode) === countryCode,
	);
	return {
		members,
		value: members.reduce((sum, record) => sum + record.value, 0),
	};
};

const MISSING_SAMPLE_SIZE = 10;

export type CoverageAssessment = {
	boundaryRelease: string;
	status: "complete" | "partial";
	expectedAreaCount: number;
	includedAreaCount: number;
	missingAreaCount: number;
	/** The first missing codes in order, so a partial sum can be checked. */
	missingAreaSample: string[];
};

export type AggregateCoverage =
	| {
			status: "complete";
			assessments: CoverageAssessment[];
	  }
	| {
			status: "partial";
			code: "partial_coverage";
			assessments: CoverageAssessment[];
	  }
	| { status: "not-assessed"; reason: string };

/** How many of the areas a release expects the aggregate actually summed. */
export const assessCoverage = (
	boundaryRelease: string,
	expectedCodes: Iterable<string>,
	includedCodes: Set<string>,
): CoverageAssessment => {
	const expected = [...new Set(expectedCodes)];
	const missing = expected.filter((code) => !includedCodes.has(code)).sort();
	return {
		boundaryRelease,
		status: missing.length === 0 ? "complete" : "partial",
		expectedAreaCount: expected.length,
		includedAreaCount: expected.length - missing.length,
		missingAreaCount: missing.length,
		missingAreaSample: missing.slice(0, MISSING_SAMPLE_SIZE),
	};
};

/**
 * One coverage verdict over every release the partition was compared with.
 * An aggregate is partial if any of them expects an area it did not sum:
 * a total that only one reading of its geography calls complete is not.
 */
export const summariseCoverage = (
	assessments: CoverageAssessment[],
	reasonIfNone: string,
): AggregateCoverage => {
	if (assessments.length === 0)
		return { status: "not-assessed", reason: reasonIfNone };
	return assessments.some((assessment) => assessment.status === "partial")
		? { status: "partial", code: "partial_coverage", assessments }
		: { status: "complete", assessments };
};

/** How a non-aggregatable statistic reads in a sentence. */
export const statisticPhrase = (statistic: string) =>
	({
		median: "a median",
		rank: "a rank",
		decile: "a decile",
		"life-expectancy": "a life expectancy",
	})[statistic] ?? `a ${statistic}`;
