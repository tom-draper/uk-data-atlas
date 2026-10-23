export const IMD_MEASURES = [
	{ value: "imdScore", label: "Overall IMD" },
	{ value: "incomeScore", label: "Income deprivation" },
	{ value: "employmentScore", label: "Employment deprivation" },
	{ value: "educationScore", label: "Education, skills and training" },
	{ value: "healthScore", label: "Health deprivation and disability" },
	{ value: "crimeScore", label: "Crime" },
	{ value: "housingScore", label: "Barriers to housing and services" },
	{ value: "livingEnvironmentScore", label: "Living environment" },
] as const;
export function imdRange(measure: string) {
	if (measure === "incomeScore" || measure === "employmentScore")
		return { min: 0, max: 0.6 };
	if (measure === "healthScore" || measure === "crimeScore")
		return { min: -3, max: 3 };
	return { min: 0, max: 100 };
}
