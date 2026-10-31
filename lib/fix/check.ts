import {
	ApiError,
	areaHistory,
	boundaryReleases,
	mapLimit,
	validateAgainst,
	validateInferred,
	type ValidateBody,
} from "./api";
import {
	diagnose,
	fromExact,
	fromInferred,
	retiredCodes,
	type Diagnosis,
} from "./diagnose";
import { latestRelease, sameRelease } from "./releases";
import { successorsIn, type Successor } from "./successors";
import type { Table } from "./table";
import type { BoundaryRelease, ExactValidation, ReleaseRef } from "./types";

/** Most retired codes whose history is read in one check. */
export const HISTORY_LIMIT = 100;
const HISTORY_CONCURRENCY = 4;

export interface CheckRequest {
	table: Table;
	area: number;
	kind: "code" | "name";
	parent: number | null;
	/** A release the user chose, or null to let the API infer one. */
	release: ReleaseRef | null;
}

export interface CheckResult {
	diagnosis: Diagnosis;
	releases: BoundaryRelease[];
	/** The body sent to `/areas:validate`, for the copyable request. */
	body: ValidateBody;
	/** The latest release's validation, kept for updating codes. */
	latest: ExactValidation | null;
}

/** The area cells to send, with the rows they came from. */
export function columnValues(
	table: Table,
	area: number,
	parent: number | null,
) {
	const rowOf: number[] = [];
	const emptyRows: number[] = [];
	const values: string[] = [];
	const parents: string[] = [];
	table.rows.forEach((row, index) => {
		const value = row[area] ?? "";
		if (!value.trim()) {
			emptyRows.push(index);
			return;
		}
		rowOf.push(index);
		values.push(value);
		if (parent !== null) parents.push(row[parent] ?? "");
	});
	const body: ValidateBody =
		parent !== null ? { values, parents } : { values };
	return { rowOf, emptyRows, body };
}

export async function runCheck(
	request: CheckRequest,
	signal?: AbortSignal,
	onProgress?: (message: string) => void,
): Promise<CheckResult> {
	const { table, area, kind, parent } = request;
	const { rowOf, emptyRows, body } = columnValues(table, area, parent);
	if (body.values.length === 0)
		throw new ApiError(`Column "${table.headers[area]}" is empty.`, 0);

	onProgress?.(
		`Checking ${body.values.length.toLocaleString("en-GB")} ${kind}s against every boundary release…`,
	);
	const [releases, primary] = await Promise.all([
		boundaryReleases(),
		request.release
			? validateAgainst(request.release, body, signal).then(fromExact)
			: validateInferred(body, signal).then(fromInferred),
	]);

	const latestRef = primary.release
		? latestRelease(releases, primary.release.geography)
		: null;
	let latest: ExactValidation | null = null;
	if (latestRef && !sameRelease(latestRef, primary.release)) {
		onProgress?.("Checking them against the latest release…");
		latest = await validateAgainst(latestRef, body, signal);
	}

	const retired = retiredCodes(primary, latest);
	const toCheck = retired.slice(0, HISTORY_LIMIT);
	const successors = new Map<number, Successor[]>();
	if (latestRef && toCheck.length > 0) {
		onProgress?.(
			`Looking up what ${toCheck.length.toLocaleString("en-GB")} retired code${toCheck.length === 1 ? "" : "s"} became…`,
		);
		await mapLimit(toCheck, HISTORY_CONCURRENCY, async (code) => {
			try {
				const history = await areaHistory(code.from, code.code, signal);
				successors.set(code.index, successorsIn(history, latestRef));
			} catch (error) {
				if ((error as Error).name === "AbortError") throw error;
				// A code with no history to read has no published successor.
				if (error instanceof ApiError && error.status === 404)
					successors.set(code.index, []);
				else throw error;
			}
		});
	}

	const diagnosis = diagnose({
		column: table.headers[area],
		kind,
		rowOf,
		emptyRows,
		sentValues: body.values,
		primary,
		latest,
		latestRelease: latestRef,
		successors,
		successorsUnchecked: retired.length - toCheck.length,
		releases,
	});
	return { diagnosis, releases, body, latest };
}
