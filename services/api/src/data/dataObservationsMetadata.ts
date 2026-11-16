export const dataObservationsMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			name: "measure-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A published measure id, for example `population`, `ghg-emissions` or `mobile-5g-coverage`. `GET /measures` lists them, each with the aggregation its values permit.\n",
		},
		{
			$ref: "#/components/parameters/OptionalSourcePeriod",
		},
		{
			$ref: "#/components/parameters/OptionalSourceGeography",
		},
		{
			$ref: "#/components/parameters/OptionalSourceCodeYear",
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Caller-selected geometry release. Accepted only when every source code is present in a published compatibility candidate; it does not convert values or assert equal geometry.\n",
		},
		{
			$ref: "#/components/parameters/Place",
		},
		{
			name: "include",
			in: "query",
			required: false,
			schema: {
				enum: ["area"],
			},
			description:
				"Add the selected release's canonical area identity, name and aliases to each record. Requires a compatible `release`.\n",
		},
		{
			name: "format",
			in: "query",
			required: false,
			schema: {
				enum: ["json", "csv", "ndjson"],
				default: "json",
			},
			description:
				'`json` returns the API envelope. `csv` and `ndjson` return one provenance-bearing row per observation, suitable for downloads and line-oriented processing. Each row carries the measure\'s `unit`, so a saved file cannot be read in the wrong one, and ends with `lowerBound` and `upperBound`, empty where no interval is published. Tabular responses are paginated like the JSON ones, but carry the next page as a `Link` header with `rel="next"` because they have no envelope to hold a cursor.\n',
		},
		{
			name: "units",
			in: "query",
			required: false,
			schema: {
				enum: ["source", "canonical"],
				default: "source",
			},
			description:
				"`source` (the default) returns the published values and display unit unchanged. `canonical` returns JSON numeric values multiplied by the measure's declared `unitDefinition.scaleToCanonical`, plus a `valueRepresentation` calculation receipt. It is unavailable for categorical observations and tabular formats.\n",
		},
		{
			$ref: "#/components/parameters/PageLimit",
		},
		{
			$ref: "#/components/parameters/PageCursor",
		},
	],
	operationId: "getMeasureObservations",
	"x-refused-query-parameters": ["conversion", "aggregate"],
	tags: ["Map"],
	summary:
		"Retrieve source-exact observations, or an opt-in canonical-unit representation",
	"x-likely-refusal": {
		status: 400,
		when: "The measure is published on several geographies and neither `geography` nor `place` names one, so no partition is chosen for the caller.",
		"x-example-request": "/v1/data/population?period=2022",
	},
	description:
		"Serves observed values for one published measure and source partition. `population` covers 2022 Ward 2023 codes in England and Wales, 2011–2024 Local Authority 2023 codes across all four UK nations, and ONS's own mid-2021 and mid-2022 estimates for the July 2024 Westminster constituencies in England and Wales. `ghg-emissions` covers 2005–2024 Local Authority 2025 codes across all four nations, as net territorial emissions in kt CO2e; emissions per resident are not served, because a ratio cannot be summed over areas. `total-jobs` covers 2011–2024 Local Authority 2023 codes, as jobs counted at the workplace and rounded by ONS to the nearest thousand. Great Britain is published for every year and Northern Ireland for 2020 to 2022 only; in the other years Northern Ireland has no records rather than zero jobs, so a sum over it is refused, not reported as 0. `mobile-4g-coverage` and `mobile-5g-coverage` cover 2025 Local Authority 2024 codes across all four nations, as the share of premises reached by all four mobile network operators. Both are declared intensive: a share does not add over areas, and combining authorities needs the premises weight the measure names. `house-price-median` covers ward-level median price paid for England and Wales, 1995-2022, each period the year ending December, under the ward codes the publisher used except for one reviewed, code-only correction: Temple Newsam's E05013831 is served as the geometrically identical December 2020 code E05011412, with the publisher code carried as `sourceAreaCode`. It is declared `non-aggregatable` with `statistic: median`: a median of medians is not the median of the underlying sales, so aggregation and conversion both refuse it.\n`imd-rank` and `imd-decile` cover the English Index of Multiple Deprivation 2019 for 32,844 LSOAs on 2011 codes. Both are ordinal and `non-aggregatable`, and both are positions within England alone: the other nations' indices use different methods and cannot be compared.\n`wimd-rank` and `wimd-decile` cover the Welsh Index of Multiple Deprivation 2019 for 1,909 LSOAs on 2011 codes, as published.\n`simd-rank` and `simd-decile` cover the Scottish Index of Multiple Deprivation 2020v2 for 6,976 data zones on 2011 codes, as published.\n`nimdm-rank` covers the Northern Ireland Multiple Deprivation Measure 2017 for 890 super output areas, identified by NISRA codes such as `95AA01S1` rather than GSS codes.\n`life-expectancy-male` and `life-expectancy-female` cover life expectancy at birth in England, Wales and Northern Ireland for every three-year period from 2001 to 2003 to 2020 to 2022, on December 2021 local-authority codes. They are `non-aggregatable`: a combined population's life expectancy has to be recalculated from deaths and population, not averaged.\nA measure that declares `uncertainty` carries the publisher's interval on each record as `confidenceInterval` (`lower`, `upper`), at the level the measure states. Intervals are never computed by this API.\n`population-density` is the one derived measure: mid-year population divided by ONS Standard Area Measurement land area, which excludes inland water. Its values carry `status: \"derived\"` rather than `observed`, no publisher is answerable for the quotient, and the measure names both input datasets in `derivedFrom` so attribution covers the denominator. It is intensive, so it neither aggregates nor converts.\nThe `travel-to-work-*` and `car-availability-*` measures cover Census 2021 Local Authority April 2023 codes for England and Wales, as counts rather than shares; the four authorities created in April 2023 are summed from their predecessors, which are not served, so no resident is counted twice: a count of people or households adds over areas, and each breakdown publishes its own `-total` denominator so a caller can derive a share and know what it is a share of. `qualification-*` covers the same authorities' usual residents aged 16 and over by highest qualification, with its own `-total`, and `ethnicity-*` their usual residents in each of the nineteen census ethnic groups, which are exhaustive and so need no separate total. `broadband-*-availability` covers July 2025 Local Authority 2024 codes across all four nations, as the share of premises able to receive each service; like mobile coverage it is weighted by premises and is not offered for aggregation. `claimant-count` and `claimant-count-16-to-24` cover April 2026 Local Authority 2024 codes across all four nations, as counts of Universal Credit and Jobseeker's Allowance claimants rounded to the nearest five. `temporary-accommodation-households`, `-households-with-children` and `-children` cover January to March 2026 Local Authority 2025 codes for England; authorities that submitted no return have no record, so an England total over them is reported with partial coverage. `median-annual-pay` and `median-hourly-pay` cover 2025 provisional Local Authority 2025 codes for England, as median gross pay of employee jobs by where the employee lives; a median is not aggregatable. The `crime-*` measures cover the year ending March 2026 on Community Safety Partnership 2023 codes for England and Wales, as offence counts excluding fraud; offences unassigned to a partnership are not included, so partnership sums fall short of force and national totals. `unemployment-rate` and `unemployment-level` are ONS's final model-based estimates for Great Britain with 95% confidence intervals, on Local Authority 2019 codes for every period from 1996-97 to 2021 and on Local Authority 2021 codes for 2020 and 2021; periods to 2003-04 are financial years. `no2-background-mean`, `pm10-background-mean` and `pm25-background-mean` cover 2024 Local Authority 2024 codes across all four nations, as area means of Defra's 1x1 km PCM background maps, derived by this Atlas and aggregated weighted by `air-quality-grid-cells`; `pm25-population-weighted` and its `-anthropogenic` part are Defra's published population-weighted concentrations. This route never selects a May/December boundary release, converts values between geographies, or aggregates them. By default, it serves publisher-reported values and any reviewed, documented code-only repairs. A caller may ask for `units=canonical` to multiply numeric values and any published interval bounds by the measure's declared canonical scale. That response identifies the calculation and canonical unit; it never changes an observation artifact. A caller may supply `release` only when the compatibility report proves that every source code is present; the response identifies that caller-selected code join. `GET /measures/{measure-id}` declares valid period/geography combinations, and `GET /documents/measure-{measure-id}.json` declares eligible releases. The geography may be left out when `place` names an area, by name or code, or the measure is published on one; the boundary year and period then default to the newest partition and its latest period, stated in `defaults`. Every response includes compact provenance linking the immutable Atlas release, measure, source dataset and observation artifact, along with the selected geography match and an explicit statement that no transformation has been applied.\n",
	responses: {
		"200": {
			description:
				"A cursor-paginated JSON page or a source-exact tabular export. Canonical values are an opt-in JSON representation.",
			headers: {
				Link: {
					description:
						'Present on a tabular page that is not the last. An RFC 8288 `rel="next"` relation holding the same query with its cursor advanced.\n',
					schema: {
						type: "string",
					},
				},
			},
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population?period=2022&geography=ward&codeYear=2023&place=E05000932",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							measure: {
								id: "population",
								label: "Population",
								valueKind: "count",
								unit: "people",
								aggregation: {
									kind: "extensive",
									operation: "sum",
									available: true,
								},
								sources: [
									{
										datasetId: "population",
										periods: ["2022"],
										sourceGeography: {
											type: "ward",
											codeYear: 2023,
										},
										coverage: {
											kind: "partial",
											countries: ["GB-ENG"],
											recordCount: 7608,
											note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
										},
									},
								],
								availability: {
									sourceExact: true,
									conversion: false,
									aggregation: true,
								},
								links: {
									data: "/v1/data/population",
								},
							},
							source: {
								datasetId: "population",
								periods: ["2022"],
								sourceGeography: {
									type: "ward",
									codeYear: 2023,
								},
								coverage: {
									kind: "partial",
									countries: ["GB-ENG"],
									recordCount: 7608,
									note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
								},
							},
							period: "2022",
							sourceGeography: {
								type: "ward",
								codeYear: 2023,
							},
							provenance: {
								atlasRelease: {
									id: "sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
									href: "/v1/atlas-release",
								},
								measure: {
									id: "population",
									href: "/v1/measures/population",
								},
								geography: {
									source: {
										type: "ward",
										codeYear: 2023,
									},
									match: {
										status: "no-boundary-release-selected",
										note: "The published observations declare a geography type and code vintage, but not a boundary release.",
									},
								},
								transformation: {
									status: "not-applied",
									note: "Values are served source-exact; no geographic conversion or aggregation was applied.",
								},
								source: {
									dataset: {
										id: "population",
										href: "/v1/datasets/population",
									},
									observations: {
										artifact: "population-observations",
										contentHash:
											"sha256:af1de02a052ace448dfb92c80cc312118a16c30bc77bf7a8c4d0e24a24ddab18",
										period: "2022",
									},
								},
							},
							conversion: null,
							aggregation: null,
							records: [
								{
									areaCode: "E05000932",
									value: 12676,
									status: "observed",
								},
							],
						},
						meta: {
							nextCursor: null,
						},
					},
				},
				"text/csv": {
					schema: {
						type: "string",
					},
				},
				"application/x-ndjson": {
					schema: {
						type: "string",
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
				"The requested operation is not supported for this source-exact measure.",
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
