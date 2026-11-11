import {
	SCHOOL_MEASURES,
	SCHOOL_COPIES,
	schoolYear,
	schoolFields,
	schoolYears,
	latestCopies,
	latestCopyRules,
} from "@uk-data-atlas/datasets";
import type { DatasetModule } from "@uk-data-atlas/datasets";
import type { StatisticsMeasure } from "../atlasStatistics.ts";
import {
	type DeclaredDataset,
	type DeclaredHeader,
	type DeclaredDimension,
	type DeclaredField,
	type DerivedRule,
	periods,
} from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import type { DeclaredPayload } from "../declaredStatistics.ts";
import { measure } from "./measures.ts";

/** Crime, safety, housing need, care, planning, health and schools. */

const single = (
	type: string,
	module: DatasetModule,
	period: ReturnType<typeof periods.year>,
	declared: StatisticsMeasure,
	payload: DeclaredPayload,
): DeclaredDataset => ({
	type,
	module,
	payload,
	name: "name",
	period: () => period,
	measures: [declared],
	fields: [{ path: "value", measure: declared.slug }],
});

/** County and unitary tables that still use two pre-2023 metropolitan codes. */
const countiesAndUnitaries = {
	alsoIn: [{ geography: "localAuthority", year: 2022 }],
};

const schools = {
	period: schoolYear,
	alsoIn: [
		{ geography: "localAuthority", year: 2022 },
		{ geography: "localAuthority", year: 2018 },
	],
};

export const SCHOOL_PERFORMANCE: DeclaredDataset = {
	type: "schoolPerformance",
	module: "education",
	payload: {
		parts: yearParts(
			"schoolPerformance",
			"localAuthority",
			2024,
			{
				coverageCountries: ["GB-ENG"],
			},
			["2025"],
		),
		code: "ladCode",
		periodKeys: schoolYears,
		sparsePeriods: true,
		nullPaths: [
			"avgP8score",
			"series.2020.avgP8score",
			"series.2021.avgP8score",
			"series.2025.avgP8score",
		],
	},
	name: "ladName",
	...schools,
	measures: SCHOOL_MEASURES,
	fields: schoolFields("series.{period}."),
	derived: latestCopies(SCHOOL_COPIES),
	computed: latestCopyRules(SCHOOL_COPIES),
};
