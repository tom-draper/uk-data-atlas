import type { NotionalInputs } from "./inputs.ts";

/**
 * Census 2021 covariates by LSOA (England and Wales), for the model that fills
 * in where local results cannot: the share of residents who are adults, and
 * shares of adults or households by age, ethnicity, tenure, activity and
 * health.
 */

export const COVARIATES = [
	"young adults",
	"aged 65 and over",
	"white British",
	"South Asian",
	"Black",
	"owned outright",
	"social rented",
	"private rented",
	"students",
	"retired",
	"unemployed",
	"long-term sick",
	"bad health",
] as const;

export type Covariates = {
	/** Share of usual residents aged 18 and over, per LSOA index. */
	adultShare: Float64Array;
	/** Covariates per LSOA index, `COVARIATES.length` each; NaN where missing. */
	values: Float64Array;
};

const sum = (record: Record<string, number>) =>
	Object.values(record).reduce((total, value) => total + value, 0);

/** Usual residents aged 18 and over, taking 2 in 5 of the 15 to 19 band. */
const adults = (age: Record<string, number>) => {
	const band = (name: string) => age[name] ?? 0;
	return (
		sum(age) -
		band("0-to-4") -
		band("5-to-9") -
		band("10-to-14") -
		0.6 * band("15-to-19")
	);
};

export const readCovariates = (
	inputs: Pick<NotionalInputs, "lsoa" | "census">,
): Covariates => {
	const codes = inputs.lsoa.codes;
	const k = COVARIATES.length;
	const adultShare = new Float64Array(codes.length).fill(Number.NaN);
	const values = new Float64Array(codes.length * k).fill(Number.NaN);
	const table = (dataset: string) => inputs.census.get(dataset)!;
	const [age, ethnicity, health, tenure, activity] = [
		"ts007a",
		"ts021",
		"ts037",
		"ts054",
		"ts066",
	].map(table);
	codes.forEach((code, index) => {
		const a = age!.get(code);
		const e = ethnicity!.get(code);
		const h = health!.get(code);
		const t = tenure!.get(code);
		const c = activity!.get(code);
		if (!a || !e || !h || !t || !c) return;
		const residents = sum(a);
		const adult = adults(a);
		if (!(residents > 0) || !(adult > 0)) return;
		adultShare[index] = adult / residents;
		const band = (name: string) => a[name] ?? 0;
		const people = sum(e);
		const row = [
			(0.4 * band("15-to-19") + band("20-to-24") + band("25-to-29")) /
				adult,
			(band("65-to-69") +
				band("70-to-74") +
				band("75-to-79") +
				band("80-to-84") +
				band("85-plus")) /
				adult,
			e["english-welsh-scottish-northern-irish-or-british"]! / people,
			(e.indian! + e.pakistani! + e.bangladeshi!) / people,
			(e.african! + e.caribbean! + e["other-black"]!) / people,
			t["owned-outright"]! / t.total!,
			(t["social-rented-council"]! + t["social-rented-other"]!) /
				t.total!,
			(t["private-rented-landlord"]! + t["private-rented-other"]!) /
				t.total!,
			(c["inactive-student"]! +
				c["student-employed"]! +
				c["student-unemployed"]!) /
				c.total!,
			c["inactive-retired"]! / c.total!,
			c.unemployed! / c.total!,
			c["inactive-long-term-sick"]! / c.total!,
			(h.bad! + h["very-bad"]!) / h.total!,
		];
		if (row.every(Number.isFinite)) values.set(row, index * k);
	});
	return { adultShare, values };
};

/** Weighted least squares with a small ridge on all but the first term. */
export const fitLinear = (
	rows: readonly { x: readonly number[]; y: number; w: number }[],
	ridge = 1e-6,
) => {
	const d = rows[0]!.x.length;
	const m = Array.from({ length: d }, () => new Array<number>(d + 1).fill(0));
	let weight = 0;
	for (const { x, y, w } of rows) {
		weight += w;
		for (let i = 0; i < d; i++) {
			m[i]![d]! += w * x[i]! * y;
			for (let j = 0; j < d; j++) m[i]![j]! += w * x[i]! * x[j]!;
		}
	}
	for (let i = 1; i < d; i++) m[i]![i]! += ridge * weight;
	for (let i = 0; i < d; i++) {
		let pivot = i;
		for (let j = i + 1; j < d; j++)
			if (Math.abs(m[j]![i]!) > Math.abs(m[pivot]![i]!)) pivot = j;
		[m[i], m[pivot]] = [m[pivot]!, m[i]!];
		for (let j = i + 1; j < d; j++) {
			const q = m[j]![i]! / m[i]![i]!;
			for (let c = i; c <= d; c++) m[j]![c]! -= q * m[i]![c]!;
		}
	}
	const beta = new Array<number>(d).fill(0);
	for (let i = d - 1; i >= 0; i--) {
		let s = m[i]![d]!;
		for (let c = i + 1; c < d; c++) s -= m[i]![c]! * beta[c]!;
		beta[i] = s / m[i]![i]!;
	}
	let mean = 0;
	for (const { y, w } of rows) mean += (w * y) / weight;
	let residual = 0;
	let total = 0;
	for (const { x, y, w } of rows) {
		const fitted = x.reduce((s, v, i) => s + v * beta[i]!, 0);
		residual += w * (y - fitted) ** 2;
		total += w * (y - mean) ** 2;
	}
	return { beta, r2: 1 - residual / total, rows: rows.length };
};
