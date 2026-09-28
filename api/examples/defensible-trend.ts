import { type AtlasClient, createClient, type Step } from "./client";

/**
 * Defensible trend: use a reviewed source-to-analysis conversion and retain
 * the evidence needed to defend it, including where a period is not safe.
 *
 * A trend is only as good as the ground under it. Here, collision counts from
 * 2021 LSOAs are regrouped onto the named May 2023 local-authority frame only
 * because the Atlas has reviewed the official containment lookup. Another
 * period gets an explicit not-comparable result, never a guessed conversion.
 */
export const run = async (client: AtlasClient): Promise<Step[]> => {
	const steps: Step[] = [];
	const measureId = "road-collisions";
	const source = "geography=lsoa&boundaryYear=2021";
	const analysisGeography = "localAuthority/2023-05-uk-bgc-v2";
	const period = "2025";
	const comparisonPeriod = "2024";
	const areaCode = "E08000025";

	// 1. Read the measure before asking it to cross a geography boundary.
	const measure = await client.get<{
		label: string;
		aggregation: { kind: string };
		sources: Array<{
			sourceGeography: { type: string; boundaryYear: number };
			periods: string[];
		}>;
	}>(`/v1/measures/${measureId}`);
	const sourcePartition = measure.data.sources.find(
		(candidate) =>
			candidate.sourceGeography.type === "lsoa" &&
			candidate.sourceGeography.boundaryYear === 2021,
	);
	if (!sourcePartition)
		throw new Error("no LSOA collision partition to trend");
	steps.push({
		title: "Read the measure",
		detail: `${measure.data.label} is ${measure.data.aggregation.kind}; the LSOA 2021 source includes ${sourcePartition.periods.join(", ")}.`,
	});

	// 2. Preflight the exact source, period and analysis frame. The result names
	// the crosswalk; the caller never asks the server to choose one implicitly.
	const plan = await client.get<{
		status: "available" | "not-comparable";
		basis?: string;
		conversion?: { id: string; method: string };
	}>(
		`/v1/analysis:plan?measure=${measureId}&period=${period}&analysisGeography=${analysisGeography}&sourceGeography=lsoa&sourceBoundaryYear=2021`,
	);
	if (plan.data.status !== "available" || plan.data.basis !== "derived")
		throw new Error("the reviewed collision conversion is not available");
	steps.push({
		title: "Preflight the conversion",
		detail: `${period} is available on ${analysisGeography} through ${plan.data.conversion?.id} (${plan.data.conversion?.method}).`,
	});

	// 3. Fetch an explicitly derived value on the analysis frame. `areaCode` is
	// a local-authority code here, not an LSOA code relabelled as one.
	const series = await client.get<{
		status: "available";
		basis: "derived";
		conversion: { id: string };
		provenance: {
			source: { observations: { artifact: string; contentHash: string } };
		};
		series: Array<{ period: string; value: number; status: "derived" }>;
	}>(
		`/v1/data/${measureId}/series?areaCode=${areaCode}&${source}&analysisGeography=${analysisGeography}`,
	);
	const collisionCount = series.data.series.find(
		(record) => record.period === period,
	);
	const comparisonCount = series.data.series.find(
		(record) => record.period === comparisonPeriod,
	);
	if (!collisionCount || !comparisonCount || series.data.basis !== "derived")
		throw new Error("the converted local-authority series is not derived");
	const absoluteChange = collisionCount.value - comparisonCount.value;
	const relativeChange = absoluteChange / comparisonCount.value;
	steps.push({
		title: "Compare the derived trend",
		detail: `${areaCode} moved from ${comparisonCount.value.toLocaleString("en-GB")} reported collisions in ${comparisonPeriod} to ${collisionCount.value.toLocaleString("en-GB")} in ${period}: ${absoluteChange >= 0 ? "+" : ""}${absoluteChange.toLocaleString("en-GB")} (${(relativeChange * 100).toFixed(1)}%), explicitly derived on ${analysisGeography}.`,
	});

	// 4. The release-pinned receipt ties the source artifact and crosswalk to
	// exact input/output totals, so the conversion can be independently cited.
	const receipt = await client.get<{
		supports: Array<{
			measureId: string;
			analysisGeography: { geography: string; boundaryRelease: string };
			crosswalk: { id: string; contentHash: string };
			observations: { artifact: string; contentHash: string };
			periods: Array<{
				period: string;
				inputRecordCount: number;
				outputRecordCount: number;
				inputTotal: number;
				outputTotal: number;
			}>;
		}>;
	}>("/v1/analysis-geography-validation");
	const evidence = receipt.data.supports.find(
		(candidate) =>
			candidate.measureId === measureId &&
			candidate.analysisGeography.geography === "localAuthority" &&
			candidate.analysisGeography.boundaryRelease ===
				"2023-05-uk-bgc-v2" &&
			candidate.crosswalk.id === series.data.conversion.id &&
			candidate.observations.contentHash ===
				series.data.provenance.source.observations.contentHash,
	);
	const validation = evidence?.periods.find(
		(candidate) => candidate.period === period,
	);
	if (
		!evidence ||
		!validation ||
		validation.inputTotal !== validation.outputTotal
	)
		throw new Error(
			"the conversion receipt does not conserve the source total",
		);
	steps.push({
		title: "Retain the validation receipt",
		detail: `${validation.inputRecordCount.toLocaleString("en-GB")} LSOA records became ${validation.outputRecordCount.toLocaleString("en-GB")} local-authority records; both totals are ${validation.outputTotal.toLocaleString("en-GB")}. Evidence: ${evidence.crosswalk.contentHash}; ${evidence.observations.artifact} ${evidence.observations.contentHash}.`,
	});

	// 5. A period outside the reviewed support is not quietly omitted or
	// converted with a near-enough release. It is part of the honest result.
	const unavailablePlan = await client.get<{
		status: "available" | "not-comparable";
		reason?: string;
	}>(
		`/v1/analysis:plan?measure=${measureId}&period=2023&analysisGeography=${analysisGeography}&sourceGeography=lsoa&sourceBoundaryYear=2021`,
	);
	if (unavailablePlan.data.status !== "not-comparable")
		throw new Error("an unsupported period must be not-comparable");
	steps.push({
		title: "Keep an unsafe period out",
		detail: `2023 is ${unavailablePlan.data.status}: ${unavailablePlan.data.reason}`,
	});

	// 6. Every response is tied to one immutable release; the receipt and value
	// can therefore travel together with the claim.
	if (receipt.atlasRelease !== series.atlasRelease)
		throw new Error(
			"the result and validation receipt use different releases",
		);
	steps.push({
		title: "Pin the claim",
		detail: `The derived value and its receipt are both from Atlas release ${series.atlasRelease}.`,
	});
	return steps;
};

if (process.argv[1]?.endsWith("defensible-trend.ts")) {
	const client = createClient(
		process.env.BASE_URL ?? "http://127.0.0.1:3001",
	);
	for (const step of await run(client))
		console.log(`${step.title}: ${step.detail}`);
}
