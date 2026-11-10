import { EXACT_TOLERANCE, quantile, type ComparedValue } from "./backtest.ts";
import type { BacktestCase } from "./backtestCases.ts";
import type { CarriedValue } from "./convert.ts";
import type { ConversionBasis } from "./crosswalkSteps.ts";

/**
 * Turns the backtest's measured error into the bounds a converted value
 * carries.
 *
 * A value's `atRisk` is how much of it passed through a split. The backtest
 * gives, for each splitting method and weight basis, the largest error seen
 * per unit at risk. A converted value's bounds are that factor times its own
 * amount at risk. A method and basis the backtest has not measured has no
 * factor, and a value split that way is refused.
 */

export type ErrorClass = {
	/** The method of the crosswalk that split the values. */
	method: string;
	basis: ConversionBasis;
	/** What kind of value the truth held. The factor is for nothing else. */
	measureClass: string;
	caseId: string;
	/** Values a split touched, compared with a published truth. */
	compared: number;
	medianFactor: number;
	p95Factor: number;
	maxFactor: number;
	/** The factor used: the largest seen, rounded up to two decimal places. */
	factor: number;
	/**
	 * Values carried whole from an area that the crosswalk's pruned pairs put
	 * partly elsewhere, and how many of them matched the truth.
	 */
	prunedOnly: number;
	prunedOnlyExact: number;
};

const errorOf = (row: ComparedValue) => Math.abs(row.converted - row.truth);

/** One class per fitting case and basis, from that case's compared values. */
export const fitErrorClasses = (
	cases: readonly BacktestCase[],
	rows: readonly ComparedValue[],
): ErrorClass[] => {
	const classes: ErrorClass[] = [];
	for (const entry of cases) {
		if (!entry.fits) continue;
		for (const basis of entry.bases) {
			const own = rows.filter(
				(row) => row.caseId === entry.id && row.basis === basis,
			);
			const factors = own
				.filter((row) => row.atRisk > 0)
				.map((row) => errorOf(row) / row.atRisk)
				.sort((a, b) => a - b);
			if (factors.length === 0) continue;
			const prunedOnly = own.filter(
				(row) => row.atRisk === 0 && row.pruned > 0,
			);
			const maxFactor = factors.at(-1)!;
			classes.push({
				method: entry.fits.method,
				basis,
				measureClass: entry.fits.measureClass,
				caseId: entry.id,
				compared: factors.length,
				medianFactor: quantile(factors, 0.5)!,
				p95Factor: quantile(factors, 0.95)!,
				maxFactor,
				factor: Math.ceil(maxFactor * 100) / 100,
				prunedOnly: prunedOnly.length,
				prunedOnlyExact: prunedOnly.filter(
					(row) => errorOf(row) < EXACT_TOLERANCE,
				).length,
			});
		}
	}
	return classes;
};

export type Bounds = { lower: number; upper: number };

/**
 * The bounds of a converted count. A split can err either way, by up to the
 * factor times the amount at risk. A pruned pair can only have put too much in
 * the value, by no more than the pruned amount, so it widens the lower bound
 * alone.
 */
export const boundsOf = (
	value: Pick<CarriedValue, "value" | "atRisk" | "pruned">,
	factor: number,
): Bounds => {
	const half = factor * value.atRisk;
	return {
		lower: Math.max(0, value.value - half - value.pruned),
		upper: value.value + half,
	};
};

export type BoundsCheck = {
	caseId: string;
	basis: ConversionBasis;
	method: string;
	factor: number;
	/** True where the case is not the one the factor was fitted on. */
	heldOut: boolean;
	compared: number;
	/** Values whose published truth lies within the bounds. */
	covered: number;
	medianRelativeError: number | null;
	medianRelativeHalfWidth: number | null;
	p95RelativeHalfWidth: number | null;
};

/** How often a factor's bounds hold the truth, over a case's split values. */
export const checkBounds = (
	entry: BacktestCase,
	errorClass: ErrorClass,
	rows: readonly ComparedValue[],
): BoundsCheck => {
	const own = rows.filter(
		(row) =>
			row.caseId === entry.id &&
			row.basis === errorClass.basis &&
			(row.atRisk > 0 || row.pruned > 0),
	);
	const sorted = (values: number[]) => values.sort((a, b) => a - b);
	const positive = own.filter((row) => row.truth > 0);
	return {
		caseId: entry.id,
		basis: errorClass.basis,
		method: errorClass.method,
		factor: errorClass.factor,
		heldOut: entry.id !== errorClass.caseId,
		compared: own.length,
		covered: own.filter((row) => {
			const { lower, upper } = boundsOf(
				{
					value: row.converted,
					atRisk: row.atRisk,
					pruned: row.pruned,
				},
				errorClass.factor,
			);
			return (
				row.truth >= lower - EXACT_TOLERANCE &&
				row.truth <= upper + EXACT_TOLERANCE
			);
		}).length,
		medianRelativeError: quantile(
			sorted(positive.map((row) => errorOf(row) / row.truth)),
			0.5,
		),
		medianRelativeHalfWidth: quantile(
			sorted(
				positive.map(
					(row) => (errorClass.factor * row.atRisk) / row.truth,
				),
			),
			0.5,
		),
		p95RelativeHalfWidth: quantile(
			sorted(
				positive.map(
					(row) => (errorClass.factor * row.atRisk) / row.truth,
				),
			),
			0.95,
		),
	};
};
