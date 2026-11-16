export const dataValueMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureId",
		},
		{
			name: "place",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			example: "North West",
			description:
				"A place name, an area code, a unit postcode, or a place reference such as `localAuthority/E08000003` or `postcode/SW1A1AA` from `GET /v1/places`. One of `place` or `postcode` is required.\n",
		},
		{
			name: "postcode",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			example: "SW1A 1AA",
			description:
				"A full unit postcode, in any case and with or without its space. Refused as `/postcodes/{postcode}` refuses it.\n",
		},
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The source geography to answer from, or with `postcode`, the geography to answer in, such as `lsoa` or `localAuthority`. Omit for the finest that answers.\n",
		},
		{
			name: "codeYear",
			in: "query",
			required: false,
			schema: {
				type: "string",
				pattern: "^\\d{4}$",
			},
			description:
				"With `postcode`, the boundary year of the partition to answer from. Omit for the newest.\n",
		},
		{
			name: "period",
			in: "query",
			required: false,
			description: "A published period. Omit for the latest.",
			schema: {
				type: "string",
			},
		},
		{
			name: "datasetId",
			in: "query",
			schema: {
				type: "string",
			},
			description: "Select the published dataset to answer from.",
		},
		{
			name: "from",
			in: "query",
			schema: {
				type: "string",
			},
			description:
				"Exact source geography/release for a membership crosswalk.",
		},
		{
			name: "crosswalk",
			in: "query",
			schema: {
				type: "string",
			},
			description: "Membership crosswalk to sum values onto an area.",
		},
		{
			name: "path",
			in: "query",
			schema: {
				type: "string",
			},
			description: "Membership relationship path, in place of crosswalk.",
		},
	],
	operationId: "getMeasureValueForPlace",
	tags: ["Start here"],
	summary: "Answer a measure for a place by name (by-place dispatcher)",
	"x-likely-refusal": {
		status: 422,
		code: "place_not_served",
		when: "The name matches places, but the measure answers none. Each candidate says why.",
		"x-example-request":
			"/v1/data/house-price-median/value?place=North%20West",
	},
	description:
		"A deliberately narrow convenience for a place-name question, not the primary way to fetch one observation: it resolves the name and dispatches to a route that already serves that kind of place. Ask `/data/{measure-id}` for observations, or `/data/{measure-id}/series` for one area's values, when the area is already known.\n\nIt answers \"what is the population of the North West?\" in one call. The place may be a name, an area code or a place reference from `/places`; the period may be omitted, in which case the latest the chosen partition publishes is used and the answer says so. Where a name may mean several places, `GET /v1/places?q=Newport` lists them first, and a candidate's place reference asks about that one alone: `GET /v1/data/population/value?place=localAuthority/W06000022`.\n\nNothing is computed here. Each place the name could mean is put to the route that already serves that kind of place: `series` for an area, `aggregate` for a curated location or a country. The value, its provenance and every refusal are exactly what that route gives, and `via` names the call that gives the answer directly, for citing or repeating.\n\nThe candidate is chosen by what the measure can answer rather than by guessing what was meant. Places matching the name exactly are tried first; names merely beginning with it only when no exact match answers. Answers resting on the same partition, period and area codes are the same ground reached two ways and count once, keeping the publisher's own observation over an aggregate of one member: Manchester the authority and Manchester the curated location of that authority give one answer. The other places the name matched are listed in `otherMatches`, answered or not.\n\nWhen the name gives more than one distinct answer, the usual geography tier chooses the most likely match. `question.placeDefaulted` says this happened and `otherMatches` lists every alternative with its answer or refusal. \"Newport\", for example, defaults to the Welsh authority over wards of the same name. When the name matches places but the measure answers none, the response is a 422 with a `candidates` member saying why for each, such as a median, which cannot be summed over a region.\n\nA measure with dimensions answers for the members its filters name: `GET /v1/data/party-vote-share/value?place=Holborn and St Pancras&party=lab`. A dimension left out takes its total where one is published, and `defaults` and `dimensions` say which member was used. Several members, or `*`, answer every matching series at once: `data.breakdown` holds one entry per series, each with its `dimensions` and the answer (`data`) or refusal (`problem`) that series gives, so `GET /v1/data/recorded-crimes/value?place=Leeds&offence=*` is every crime type for Leeds. Retired path ids such as `crime-burglary` return a 404 with the canonical measure and members.\n\nGive `postcode` instead of `place` to answer for where a unit postcode is: `GET /v1/data/imd-decile/value?postcode=M1 1AE`. The postcode's centroid is placed in the areas the data was published for, as drawn for the data's own boundary year rather than today's, in a boundary release holding that partition's codes; `boundaryMatch` names it. With no `geography`, the finest geography the measure is published on is tried first, and a coarser one only where a finer does not cover the postcode's country or has no value there; `passedOver` says why, and `otherGeographies` gives the request for each other geography. A centroid on a shared boundary whose areas answer differently is a 409 with `choices`, and a postcode no geography answers is a 422 with a `candidates` member saying why for each.\n",
	"x-refused-query-parameters": ["release", "conversion", "aggregate"],
	responses: {
		"200": {
			description:
				"The answer, the place it is for, and the route that gives it.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population/value?place=North%20West&period=2022",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							measure: {
								id: "population",
								label: "Population",
								valueKind: "count",
								unit: "people",
							},
							question: {
								place: "North West",
								period: "2022",
								placeDefaulted: false,
							},
							answer: {
								period: "2022",
								periodDefaulted: false,
								status: "derived",
								value: 7526285,
								unit: "people",
							},
							place: {
								place: "location/north-west",
								kind: "named-location",
								name: "North West",
								geography: "named-location",
								code: "north-west",
								match: "exact",
							},
							method: "aggregate",
							via: "/v1/data/population/value?place=location/north-west&geography=localAuthority&codeYear=2023&period=2022",
							otherMatches: [
								{
									place: "region/E12000002",
									kind: "area",
									name: "North West",
									geography: "region",
									code: "E12000002",
									match: "exact",
									served: false,
									reason: "population is not published for region areas.",
								},
							],
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			description:
				"No published measure has that id, or no place is called or coded that.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"409": {
			description:
				"The name gives more than one distinct answer. `choices` lists each place with its answer and the request that asks about it alone.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"422": {
			description:
				"The name matches places, but the measure answers none of them. `candidates` says why for each.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/PlaceNotServedProblem",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
