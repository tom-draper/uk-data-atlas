import { areaSeries } from "./client";
import { latestPoint } from "./series";
import type { MeasureValuesPayload } from "./types";

/** A total split into parts, each a member of one dimension of a measure. */
export type BreakdownPart = {
	/** The member's code in the dimension. */
	code: string;
	color: string;
	/** Shorter wording than the member's own label, where the key is tight. */
	label?: string;
};

export type BreakdownShare = {
	key: string;
	label: string;
	color: string;
	count: number;
	pct: number;
};

export type BreakdownView = {
	period: string;
	total: number;
	shares: BreakdownShare[];
};

/** Member codes to their labels, as the measure's own metadata gives them. */
export function memberLabels(
	payload: MeasureValuesPayload,
	dimension: string,
): Map<string, string> {
	const found = payload.measure.dimensions.find(
		(candidate) => candidate.id === dimension,
	);
	return new Map(
		(found?.members ?? []).map((member) => [member.code, member.label]),
	);
}

/**
 * How one area's total splits across the parts, from a payload for each
 * member (one member is one request). Null where the total or any part is
 * missing, or the total is nothing, so a half-drawn bar is never shown.
 */
export function breakdownView(
	payloads: Readonly<Record<string, MeasureValuesPayload>>,
	area: string,
	dimension: string,
	totalCode: string,
	parts: readonly BreakdownPart[],
): BreakdownView | null {
	const latest = (code: string) => {
		const payload = payloads[code];
		return payload ? latestPoint(areaSeries(payload, area)) : null;
	};
	const total = latest(totalCode);
	if (!total || total.value <= 0) return null;
	const labels = memberLabels(payloads[totalCode]!, dimension);
	const shares: BreakdownShare[] = [];
	for (const part of parts) {
		const point = latest(part.code);
		if (!point) return null;
		shares.push({
			key: part.code,
			label: part.label ?? labels.get(part.code) ?? part.code,
			color: part.color,
			count: point.value,
			pct: (point.value / total.value) * 100,
		});
	}
	return { period: total.period, total: total.value, shares };
}
