import type { Measure } from "../dataCatalog";
import { type Finding, listed, check } from "./findings";
import type { ValidationInputs } from "./inputs";
import { sameGeography, describeGeography, exportFor } from "./sourceGeography";

export const measureFindings = (
	inputs: ValidationInputs,
	measure: Measure,
): Finding[] => {
	const { aggregation } = measure;
	const datasetIds = new Set(
		inputs.dataCatalog.datasets.map((dataset) => dataset.id),
	);
	const problems: string[] = [];
	if (measure.availability.aggregation !== aggregation.available) {
		problems.push(
			`its availability and its ${aggregation.kind} aggregation disagree on whether it can be aggregated`,
		);
	}
	if (
		(measure.valueKind === "categorical") !==
		(aggregation.kind === "categorical")
	) {
		problems.push(
			`a ${measure.valueKind} value has ${aggregation.kind} aggregation`,
		);
	}
	if (measure.links.data !== `/v1/data/${measure.id}`) {
		problems.push(`its data link is ${measure.links.data}`);
	}
	const unknownDatasets = [
		...new Set([
			...measure.sources.map((source) => source.datasetId),
			...(measure.derivedFrom?.datasetIds ?? []),
		]),
	].filter((id) => !datasetIds.has(id));
	if (unknownDatasets.length > 0) {
		problems.push(
			`it names datasets the catalogue does not hold: ${listed(unknownDatasets)}`,
		);
	}
	const unexported = measure.sources.filter(
		(source) => !exportFor(inputs, measure.id, source),
	);
	if (unexported.length > 0) {
		problems.push(
			`no export serves its sources ${listed(
				unexported.map(
					(source) =>
						`${source.datasetId} on ${describeGeography(source.sourceGeography)}`,
				),
			)}`,
		);
	}
	if (aggregation.kind === "intensive" && aggregation.available) {
		const weight = inputs.dataCatalog.measures.find(
			(candidate) => candidate.id === aggregation.weight.measureId,
		);
		if (!weight) {
			problems.push(
				aggregation.weight.measureId
					? `its weight measure ${aggregation.weight.measureId} is not in the catalogue`
					: "its weighted mean is available without a weight measure",
			);
		} else {
			if (weight.aggregation.kind !== "extensive") {
				problems.push(`its weight ${weight.id} cannot be summed`);
			}
			const unweighted = measure.sources.filter(
				(source) =>
					!weight.sources.some(
						(candidate) =>
							sameGeography(
								candidate.sourceGeography,
								source.sourceGeography,
							) &&
							source.periods.every((period) =>
								candidate.periods.includes(period),
							),
					),
			);
			if (unweighted.length > 0) {
				problems.push(
					`${weight.id} has no partition to weight its sources on ${listed(
						unweighted.map((source) =>
							describeGeography(source.sourceGeography),
						),
					)}`,
				);
			}
		}
	}
	return [
		check(
			"measure-definition",
			problems.length === 0,
			`The definition is inconsistent: ${problems.join("; ")}.`,
			{ sourceCount: measure.sources.length },
		),
	];
};
