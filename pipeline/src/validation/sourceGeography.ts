import type { ObservationArtifact, ValidationInputs } from "./inputs";

type Geography = { type: string; boundaryYear: number };

export const sameGeography = (left: Geography, right: Geography) =>
	left.type === right.type && left.boundaryYear === right.boundaryYear;

export const describeGeography = (geography: Geography) =>
	`${geography.type} ${geography.boundaryYear}`;

export const exportFor = (
	inputs: ValidationInputs,
	measureId: string,
	source: { datasetId: string; sourceGeography: Geography },
) =>
	inputs.exportManifest.exports.find(
		(entry) =>
			entry.measureId === measureId &&
			entry.datasetId === source.datasetId &&
			sameGeography(entry.sourceGeography, source.sourceGeography),
	);

export const periodsOf = (artifact: ObservationArtifact) =>
	"periods" in artifact
		? artifact.periods
		: [{ period: artifact.period, records: artifact.records }];
