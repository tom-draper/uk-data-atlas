import {
	compareReleasesNewestFirst,
	findRelease,
	geographyLabel,
	releaseLabel,
	sameRelease,
} from "./releases";
import type { Successor } from "./successors";
import type {
	BoundaryRelease,
	ExactValidation,
	InferredValidation,
	ReleaseRef,
	ValidatedArea,
	ValidatedValue,
	ValidationSummary,
	ValueStatus,
} from "./types";

/**
 * Turns the API's answers about one column into the plain findings the page
 * shows. Every count here is read from a validation result; nothing is
 * guessed. Pure, so it can be tested on recorded responses.
 */

/** One column's validation against the release it was matched to. */
export interface PrimaryValidation {
	release: ReleaseRef | null;
	/** Whether the API chose the release, rather than the user. */
	inferred: boolean;
	tiedWith: ReleaseRef[];
	summary: ValidationSummary | null;
	values: ValidatedValue[];
	verdict?: string;
	atlasRelease?: string;
	inputSha256?: string;
}

export function fromInferred(result: InferredValidation): PrimaryValidation {
	const { likely } = result;
	return {
		release: likely
			? {
					geography: likely.geography,
					boundaryRelease: likely.boundaryRelease,
				}
			: null,
		inferred: true,
		tiedWith: likely?.tiedWith ?? [],
		summary: likely?.summary ?? null,
		values: result.values,
		verdict: result.verdict,
		atlasRelease: result.manifest?.atlasRelease,
		inputSha256: result.manifest?.input?.sha256,
	};
}

export function fromExact(result: ExactValidation): PrimaryValidation {
	return {
		release: {
			geography: result.geography,
			boundaryRelease: result.boundaryRelease,
		},
		inferred: false,
		tiedWith: [],
		summary: result.summary,
		values: result.values,
		atlasRelease: result.manifest?.atlasRelease,
		inputSha256: result.manifest?.input?.sha256,
	};
}

/** A retired code, and the release to read its history from. */
export interface RetiredCode {
	index: number;
	code: string;
	from: ReleaseRef;
}

/**
 * Codes the latest release no longer holds but an older one does. Their
 * history is read from the matched release when it holds them, otherwise
 * from the newest release that does.
 */
export function retiredCodes(
	primary: PrimaryValidation,
	latest: ExactValidation | null,
): RetiredCode[] {
	const current = latest ?? (primary.release ? primary : null);
	if (!current || !primary.release) return [];
	const geography = primary.release.geography;
	const retired: RetiredCode[] = [];
	for (const result of current.values) {
		if (result.kind !== "code" || result.status !== "superseded") continue;
		if (result.duplicateOf !== undefined) continue;
		const inPrimary = primary.values[result.index];
		const release =
			inPrimary?.status === "valid"
				? primary.release.boundaryRelease
				: result.presentIn
						?.map((entry) => entry.boundaryRelease)
						.sort(compareReleasesNewestFirst)[0];
		if (!release) continue;
		retired.push({
			index: result.index,
			code: inPrimary?.area?.code ?? result.value.trim().toUpperCase(),
			from: { geography, boundaryRelease: release },
		});
	}
	return retired;
}

export type Tone = "ok" | "warn" | "error" | "info";

export interface AffectedRow {
	/** 1-based row in the user's file, counting the header as row 1. */
	line: number;
	value: string;
	note?: string;
}

export interface Finding {
	id: string;
	tone: Tone;
	title: string;
	detail?: string;
	rows: AffectedRow[];
}

/** What is known about one row's area after the check. */
export interface RowResult {
	/** Index into the table's rows. */
	row: number;
	value: string;
	status: ValueStatus | "empty";
	area?: ValidatedArea;
	/** Status in the latest release, when that differs from the matched one. */
	latestStatus?: ValueStatus;
	/** The area in the latest release, when that differs from the matched one. */
	latestArea?: ValidatedArea;
	/** The areas a retired code became, when its history was read. */
	successors?: Successor[];
	detail?: string;
	duplicateOf?: number;
}

export interface Diagnosis {
	column: string;
	kind: "code" | "name";
	release: ReleaseRef | null;
	releaseLabel: string | null;
	inferred: boolean;
	tiedWith: string[];
	latest: ReleaseRef | null;
	latestLabel: string | null;
	matched: number;
	total: number;
	findings: Finding[];
	results: RowResult[];
	atlasRelease?: string;
	inputSha256?: string;
}

export interface DiagnoseInput {
	column: string;
	kind: "code" | "name";
	/** For each value sent, its index in the table's rows. */
	rowOf: number[];
	/** Table row indexes whose area cell is empty. */
	emptyRows: number[];
	primary: PrimaryValidation;
	/** The same values checked against the latest release, if that is another release. */
	latest: ExactValidation | null;
	latestRelease: ReleaseRef | null;
	/** Successors found for retired codes, by value index. */
	successors: Map<number, Successor[]>;
	/** Retired codes whose history was not read, because there were too many. */
	successorsUnchecked: number;
	/** The values sent, in order. */
	sentValues: string[];
	releases: BoundaryRelease[];
}

const NATIONS: Record<string, { name: string; country: string }> = {
	E: { name: "England", country: "GB-ENG" },
	W: { name: "Wales", country: "GB-WLS" },
	S: { name: "Scotland", country: "GB-SCT" },
	N: { name: "Northern Ireland", country: "GB-NIR" },
};

const plural = (value: number, one: string, many = `${one}s`) =>
	`${value.toLocaleString("en-GB")} ${value === 1 ? one : many}`;

const count = (value: number) => value.toLocaleString("en-GB");

/** "England and Wales", "England, Wales and Scotland". */
export function listWords(words: string[]): string {
	if (words.length <= 1) return words.join("");
	return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The file line of a table row: the header is line 1. */
const lineOf = (row: number) => row + 2;

export function diagnose(input: DiagnoseInput): Diagnosis {
	const { primary, latest, releases, kind } = input;
	const release = primary.release;
	const latestRelease = input.latestRelease;
	const latestIsOther = !!latest && !sameRelease(release, latestRelease);
	const latestValues = latestIsOther ? latest.values : primary.values;
	const label = (ref: ReleaseRef) => releaseLabel(releases, ref);
	const noun = kind === "code" ? "code" : "name";

	const results: RowResult[] = input.emptyRows.map((row) => ({
		row,
		value: "",
		status: "empty",
	}));
	// When nothing matches any release, the API returns no per-value results.
	const values: ValidatedValue[] =
		primary.values.length > 0 || !primary.inferred
			? primary.values
			: input.sentValues.map((value, index) => ({
					index,
					value,
					kind,
					status: kind === "code" ? "unknown" : "unmatched",
				}));
	values.forEach((value, index) => {
		const inLatest = latestValues[index];
		results.push({
			row: input.rowOf[value.index] ?? index,
			value: value.value,
			status: value.status,
			area: value.area,
			latestStatus:
				latestIsOther && inLatest ? inLatest.status : undefined,
			latestArea: latestIsOther ? inLatest?.area : undefined,
			successors: input.successors.get(value.index),
			detail: value.detail,
			duplicateOf:
				value.duplicateOf !== undefined
					? input.rowOf[value.duplicateOf]
					: undefined,
		});
	});
	results.sort((a, b) => a.row - b.row);

	const byStatus = (status: ValueStatus) =>
		results.filter((result) => result.status === status);
	const affected = (rows: RowResult[], note?: (row: RowResult) => string) =>
		rows.map((result) => ({
			line: lineOf(result.row),
			value: result.value,
			note: note?.(result),
		}));

	const findings: Finding[] = [];
	const matched = results.filter(
		(result) => result.status === "valid" || result.status === "matched",
	);
	const releaseName = release ? label(release) : null;
	const latestName = latestRelease ? label(latestRelease) : null;

	if (matched.length > 0 && release) {
		const current = !latestIsOther && sameRelease(release, latestRelease);
		findings.push({
			id: "valid",
			tone: "ok",
			title: `${plural(matched.length, kind === "code" ? "code" : "name")} ${kind === "code" ? "valid" : "matched"} in ${releaseName}`,
			detail: current ? "This is the latest release." : undefined,
			rows: [],
		});
	}

	// Codes the latest release no longer holds, with what they became.
	const retired = results.filter(
		(result) =>
			result.duplicateOf === undefined &&
			(latestIsOther
				? result.latestStatus === "superseded"
				: result.status === "superseded"),
	);
	const retiredSinceMatch = retired.filter((r) => r.status === "valid");
	const olderThanMatch = retired.filter((r) => r.status !== "valid");
	const successorSummary = (rows: RowResult[]) => {
		const one = rows.filter((r) => r.successors?.length === 1).length;
		const split = rows.filter(
			(r) => (r.successors?.length ?? 0) > 1,
		).length;
		const none = rows.filter((r) => r.successors?.length === 0).length;
		const parts = [
			one && `${count(one)} ${one === 1 ? "has" : "have"} one successor`,
			split && `${count(split)} split into several areas`,
			none && `${count(none)} with no published successor`,
		].filter(Boolean);
		const text = parts.join(", ");
		return text.charAt(0).toUpperCase() + text.slice(1);
	};
	const successorNote = (row: RowResult) => {
		if (!row.successors) return "History not checked";
		if (row.successors.length === 0) return "No published successor";
		return `Became ${listWords(row.successors.map((s) => `${s.name} (${s.code})`))}`;
	};
	const found = (rows: RowResult[]) =>
		rows.filter((r) => (r.successors?.length ?? 0) > 0).length;

	if (retiredSinceMatch.length > 0 && latestName) {
		findings.push({
			id: "retired",
			tone: "warn",
			title: `${plural(retiredSinceMatch.length, "code")} retired since ${releaseName?.split(", ").slice(1).join(", ") || releaseName} → successors found for ${count(found(retiredSinceMatch))}`,
			detail: `Not in ${latestName}, the latest release. ${successorSummary(retiredSinceMatch)}.`,
			rows: affected(retiredSinceMatch, successorNote),
		});
	}
	if (olderThanMatch.length > 0) {
		findings.push({
			id: "older",
			tone: "warn",
			title: `${plural(olderThanMatch.length, "code")} from an older release → successors found for ${count(found(olderThanMatch))}`,
			detail: `${olderThanMatch.length === 1 ? "It is" : "They are"} not in ${releaseName ?? "the matched release"}. ${successorSummary(olderThanMatch)}.`,
			rows: affected(olderThanMatch, successorNote),
		});
	}
	if (input.successorsUnchecked > 0) {
		findings.push({
			id: "unchecked",
			tone: "info",
			title: `History not checked for ${plural(input.successorsUnchecked, "retired code")}`,
			detail: "Only the first retired codes are looked up, to keep the check quick.",
			rows: [],
		});
	}

	const newer = byStatus("not-yet-current");
	if (newer.length > 0) {
		findings.push({
			id: "newer",
			tone: "warn",
			title: `${plural(newer.length, "code")} from a newer release`,
			detail: `${newer.length === 1 ? "It is" : "They are"} not in ${releaseName}, so the file mixes releases.`,
			rows: affected(newer),
		});
	}

	const gap = byStatus("absent-from-release");
	if (gap.length > 0) {
		findings.push({
			id: "absent",
			tone: "warn",
			title: `${plural(gap.length, "code")} missing from this release`,
			detail: "Releases before and after it hold them, but this one does not.",
			rows: affected(gap),
		});
	}

	const other = results.filter(
		(result) =>
			result.status === "other-geography" &&
			result.duplicateOf === undefined,
	);
	if (other.length > 0) {
		const geographies = new Set(
			primary.values
				.filter((value) => value.status === "other-geography")
				.flatMap(
					(value) => value.heldBy?.map((h) => h.geography) ?? [],
				),
		);
		const names = [...geographies].map((geography) =>
			geographyLabel(releases, geography).toLowerCase(),
		);
		findings.push({
			id: "other-geography",
			tone: "warn",
			title: `${plural(other.length, "code")} from another kind of area`,
			detail: names.length
				? `The API holds ${other.length === 1 ? "it" : "them"} as ${listWords(names)}.`
				: undefined,
			rows: affected(other),
		});
	}

	const malformed = byStatus("malformed-code");
	if (malformed.length > 0) {
		findings.push({
			id: "malformed",
			tone: "error",
			title: `${plural(malformed.length, "value")} ${malformed.length === 1 ? "is not a" : "are not"} valid area code${malformed.length === 1 ? "" : "s"}`,
			detail: "Likely typos. Check them against the source.",
			rows: affected(malformed, (row) => row.detail ?? ""),
		});
	}

	const unknown = byStatus("unknown");
	if (unknown.length > 0) {
		findings.push({
			id: "unknown",
			tone: "error",
			title: `${plural(unknown.length, "code")} not recognised`,
			detail: "No boundary release we hold has them.",
			rows: affected(unknown),
		});
	}

	const ambiguous = byStatus("ambiguous");
	if (ambiguous.length > 0) {
		findings.push({
			id: "ambiguous",
			tone: "warn",
			title: `${plural(ambiguous.length, "name")} match more than one area`,
			detail: "Choose a parent column, such as local authority, to settle them.",
			rows: affected(ambiguous, (row) => {
				const count =
					primary.values.find(
						(value) => input.rowOf[value.index] === row.row,
					)?.candidates?.length ?? 0;
				return count ? `${count} areas share this name` : "";
			}),
		});
	}

	const unmatched = byStatus("unmatched");
	if (unmatched.length > 0) {
		findings.push({
			id: "unmatched",
			tone: "error",
			title: `${plural(unmatched.length, "name")} not recognised`,
			detail: "Names match exactly or through published aliases only.",
			rows: affected(unmatched),
		});
	}

	const duplicates = results.filter((r) => r.duplicateOf !== undefined);
	if (duplicates.length > 0) {
		findings.push({
			id: "duplicates",
			tone: "info",
			title: `${plural(duplicates.length, "row")} repeat${duplicates.length === 1 ? "s" : ""} an earlier ${noun}`,
			rows: affected(
				duplicates,
				(row) => `Same as row ${lineOf(row.duplicateOf ?? 0)}`,
			),
		});
	}

	const normalised = primary.values.filter((v) => v.normalised?.length);
	if (normalised.length > 0) {
		findings.push({
			id: "normalised",
			tone: "info",
			title: `${plural(normalised.length, noun)} had extra spaces or the wrong case`,
			detail: "They were read anyway.",
			rows: affected(
				results.filter((result) =>
					normalised.some(
						(value) => input.rowOf[value.index] === result.row,
					),
				),
			),
		});
	}

	if (input.emptyRows.length > 0) {
		findings.push({
			id: "empty",
			tone: "info",
			title: `${plural(input.emptyRows.length, "row")} ${input.emptyRows.length === 1 ? "has" : "have"} no area`,
			rows: affected(byStatusEmpty(results)),
		});
	}

	const nations = nationNote(
		matched,
		release ? findRelease(releases, release) : undefined,
	);
	if (nations) findings.push(nations);

	return {
		column: input.column,
		kind,
		release,
		releaseLabel: releaseName,
		inferred: primary.inferred,
		tiedWith: primary.tiedWith.map(label),
		latest: latestRelease,
		latestLabel: latestName,
		matched: matched.length,
		total: primary.values.length,
		findings,
		results,
		atlasRelease: primary.atlasRelease,
		inputSha256: primary.inputSha256,
	};
}

const byStatusEmpty = (results: RowResult[]) =>
	results.filter((result) => result.status === "empty");

/**
 * Which nations the matched areas are in, said only when the release covers
 * more of the UK than the file does. A GSS code's first letter is its nation.
 */
function nationNote(
	matched: RowResult[],
	release: BoundaryRelease | undefined,
): Finding | null {
	const covered = release?.coverage?.countries ?? [];
	if (matched.length === 0 || covered.length < 2) return null;
	const present = new Set(
		matched
			.map((result) => (result.area?.code ?? result.value).trim()[0])
			.map((letter) => letter?.toUpperCase() ?? ""),
	);
	const inFile = Object.entries(NATIONS).filter(([letter]) =>
		present.has(letter),
	);
	const missing = Object.entries(NATIONS).filter(
		([letter, nation]) =>
			!present.has(letter) && covered.includes(nation.country),
	);
	if (inFile.length === 0 || missing.length === 0) return null;
	const names = (entries: typeof inFile) =>
		listWords(entries.map(([, nation]) => nation.name));
	return {
		id: "nations",
		tone: "info",
		title: `${names(inFile)} only. ${names(missing)} not present.`,
		rows: [],
	};
}
