import { loadPupilAbsence } from "../../pupil-absence/loader";
import type { IndicatorDataset } from "../../../types/indicator";
import type { DatasetDefinition } from "../types";
export const pupilAbsenceDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"pupilAbsence">
> = {
	type: "pupilAbsence",
	precompiledFile: "pupil-absence",
	boundaryType: "countyAndUnitaryAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Pupil absence",
		source: "Department for Education",
		sourceUrl:
			"https://explore-education-statistics.service.gov.uk/find-statistics/pupil-absence-in-schools-in-england",
		year: "2024/25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Full-year pupil absence for state-funded primary, secondary and special schools in England, by county and unitary authority.",
	},
	ingestion: {
		minimumDataRecords: 140,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value", "metrics"],
	},
	precompile: ({ zipCsvRows }) => loadPupilAbsence(zipCsvRows),
};
