import { type AtlasClient, createClient, type Step } from "./client";

/**
 * Defensible trend: compare a measure through time and be able to defend it,
 * including where the API refuses.
 *
 * A trend is only as good as the ground under it. Change here is measured
 * inside one source partition, whose periods the publisher restates on one set
 * of codes, so an area code means the same place at both ends. Where that does
 * not hold, the API refuses rather than producing a number.
 */
export const run = async (client: AtlasClient): Promise<Step[]> => {
	const steps: Step[] = [];
	const partition = "geography=localAuthority&boundaryYear=2023";

	// 1. Read what the measure claims about itself before using it.
	const measure = await client.get<{
		label: string;
		aggregation: { kind: string };
		sources: Array<{
			sourceGeography: { type: string; boundaryYear: number };
			periods: string[];
		}>;
	}>("/v1/measures/population-estimate");
	const source = measure.data.sources.find(
		(candidate) =>
			candidate.sourceGeography.type === "localAuthority" &&
			candidate.sourceGeography.boundaryYear === 2023,
	);
	if (!source) throw new Error("no local-authority partition to trend");
	steps.push({
		title: "Read the measure",
		detail: `${measure.data.label} is ${measure.data.aggregation.kind}; this partition runs ${source.periods[0]} to ${source.periods.at(-1)}.`,
	});

	// 2. One area through time, source-exact: no conversion, no aggregation.
	const series = await client.get<{
		series: Array<{ period: string; value: number }>;
	}>(
		`/v1/data/population-estimate/series?areaCode=E08000025&${partition}`,
	);
	const first = series.data.series[0];
	const last = series.data.series.at(-1);
	steps.push({
		title: "Take one area's series",
		detail: `Birmingham ran ${first?.value.toLocaleString("en-GB")} in ${first?.period} to ${last?.value.toLocaleString("en-GB")} in ${last?.period}.`,
	});

	// 3. The same change, ranked against every other area, so a figure can be
	//    put in context rather than quoted alone.
	const change = await client.get<{
		coverage: { areasRanked: number };
		records: Array<{
			areaCode: string;
			rank: number;
			relativeChange: number;
		}>;
	}>(
		`/v1/data/population-estimate/change?${partition}&startPeriod=2011&endPeriod=2022&by=relative&areaCode=E08000025`,
	);
	const ranked = change.data.records[0];
	steps.push({
		title: "Rank the change",
		detail: `Birmingham grew ${((ranked?.relativeChange ?? 0) * 100).toFixed(1)}% from 2011 to 2022, ${ranked?.rank} of ${change.data.coverage.areasRanked} authorities.`,
	});

	// 4. A deliberate refusal. A median is not a quantity that combines, and
	//    the API says so rather than averaging medians.
	const refusedMedian = await client.refusal(
		"/v1/data/house-price-median/aggregate?period=2022&geography=ward&boundaryYear=2020&areaCode=E92000001",
	);
	steps.push({
		title: "See a refusal, not a wrong number",
		detail: `${refusedMedian.status} ${refusedMedian.code}: ${refusedMedian.detail}`,
	});

	// 5. A second refusal, for the mistake this path exists to prevent:
	//    change measured across two different sets of codes.
	const refusedRelease = await client.refusal(
		`/v1/data/population-estimate/change?${partition}&startPeriod=2011&endPeriod=2022&release=2023-05-uk-bgc-v2`,
	);
	steps.push({
		title: "Keep geometry out of the trend",
		detail: `${refusedRelease.status}: ${refusedRelease.detail}`,
	});

	// 6. The caveats travel with the measure, so they can be quoted beside it.
	const quality = await client.get<{
		sources: Array<{
			sourceGeography: { type: string; boundaryYear: number };
			sourceCoverage: { note: string };
		}>;
	}>("/v1/measures/population-estimate/quality");
	// The caveat that matters is the one on the partition the trend used.
	const trended = quality.data.sources.find(
		(candidate) =>
			candidate.sourceGeography.type === "localAuthority" &&
			candidate.sourceGeography.boundaryYear === 2023,
	);
	steps.push({
		title: "Quote the caveat",
		detail: trended?.sourceCoverage.note ?? "no coverage note",
	});
	return steps;
};

if (process.argv[1]?.endsWith("defensible-trend.ts")) {
	const client = createClient(process.env.BASE_URL ?? "http://127.0.0.1:3001");
	for (const step of await run(client))
		console.log(`${step.title}: ${step.detail}`);
}
