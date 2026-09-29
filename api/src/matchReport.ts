import { createHash } from "node:crypto";
import type { ValidatedValue } from "./batchValidation";

type MatchResult = {
	likely?: {
		geography: string;
		boundaryRelease: string;
		resolved: number;
	};
	verdict: string;
	candidates: Array<{
		geography: string;
		boundaryRelease: string;
		resolved: number;
		ambiguous: number;
	}>;
	recommendations: Array<{ id: string }>;
	values: ValidatedValue[];
};

export type MatchManifest = {
	schemaVersion: 1;
	atlasRelease: string;
	input: { sha256: string; values: string[]; parents?: string[] };
	result: {
		verdict: string;
		likely?: {
			geography: string;
			boundaryRelease: string;
			resolved: number;
		};
		candidates: MatchResult["candidates"];
		recommendations: string[];
	};
};

const csv = (value: string | number | undefined) =>
	`"${String(value ?? "").replaceAll('"', '""')}"`;

/**
 * Pins a match diagnosis to the exact submitted column and Atlas release.
 * The digest lets a caller verify that a later rerun used the same input.
 */
export const matchManifest = (
	atlasRelease: string,
	values: string[],
	parents: string[] | undefined,
	result: MatchResult,
): MatchManifest => ({
	schemaVersion: 1,
	atlasRelease,
	input: {
		sha256: `sha256:${createHash("sha256")
			.update(JSON.stringify({ values, parents: parents ?? [] }))
			.digest("hex")}`,
		values,
		...(parents ? { parents } : {}),
	},
	result: {
		verdict: result.verdict,
		...(result.likely ? { likely: result.likely } : {}),
		candidates: result.candidates,
		recommendations: result.recommendations.map(({ id }) => id),
	},
});

const area = (value: ValidatedValue) =>
	"area" in value
		? value.area
		: value.status === "ambiguous"
			? value.candidates.map(({ code }) => code).join(" | ")
			: undefined;

/** A portable, row-preserving rendering of the same diagnostic as the JSON. */
export const exportMatchReport = (
	manifest: MatchManifest,
	values: ValidatedValue[],
): string => {
	const columns = [
		"atlasRelease",
		"inputSha256",
		"verdict",
		"likelyGeography",
		"likelyRelease",
		"index",
		"value",
		"parent",
		"kind",
		"status",
		"normalised",
		"duplicateOf",
		"areaId",
		"areaCode",
		"areaName",
		"candidates",
	] as const;
	const rows = values.map((value) => {
		const resolved = area(value);
		const matched = typeof resolved === "object" ? resolved : undefined;
		return {
			atlasRelease: manifest.atlasRelease,
			inputSha256: manifest.input.sha256,
			verdict: manifest.result.verdict,
			likelyGeography: manifest.result.likely?.geography,
			likelyRelease: manifest.result.likely?.boundaryRelease,
			index: value.index,
			value: value.value,
			parent: manifest.input.parents?.[value.index],
			kind: value.kind,
			status: value.status,
			normalised: value.normalised?.join(" | "),
			duplicateOf: value.duplicateOf,
			areaId: matched?.id,
			areaCode: matched?.code,
			areaName: matched?.name,
			candidates: typeof resolved === "string" ? resolved : undefined,
		};
	});
	return (
		[
			columns.join(","),
			...rows.map((row) =>
				columns.map((column) => csv(row[column])).join(","),
			),
		].join("\n") + "\n"
	);
};
