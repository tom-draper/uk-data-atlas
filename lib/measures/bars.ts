import { hexToRgb, rgbToHex } from "@/lib/helpers/colorScale/interpolation";
import { valuesByCode } from "./client";
import { readSeries } from "./combine";
import type { BarsCardConfig } from "./barsConfig";
import { latestPoint } from "./series";
import type { MeasureValuesPayload } from "./types";

export type Bar = { key: string; label: string; value: number; pct: number };

export type BarsView = {
	period: string;
	bars: Bar[];
	/** The values the full width of a bar stands between. */
	scale: { min: number; max: number };
	/** The bars' mean position on the scale, 0 to 100, for the card's accent. */
	meanPct: number;
};

/** Where `value` sits between the scale's ends, 0 to 100. Mid-way when the scale is a point. */
export const position = (
	value: number,
	{ min, max }: { min: number; max: number },
): number =>
	max > min
		? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
		: 50;

/**
 * The lowest and highest value any area has in the latest period of any
 * member, over the areas in the payloads. So the scale follows what is in
 * use: the measure chosen and the areas in scope.
 */
export function scaleOf(
	payloads: readonly MeasureValuesPayload[],
): { min: number; max: number } | null {
	let min = Infinity;
	let max = -Infinity;
	for (const payload of payloads) {
		for (let at = payload.columns.length - 1; at >= 0; at--) {
			const values = valuesByCode(payload, payload.columns[at]!.period);
			if (values.size === 0) continue;
			for (const value of values.values()) {
				min = Math.min(min, value);
				max = Math.max(max, value);
			}
			break;
		}
	}
	return min <= max ? { min, max } : null;
}

/**
 * The bars for one area, or with no area for every area in the payloads
 * combined as the card declares. Null where a member has no value, so a
 * half-drawn card is never shown.
 */
export function barsView(
	payloads: Readonly<Record<string, MeasureValuesPayload>>,
	area: string | null,
	config: Pick<BarsCardConfig, "bars" | "combine">,
): BarsView | null {
	const scale = scaleOf(Object.values(payloads));
	if (!scale) return null;
	const found: Array<{ key: string; label: string; value: number }> = [];
	let period = "";
	for (const bar of config.bars) {
		const payload = payloads[bar.code];
		const point = payload
			? latestPoint(readSeries(payload, area, config.combine))
			: null;
		if (!point) return null;
		period = point.period;
		found.push({ key: bar.code, label: bar.label, value: point.value });
	}
	const bars = found.map((bar) => ({
		...bar,
		pct: position(bar.value, scale),
	}));
	return {
		period,
		bars,
		scale,
		meanPct: bars.reduce((sum, bar) => sum + bar.pct, 0) / bars.length,
	};
}

/** The colour a position on the scale takes along the ramp. */
export function rampColor(
	ramp: BarsCardConfig["ramp"],
	pct: number,
): { r: number; g: number; b: number; hex: string } {
	const low = hexToRgb(ramp.low);
	const high = hexToRgb(ramp.high);
	const mix = (from: number, to: number) =>
		Math.round(from + (to - from) * (pct / 100));
	const r = mix(low.r, high.r);
	const g = mix(low.g, high.g);
	const b = mix(low.b, high.b);
	return { r, g, b, hex: rgbToHex(r, g, b) };
}
