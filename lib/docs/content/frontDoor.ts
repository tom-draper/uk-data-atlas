import type { DocsRequestBody } from "../openapi";

/**
 * The front door: the routes that answer most questions, with one copyable
 * request each. Listed in the order of the "Front door" table in
 * `services/api/DIRECTION.md`, and asked about the places its question bank
 * uses (North Wales, Manchester, Allerdale). The reference pages and
 * `llms.txt` both read this, so an example is written once.
 * tests/docs/frontDoor.test.ts fails if a route here has no operation in the
 * spec, or an example uses a parameter the operation does not take.
 *
 * Methods and paths come from the spec through `operationId`, so a route is
 * not restated here.
 */
export interface FrontDoorRoute {
	operationId: string;
	/** What the request answers, as a question. */
	question: string;
	/** After `/v1`, as typed: spaces as `%20` so it pastes into a shell. */
	request: string;
	/** What a POST sends. */
	body?: DocsRequestBody;
}

export const FRONT_DOOR: FrontDoorRoute[] = [
	{
		operationId: "resolvePlaces",
		question: "Which places are called North Wales?",
		request: "/places?q=North%20Wales",
	},
	{
		operationId: "getArea",
		question: "What is Manchester, as an area?",
		request: "/areas/localAuthority/latest/E08000003",
	},
	{
		operationId: "getAreaGeometry",
		question: "What is Manchester's outline, simplified for a map?",
		request: "/areas/localAuthority/latest/E08000003/geometry?tier=low",
	},
	{
		operationId: "getAreaHistory",
		question: "What replaced Allerdale?",
		request: "/areas/localAuthority/2022-12-uk-bgc-v2/E07000026/history",
	},
	{
		operationId: "getAreaParents",
		question: "Which areas is Manchester part of?",
		request: "/areas/localAuthority/latest/E08000003/parents",
	},
	{
		operationId: "getAreaChildren",
		question: "Which wards are in Manchester?",
		request:
			"/areas/localAuthority/latest/E08000003/children?childGeography=ward",
	},
	{
		operationId: "getAreaNeighbours",
		question: "Which areas border Manchester?",
		request: "/areas/localAuthority/latest/E08000003/neighbours",
	},
	{
		operationId: "findContainingAreas",
		question: "Which areas contain this point in Manchester?",
		request:
			"/areas:contains?lat=53.4808&lng=-2.2426&geography=localAuthority",
	},
	{
		operationId: "resolvePostcode",
		question: "What is at Manchester Town Hall's postcode?",
		request: "/postcodes/M25DB",
	},
	{
		operationId: "listBoundaries",
		question: "Which kinds of area does the archive hold?",
		request: "/boundaries",
	},
	{
		operationId: "listBoundaryReleases",
		question: "Which boundary releases are in the archive?",
		request: "/boundary-releases",
	},
	{
		operationId: "getBoundaryRelease",
		question: "Where can I download all 2019 ward boundaries as one file?",
		request: "/boundary-releases/ward/2019-12-uk-bgc",
	},
	{
		operationId: "resolveBoundaryReleaseForDate",
		question: "Which local authority release was current on 1 June 2022?",
		request:
			"/boundary-releases:resolve?geography=localAuthority&date=2022-06-01",
	},
	{
		operationId: "listNamedLocations",
		question: "Which named places match North Wales?",
		request: "/locations?q=North%20Wales",
	},
	{
		operationId: "getNamedLocation",
		question: "What is Greater Manchester, as a named place?",
		request: "/locations/greater-manchester",
	},
	{
		operationId: "getNamedLocationMembers",
		question: "Which local authorities make up Greater Manchester?",
		request:
			"/locations/greater-manchester/members?geography=localAuthority&release=2025-12-uk-bgc",
	},
	{
		operationId: "getNamedLocationGeometry",
		question: "What is Greater Manchester's outline?",
		request: "/locations/greater-manchester/geometry",
	},
	{
		operationId: "translateAreaCode",
		question: "Which area took over Allerdale's code in 2023?",
		request:
			"/translations?from=localAuthority/2022-12-uk-bgc-v2&code=E07000026&to=localAuthority/2023-05-uk-bgc-v2&purpose=membership",
	},
	{
		operationId: "validateAreaValues",
		question: "Which boundary release do these names and codes belong to?",
		request:
			"/areas:validate?geography=localAuthority&value=Allerdale&value=E08000003",
	},
	{
		operationId: "validateAreaValuesPosted",
		question: "Which boundary release does this list of names belong to?",
		request: "/areas:validate?geography=localAuthority",
		body: {
			contentType: "application/json",
			example: '{"values":["Allerdale","Manchester"]}',
		},
	},
	{
		operationId: "joinRowsToBoundaryRelease",
		question: "How do I map my values for Manchester's 2019 wards?",
		request: "/boundary-releases/ward/2019-12-uk-bgc:join",
		body: {
			contentType: "application/json",
			example:
				'{"rows":[{"area":"E05011361","value":14.2},{"area":"E05011368","value":9.8},{"area":"E05011376","value":11.5}]}',
		},
	},
	{
		operationId: "listMeasures",
		question: "Which measures are about house prices?",
		request: "/measures?q=house%20prices",
	},
	{
		operationId: "getMeasureValueForPlace",
		question: "What is the population of North Wales?",
		request: "/data/population/value?place=north%20wales",
	},
	{
		operationId: "getMeasureObservations",
		question: "What is the population of each local authority in 2022?",
		request:
			"/data/population?geography=localAuthority&period=2022&limit=5",
	},
	{
		operationId: "getSourceExactMeasureSeries",
		question: "How has Manchester's population changed over time?",
		request: "/data/population/series?place=Manchester",
	},
];
