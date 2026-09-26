import type { AreaReleaseArtifact } from "../areaInventory";
import type { MeasureSource } from "../dataCatalog";
import { countryForCode } from "../catalog/countries";
import type { BulkExport } from "../exportManifest";
import { type Finding, sha256, listed, check } from "./findings";
import type { MeasureTotal, ValidationInputs } from "./inputs";
import { observationTableOf } from "../observationTables";
import {
	sameGeography,
	describeGeography,
	exportFor,
	periodsOf,
} from "./sourceGeography";

const areaCodeSets = new WeakMap<AreaReleaseArtifact, Set<string>>();

const areaCodesOf = (artifact: AreaReleaseArtifact) => {
	let codes = areaCodeSets.get(artifact);
	if (!codes) {
		codes = new Set(artifact.areas.map((area) => area.code));
		areaCodeSets.set(artifact, codes);
	}
	return codes;
};

// Counts are whole numbers, so any real difference is at least 1; this only
// absorbs floating-point error in a quantity.
const TOTAL_TOLERANCE = 1e-9;

const totalFinding = (
	inputs: ValidationInputs,
	source: MeasureSource,
	periods: ReturnType<typeof periodsOf>,
	total: MeasureTotal,
): Finding => {
	const problems: string[] = [];
	const components = total.components.flatMap((id) => {
		const entry = exportFor(inputs, id, source);
		const artifact = entry && inputs.observationArtifacts[entry.id];
		if (!artifact) {
			problems.push(
				`${id} has no partition from ${source.datasetId} on ${describeGeography(source.sourceGeography)}`,
			);
			return [];
		}
		const values = new Map(
			periodsOf(artifact).map((period) => [
				period.period,
				new Map(
					period.records.flatMap((record) =>
						"value" in record
							? [[record.areaCode, record.value] as const]
							: [],
					),
				),
			]),
		);
		return [{ id, values }];
	});
	const missing: string[] = [];
	const differences: string[] = [];
	let comparedCount = 0;
	let maxDifference = 0;
	if (problems.length === 0) {
		for (const period of periods) {
			const totalCodes = new Set(
				period.records.map((record) => record.areaCode),
			);
			for (const component of components) {
				const values = component.values.get(period.period);
				if (!values) {
					problems.push(
						`${component.id} has no ${period.period} period`,
					);
					continue;
				}
				const extra = [...values.keys()].filter(
					(code) => !totalCodes.has(code),
				);
				if (extra.length > 0) {
					problems.push(
						`${component.id} has ${period.period} values for areas with no total: ${listed(extra, 5)}`,
					);
				}
			}
			for (const record of period.records) {
				if (!("value" in record)) continue;
				const parts = components.map((component) =>
					component.values.get(period.period)?.get(record.areaCode),
				);
				if (parts.some((part) => part === undefined)) {
					missing.push(`${period.period} ${record.areaCode}`);
					continue;
				}
				comparedCount += 1;
				const sum = parts.reduce<number>(
					(runningTotal, part) => runningTotal + (part ?? 0),
					0,
				);
				const difference = Math.abs(sum - record.value);
				if (
					difference >
					TOTAL_TOLERANCE * Math.max(1, Math.abs(record.value))
				) {
					maxDifference = Math.max(maxDifference, difference);
					differences.push(
						`${period.period} ${record.areaCode} (${record.value} against ${Number(sum.toPrecision(12))})`,
					);
				}
			}
		}
	}
	const findings = [
		...problems,
		...(missing.length > 0
			? [`components have no value for ${listed(missing, 5)}`]
			: []),
		...(differences.length > 0
			? [
					`components differ from the total in ${differences.length} of ${comparedCount} area-periods: ${listed(differences, 5)}`,
				]
			: []),
	];
	return check(
		"components-sum-to-total",
		findings.length === 0,
		`The components do not add up to the total: ${findings.join("; ")}.`,
		{
			components: total.components.join(", "),
			comparedCount,
			mismatchCount: differences.length,
			maxDifference: Number(maxDifference.toPrecision(12)),
		},
	);
};

export const measureSourceFindings = (
	inputs: ValidationInputs,
	entry: BulkExport,
): Finding[] => {
	const artifact = inputs.observationArtifacts[entry.id];
	const measure = inputs.dataCatalog.measures.find(
		(candidate) => candidate.id === entry.measureId,
	);
	const source = measure?.sources.find(
		(candidate) =>
			candidate.datasetId === entry.datasetId &&
			sameGeography(candidate.sourceGeography, entry.sourceGeography),
	);
	if (!artifact || !measure || !source) {
		return [
			check(
				"artifact-integrity",
				false,
				artifact
					? `No catalogue source matches ${entry.measureId} from ${entry.datasetId} on ${describeGeography(entry.sourceGeography)}.`
					: `No observation artifact was read for ${entry.artifact}.`,
			),
		];
	}
	const periods = periodsOf(artifact);
	const recordCount = periods.reduce(
		(count, period) => count + period.records.length,
		0,
	);

	const table = observationTableOf(artifact);
	const storedArtifact = table ?? artifact;
	const { contentHash: storedHash, ...content } = storedArtifact;
	const contentHash = artifact.contentHash;
	const repeated = periods.flatMap((period) => {
		const seen = new Set<string>();
		return period.records.flatMap((record) => {
			const repeat = seen.has(record.areaCode);
			seen.add(record.areaCode);
			return repeat ? [`${period.period} ${record.areaCode}`] : [];
		});
	});
	// The catalogue counts the latest period, since coverage can vary by period.
	const latestCount = periods.at(-1)?.records.length ?? 0;
	const periodIds = periods.map((period) => period.period);
	const integrityProblems = [
		storedHash === contentHash &&
		sha256(JSON.stringify(content)) === storedHash
			? undefined
			: "its content does not reproduce its hash",
		entry.contentHash === contentHash
			? undefined
			: "its hash differs from the export manifest",
		entry.recordCount === recordCount &&
		periods.every(
			(period) =>
				entry.recordCountByPeriod[period.period] ===
				period.records.length,
		)
			? undefined
			: "its record counts differ from the export manifest",
		artifact.measureId === measure.id &&
		sameGeography(artifact.sourceGeography, source.sourceGeography)
			? undefined
			: `it holds ${artifact.measureId} on ${describeGeography(artifact.sourceGeography)}`,
		periodIds.join(",") === source.periods.join(",")
			? undefined
			: `its periods (${listed(periodIds)}) differ from the catalogue's (${listed(source.periods)})`,
		source.coverage.recordCount === latestCount
			? undefined
			: `the catalogue counts ${source.coverage.recordCount} records but its latest period has ${latestCount}`,
		repeated.length === 0
			? undefined
			: `area codes repeat within a period: ${listed(repeated)}`,
	].filter((problem) => problem !== undefined);

	const codes = [
		...new Set(
			periods.flatMap((period) =>
				period.records.map((record) => record.areaCode),
			),
		),
	].sort();
	const { type, boundaryYear } = source.sourceGeography;
	const resolution = inputs.boundaryRegistry.releases
		.filter(
			(release) =>
				release.geography === type &&
				release.temporalCoverage === String(boundaryYear),
		)
		.sort((left, right) => left.id.localeCompare(right.id))
		.flatMap((release) => {
			const areas = inputs.areaArtifacts.find(
				(candidate) =>
					candidate.geography === type &&
					candidate.boundaryRelease === release.id,
			);
			if (!areas) return [];
			const known = areaCodesOf(areas);
			return [
				{
					id: release.id,
					unresolved: codes.filter((code) => !known.has(code)),
				},
			];
		});
	const resolvedBy = resolution.find(
		(release) => release.unresolved.length === 0,
	);

	const unsupported: string[] = [];
	const countries = new Set<string>();
	for (const code of codes) {
		try {
			countries.add(countryForCode(code));
		} catch {
			unsupported.push(code);
		}
	}
	const foundCountries = [...countries].sort();
	const declaredCountries = [...source.coverage.countries].sort();

	const invalid: string[] = [];
	const categorical = measure.valueKind === "categorical";
	const percentage =
		measure.unit === "percent" || measure.unit.startsWith("% ");
	const statistic =
		measure.aggregation.kind === "non-aggregatable"
			? measure.aggregation.statistic
			: undefined;
	const categories = new Set<string>();
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;
	for (const period of periods) {
		for (const record of period.records) {
			const fail = (reason: string) =>
				invalid.push(`${period.period} ${record.areaCode} ${reason}`);
			if (record.status !== "observed" && record.status !== "derived") {
				fail(`has status ${String(record.status)}`);
			} else if (measure.derivedFrom && record.status !== "derived") {
				fail("is marked observed on a derived measure");
			}
			if (categorical) {
				if (
					!("category" in record) ||
					typeof record.category !== "string" ||
					record.category.trim().length === 0
				) {
					fail("has no category");
				} else {
					categories.add(record.category);
				}
				if ("value" in record)
					fail("carries a value on a categorical measure");
				continue;
			}
			if (
				!("value" in record) ||
				typeof record.value !== "number" ||
				!Number.isFinite(record.value)
			) {
				fail("has no finite value");
				continue;
			}
			const { value } = record;
			minimum = Math.min(minimum, value);
			maximum = Math.max(maximum, value);
			if (
				measure.valueKind === "count" &&
				!(Number.isInteger(value) && value >= 0)
			) {
				fail(
					`counts ${value}, which is not a whole number of at least 0`,
				);
			}
			if (
				measure.valueKind === "ratio" &&
				(value < 0 || (percentage && value > 100))
			) {
				fail(
					`is ${value}, outside ${percentage ? "0 to 100" : "0 or more"}`,
				);
			}
			if (measure.valueKind === "currency" && value < 0) {
				fail(`is a negative amount, ${value}`);
			}
			if (measure.valueKind === "ordinal") {
				const ceiling =
					statistic === "decile"
						? 10
						: statistic === "rank"
							? period.records.length
							: undefined;
				if (
					!Number.isInteger(value) ||
					value < 1 ||
					(ceiling !== undefined && value > ceiling)
				) {
					fail(
						ceiling === undefined
							? `is ${value}, not a whole number of at least 1`
							: `is ${value}, not a ${statistic} from 1 to ${ceiling}`,
					);
				}
			}
			const interval = record.confidenceInterval;
			if (interval) {
				if (!measure.uncertainty) {
					fail("carries an interval its measure does not declare");
				} else if (!(
					interval.lower <= value && value <= interval.upper
				)) {
					fail(
						`lies outside its interval, ${interval.lower} to ${interval.upper}`,
					);
				}
			}
		}
	}

	const findings = [
		check(
			"artifact-integrity",
			integrityProblems.length === 0,
			`The artifact is inconsistent: ${integrityProblems.join("; ")}.`,
			{ periodCount: periods.length, recordCount },
		),
		check(
			"records-resolve",
			resolvedBy !== undefined,
			resolution.length === 0
				? `No ${type} boundary release for ${boundaryYear} has compiled areas.`
				: `No compiled ${type} release for ${boundaryYear} holds every code: ${resolution
						.map(
							(release) =>
								`${release.id} lacks ${release.unresolved.length} (${listed(release.unresolved, 5)})`,
						)
						.join("; ")}.`,
			{
				areaCodeCount: codes.length,
				boundaryRelease: resolvedBy?.id ?? null,
				unresolvedCount: resolvedBy
					? 0
					: resolution.length > 0
						? Math.min(
								...resolution.map(
									(release) => release.unresolved.length,
								),
							)
						: codes.length,
			},
		),
		check(
			"countries-declared",
			unsupported.length === 0 &&
				foundCountries.join(",") === declaredCountries.join(","),
			unsupported.length > 0
				? `Codes belong to no UK nation: ${listed(unsupported)}.`
				: `Records cover ${foundCountries.join(", ")}, but the catalogue declares ${declaredCountries.join(", ")}.`,
			{ countries: foundCountries.join(", ") },
		),
		check(
			"values-valid",
			invalid.length === 0,
			`${invalid.length} records are invalid: ${listed(invalid, 5)}.`,
			categorical
				? { recordCount, categoryCount: categories.size }
				: {
						recordCount,
						minimum: recordCount > 0 ? minimum : null,
						maximum: recordCount > 0 ? maximum : null,
					},
		),
	];
	const total = inputs.measureTotals.find(
		(candidate) => candidate.measureId === measure.id,
	);
	if (total) findings.push(totalFinding(inputs, source, periods, total));
	return findings;
};
