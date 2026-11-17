import { readSeries } from "./combine";
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

/** How a breakdown is drawn beyond its declared parts. */
export type BreakdownOptions = {
	/** Draw the largest part first, rather than in the declared order. */
	order?: "largest";
	/** Leave out a part by its label. The shares are then of the parts left. */
	includes?: (label: string) => boolean;
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
 * member (one member is one request). With no area, the split of every area
 * in the payloads combined. The total is the member named by `totalCode`, or,
 * with none, the sum of the parts drawn. Null where the total or any part is
 * missing, or the total is nothing, so a half-drawn bar is never shown.
 */
export function breakdownView(
	payloads: Readonly<Record<string, MeasureValuesPayload>>,
	area: string | null,
	dimension: string,
	totalCode: string | undefined,
	parts: readonly BreakdownPart[],
	options: BreakdownOptions = {},
): BreakdownView | null {
	const latest = (code: string) => {
		const payload = payloads[code];
		return payload ? latestPoint(readSeries(payload, area)) : null;
	};
	const declaredTotal = totalCode === undefined ? null : latest(totalCode);
	if (totalCode !== undefined && !declaredTotal) return null;
	const first = payloads[totalCode ?? parts[0]?.code ?? ""];
	if (!first) return null;
	const labels = memberLabels(first, dimension);
	const found: {
		part: BreakdownPart;
		label: string;
		value: number;
		period: string;
	}[] = [];
	for (const part of parts) {
		const point = latest(part.code);
		if (!point) return null;
		const label = part.label ?? labels.get(part.code) ?? part.code;
		if (options.includes && !options.includes(label)) continue;
		found.push({ part, label, value: point.value, period: point.period });
	}
	const total = declaredTotal
		? declaredTotal.value
		: found.reduce((sum, one) => sum + one.value, 0);
	if (total <= 0) return null;
	if (options.order === "largest") found.sort((a, b) => b.value - a.value);
	return {
		period: declaredTotal?.period ?? found[0]?.period ?? "",
		total,
		shares: found.map((one) => ({
			key: one.part.code,
			label: one.label,
			color: one.part.color,
			count: one.value,
			pct: (one.value / total) * 100,
		})),
	};
}
