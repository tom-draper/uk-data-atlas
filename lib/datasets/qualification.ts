import { loadQualification } from "@/lib/data/qualification/loader";
import type { QualificationDataset } from "@/lib/types/qualification";
import type { ScalarDatasetDefinition } from "./types";

export const qualificationDefinition: ScalarDatasetDefinition<QualificationDataset> = {
	type: "qualification", precompiledFile: "qualification",
	chart: { group: "Education", key: "education-qualifications", label: "Qualifications [2021]", defaultVisible: true, componentPath: "@/components/education/QualificationChart", boundaryType: "localAuthority", calculateStats: (mm, g, d, l, id) => mm.calculateQualificationStats(g, d, l, id), year: 2021 },
	source: { name: "Qualifications", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/datasets/TS067/editions/2021/versions/3", year: "2021", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Highest level of qualification breakdown by local authority district for England and Wales (Census 2021)." },
	map: { valueFor: () => null, colorRange: { min: 25, max: 60 }, legend: { min: 25, max: 60, format: String } },
	precompile: async ({ text }) => loadQualification(text),
};
