import { readFileSync } from "node:fs";
import {
	fromInferred,
	retiredCodes,
	type DiagnoseInput,
} from "@/lib/fix/diagnose";
import { successorsIn, type Successor } from "@/lib/fix/successors";
import type {
	AreaHistory,
	BoundaryRelease,
	ExactValidation,
	InferredValidation,
} from "@/lib/fix/types";

/**
 * Recorded from api.ukdataatlas.com for public/fix/sample-wards.csv: December
 * 2024 Wiltshire wards, five of them redrawn in May 2025, and one typo.
 */
export const fixture = <T>(name: string): T =>
	(
		JSON.parse(readFileSync(`tests/fixtures/fix/${name}.json`, "utf8")) as {
			data: T;
		}
	).data;

export const releases = fixture<BoundaryRelease[]>("boundary-releases");
export const inferred = fixture<InferredValidation>("validate-sample-inferred");
export const latest = fixture<ExactValidation>("validate-sample-latest");
export const history = (code: string) =>
	fixture<AreaHistory>(`history-${code}`);
export const LATEST = { geography: "ward", boundaryRelease: "2026-05-uk-bgc" };

export const codes = (successors: Successor[]) => successors.map((s) => s.code);

export function sampleInput(): DiagnoseInput {
	const primary = fromInferred(inferred);
	const successors = new Map<number, Successor[]>();
	for (const retired of retiredCodes(primary, latest))
		successors.set(
			retired.index,
			successorsIn(history(retired.code), LATEST),
		);
	return {
		column: "ward_cd",
		kind: "code",
		rowOf: inferred.values.map((_, i) => i),
		emptyRows: [],
		sentValues: inferred.values.map((value) => value.value),
		primary,
		latest,
		latestRelease: LATEST,
		successors,
		successorsUnchecked: 0,
		releases,
	};
}
