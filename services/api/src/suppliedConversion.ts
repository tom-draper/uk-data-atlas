import type { ValidatedValue } from "@uk-data-atlas/atlas-runtime/api";
import {
	componentsThroughSteps,
	convertThroughSteps,
	type ConversionStep,
} from "@uk-data-atlas/atlas-runtime/relationships";
import type { PopulationObservation } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { PostedRows } from "./requestRows";

type Count = Pick<PopulationObservation, "areaCode" | "value">;
type RejectedRow = {
	index: number;
	area: string;
	reason: ValidatedValue["status"] | "duplicate-area" | "not-a-count";
	validation: ValidatedValue;
};

/** Reject the entire column if a row cannot supply one unambiguous count. */
export const readSuppliedCounts = (
	rows: PostedRows,
	validated: ValidatedValue[],
):
	| { kind: "accepted"; records: Count[] }
	| { kind: "rejected"; rejectedCount: number; rejected: RejectedRow[] } => {
	const occurrences = new Map<string, number>();
	for (const entry of validated)
		if (entry.status === "valid" || entry.status === "matched")
			occurrences.set(
				entry.area.code,
				(occurrences.get(entry.area.code) ?? 0) + 1,
			);
	const records: Count[] = [];
	const rejected: RejectedRow[] = [];
	let rejectedCount = 0;
	for (const entry of validated) {
		const value = rows.values?.[entry.index];
		const reason =
			entry.status !== "valid" && entry.status !== "matched"
				? entry.status
				: occurrences.get(entry.area.code) !== 1
					? "duplicate-area"
					: typeof value !== "number" ||
						  !Number.isFinite(value) ||
						  value < 0
						? "not-a-count"
						: undefined;
		if (reason !== undefined) {
			rejectedCount += 1;
			if (rejected.length < 1000)
				rejected.push({
					index: entry.index,
					area: entry.value,
					reason,
					validation: entry,
				});
		} else if (
			(entry.status === "valid" || entry.status === "matched") &&
			typeof value === "number"
		) {
			records.push({ areaCode: entry.area.code, value });
		}
	}
	return rejectedCount > 0
		? { kind: "rejected", rejectedCount, rejected }
		: { kind: "accepted", records };
};

/** Coverage counts the source codes the published crosswalk maps to each target. */
export const convertSuppliedCounts = (
	step: ConversionStep,
	records: Count[],
) => {
	const converted = convertThroughSteps([step], records);
	if (converted.status === "refused") return converted;
	const components = componentsThroughSteps([step]);
	const results = converted.records.map((record) => {
		const sourceCount = components.get(record.areaCode)?.size ?? 0;
		return {
			...record,
			coverage: {
				status:
					record.inputAreaCount === sourceCount
						? ("complete" as const)
						: ("partial" as const),
				sourceCount,
				suppliedSourceCount: record.inputAreaCount,
			},
		};
	});
	return {
		...converted,
		records: results,
		coverage: {
			scope: "published-crosswalk" as const,
			crosswalkSourceAreas: step.steps.size,
			sourceAreasSupplied: records.length,
			targetsComplete: results.filter(
				(record) => record.coverage.status === "complete",
			).length,
			targetsPartial: results.filter(
				(record) => record.coverage.status === "partial",
			).length,
			targetsNotReached: components.size - results.length,
		},
	};
};
