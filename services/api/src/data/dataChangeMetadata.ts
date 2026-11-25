export const dataChangeMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureId",
		},
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The geography of the source partition the change is measured inside. Both periods come from that one partition.\n",
		},
		{
			$ref: "#/components/parameters/OptionalSourceCodeYear",
		},
		{
			name: "startPeriod",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			example: "2011",
			description:
				"The period the change is measured from. Left out, the latest period before `endPeriod` that does not overlap it.\n",
		},
		{
			name: "endPeriod",
			in: "query",
			required: false,
			description:
				"A published period of the partition after `startPeriod`. Left out, the partition's latest period.\n",
			schema: {
				type: "string",
			},
			example: "2022",
		},
		{
			name: "by",
			in: "query",
			required: false,
			schema: {
				enum: ["absolute", "relative"],
				default: "absolute",
			},
			description:
				"Whether change is the difference in the published unit, or that difference as a proportion of the start value.\n",
		},
		{
			name: "order",
			in: "query",
			required: false,
			description:
				"`desc` puts the largest rise first, `asc` the largest fall.",
			schema: {
				enum: ["asc", "desc"],
				default: "desc",
			},
		},
		{
			$ref: "#/components/parameters/Place",
		},
		{
			$ref: "#/components/parameters/PageLimit",
		},
		{
			$ref: "#/components/parameters/PageCursor",
		},
	],
	operationId: "getSourceExactMeasureChange",
	"x-refused-query-parameters": ["release", "conversion", "aggregate"],
	tags: ["Trend"],
	summary:
		"Rank areas by change between two periods of one measure partition",
	"x-likely-refusal": {
		status: 400,
		when: "The partition cannot be chosen: the measure is published on several geographies and neither `geography` nor `place` picks one.",
		"x-example-request": "/v1/data/population/change?startPeriod=2011",
	},
	description:
		'Returns how each area changed between two periods, ranked: the question "where did population grow fastest between 2011 and 2022?" Pass `place` for one area, which keeps its rank among all of them, so "Manchester grew 13.2%, 42nd of 361" is a single call.\n\nChange is measured inside one source partition, never across two. The publisher restates every period of a partition on a single set of codes, so an area code names the same ground at the start and the end. Pairing periods from partitions on different codes would pair areas that are not the same place, so it is not offered. A partition that cannot be chosen returns a 400 listing the partitions and how many periods each has.\n\nThe geography may be left out when `place` names an area, by name or code, or the measure is published on one geography. The boundary year and periods may be left out too: the newest partition is used, ending at its latest period and starting at the latest one before the end that does not overlap it. What was chosen is returned in `defaults`.\n\n`by=absolute` ranks the end value less the start, in the measure\'s unit. `by=relative` ranks that as a proportion of the start, and is refused for a ratio: change in a share is read in points, and a rise in coverage from 2% to 3% is not usefully called 50%. An area whose start is zero has no relative change and is left out of a relative ranking, counted in `coverage.withoutRelativeChange`. Currency is nominal and not adjusted for inflation.\n\nSome changes are refused outright. A rank or decile is a position among the other areas rather than a quantity, so a move in it is not change in the area. A partition publishing one period has nothing to change between. Rolling windows that share years, such as life expectancy for 2017-2019 and 2018-2020, are refused because most of the apparent change is the same data counted twice.\n\nWhere the publisher gives intervals, each record says whether the start and end intervals overlap. Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do not show that it is. Areas with a value in only one period are listed in `coverage.onlyAtStart` and `coverage.onlyAtEnd` rather than paired with anything.\n',
	responses: {
		"200": {
			description:
				"Cursor-paginated competition ranks of change for the source partition.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population/change?geography=localAuthority&codeYear=2023&startPeriod=2011&endPeriod=2022&by=relative&limit=1",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							startPeriod: "2011",
							endPeriod: "2022",
							change: {
								direction: "end-minus-start",
								basis: "relative",
								order: "desc",
								unit: "proportion",
								interpretation:
									"Change in the source-published unit.",
							},
							coverage: {
								areasRanked: 361,
								areasWithBothPeriods: 361,
								onlyAtStart: [],
								onlyAtEnd: [],
								withoutRelativeChange: 0,
							},
							records: [
								{
									areaCode: "E09000001",
									rank: 1,
									tieCount: 1,
									start: {
										period: "2011",
										areaCode: "E09000001",
										value: 7412,
										status: "observed",
									},
									end: {
										period: "2022",
										areaCode: "E09000001",
										value: 11615,
										status: "observed",
									},
									absoluteChange: 4203,
									relativeChange: 0.567,
								},
							],
						},
						meta: {
							nextCursor: "<opaque cursor>",
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"409": {
			$ref: "#/components/responses/AmbiguousArea",
		},
		"422": {
			description:
				"The measure is a rank, decile or category; its partition publishes a single period; the two periods overlap; or a geometry release, conversion or aggregation was asked for.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
