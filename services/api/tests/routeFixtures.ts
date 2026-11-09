import { compileOperationTemplates } from "../../../pipeline/src/atlas/operationTemplates";
import { reportRequest } from "./evidenceFixtures";
import { createAreaLookup } from "@uk-data-atlas/areas";
import type { AreaGeometryCache } from "@uk-data-atlas/geometry";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/api";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { AtlasRelease } from "@uk-data-atlas/atlas-db";
import type { GeographyInventory } from "@uk-data-atlas/atlas-runtime/loader";
import type { RelationshipCandidateInventory } from "@uk-data-atlas/relationships";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "@uk-data-atlas/atlas-runtime/places";
import type { ValidationReport } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { DataCatalog } from "@uk-data-atlas/atlas-runtime/catalogue";
import { createOperationMatcher } from "@uk-data-atlas/atlas-runtime/api";
import { parse } from "yaml";
import {
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	registry,
	testContext as pipelineTestContext,
	type TestContextInputs,
} from "../../../pipeline/tests/contextFixtures";

export const testContext = (
	inputs: TestContextInputs = {},
	areaGeometryCache?: AreaGeometryCache,
): RouteContext => ({
	...pipelineTestContext(inputs, areaGeometryCache),
	operationMatcher:
		inputs.operationMatcher ??
		(inputs.openapiDocument
			? createOperationMatcher(
					compileOperationTemplates(parse(inputs.openapiDocument)),
				)
			: undefined),
});

export {
	areaLookup,
	containmentCrosswalk,
	crosswalkArtifact,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	registry,
	type TestContextInputs,
} from "../../../pipeline/tests/contextFixtures";

// Most tests exercise one narrow dependency combination. This fixture adapter
// keeps those cases concise while ensuring the production router only accepts
// its named RouteContext.
const fixtureRoute =
	(send: typeof routeRequest) =>
	(
		method: string | undefined,
		url: string | undefined,
		boundaryRegistry: BoundaryRegistry,
		geographyInventory?: RouteContext["geographyInventory"],
		areaLookup?: TestContextInputs["areaLookup"],
		crosswalkInventory?: RouteContext["crosswalkInventory"],
		crosswalkLookup?: TestContextInputs["crosswalkLookup"],
		atlasRelease?: RouteContext["atlasRelease"],
		areaGeometryCache?: AreaGeometryCache,
		relationshipCandidateInventory?: RouteContext["relationshipCandidateInventory"],
		validationReport?: RouteContext["validationReport"],
		namedLocationInventory?: RouteContext["namedLocationInventory"],
		namedLocationLookup?: TestContextInputs["namedLocationLookup"],
		dataCatalog?: RouteContext["dataCatalog"],
		measureCompatibilityInventory?: RouteContext["measureCompatibilityInventory"],
		measureObservations?: RouteContext["measureObservations"],
		exportManifest?: RouteContext["exportManifest"],
		relationshipPathInventory?: RouteContext["relationshipPathInventory"],
	) =>
		send(
			method,
			url,
			testContext({
				boundaryRegistry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				atlasRelease,
				areaGeometryCache,
				relationshipCandidateInventory,
				validationReport,
				namedLocationInventory,
				namedLocationLookup,
				relationshipPathInventory,
				dataCatalog,
				measureCompatibilityInventory,
				measureObservations,
				exportManifest,
			}),
		);

export const route = fixtureRoute(routeRequest);
export const report = fixtureRoute(reportRequest);

export const geographyInventory: GeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:geography",
	boundaryRegistryHash: "sha256:registry",
	releases: [],
	geographies: [],
};

export const compatibleWardAreaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:compatible-wards",
		geography: "ward",
		boundaryRelease: "2023-05-uk-bgc",
		codeProperty: "WD23CD",
		nameProperty: "WD23NM",
		areas: [
			{ code: "E05000001", name: "Compatible ward" },
			{ code: "W05000001", name: "Ward compatible" },
		],
	},
]);

// Named locations are curated from the gazetteer and carry codes from several
// vintages, so this lookup spans three releases: one older than the requested
// release, the requested one, and one newer.
export const namedLocationAreaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:legacy-local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2019-12-uk-lad",
		codeProperty: "LAD19CD",
		nameProperty: "LAD19NM",
		areas: [{ code: "E08000999", name: "Legacy authority" }],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		codeProperty: "LAD25CD",
		nameProperty: "LAD25NM",
		areas: [
			{ code: "E08000001", name: "Greater Manchester", aliases: ["GM"] },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:recoded-local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2026-05-uk-lad",
		codeProperty: "LAD26CD",
		nameProperty: "LAD26NM",
		areas: [{ code: "E08000998", name: "Recoded authority" }],
	},
]);

export const namedLocationInventory: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:named-locations",
	source: {
		artifact: "data/datasets/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "greater-manchester",
			label: "Greater Manchester",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "localAuthority",
			memberCodes: ["E08000000", "E08000001", "E08000998", "E08000999"],
			validity: { from: null, to: null },
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
};

export const namedLocationLookup = createNamedLocationLookup(
	namedLocationInventory,
);

export const routeWithData = (url: string) =>
	routeWithCatalog(url, dataCatalog, measureObservations);

const fixtureDataRoute =
	(send: typeof routeRequest) =>
	(
		url: string,
		catalog: DataCatalog,
		observations: RouteContext["measureObservations"],
		overrides: Pick<
			TestContextInputs,
			| "crosswalkLookup"
			| "measureCompatibilityInventory"
			| "analysisGeographyInventory"
			| "exportManifest"
			| "exportFiles"
			| "relationshipPathInventory"
		> = {},
	) =>
		send(
			"GET",
			url,
			testContext({
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup: overrides.crosswalkLookup ?? crosswalkLookup,
				dataCatalog: catalog,
				measureCompatibilityInventory:
					overrides.measureCompatibilityInventory ??
					measureCompatibilityInventory,
				analysisGeographyInventory:
					overrides.analysisGeographyInventory,
				measureObservations: [
					populationObservations,
					populationLocalAuthorityObservations,
					...(observations ?? []),
				],
				exportManifest: overrides.exportManifest,
				exportFiles: overrides.exportFiles,
				relationshipPathInventory: overrides.relationshipPathInventory,
			}),
		);

export const routeWithCatalog = fixtureDataRoute(routeRequest);

export const atlasRelease: AtlasRelease = {
	schemaVersion: 1,
	releaseId: "sha256:atlas-release",
	artifacts: [
		{
			id: "boundary-registry",
			path: "data/build/artifacts/boundary-releases.json",
			contentHash: "sha256:registry",
		},
	],
};

export const relationshipCandidateInventory: RelationshipCandidateInventory = {
	schemaVersion: 1,
	contentHash: "sha256:relationship-candidates",
	candidates: [
		{
			id: "parish-2019-04-ew-bgc-to-local-authority-unavailable",
			input: "boundaries/parish/2019-04-ew-bgc/parishes.geojson",
			from: {
				geography: "parish",
				boundaryRelease: "2019-04-ew-bgc",
				codeProperty: "parncp19cd",
				nameProperty: "parncp19nm",
			},
			to: { codeProperty: "lad19cd", nameProperty: "lad19nm" },
			status: "not-available",
			validation: {
				endpoints: {
					from: {
						status: "verified",
						availableAreaCount: 11556,
						referencedCodeCount: 11556,
					},
					to: {
						status: "not-available",
						reason: "No compiled target release has lad19cd/lad19nm fields.",
					},
				},
				relationship: {
					sourceFeatureCount: 11556,
					sourceCodeCount: 11556,
					targetCodeCount: 339,
					multiTargetSourceCount: 0,
					missingValueFeatureCount: 0,
				},
				reasons: [
					"No compiled target release has lad19cd/lad19nm fields.",
				],
			},
		},
	],
};

export const validationReport: ValidationReport = {
	schemaVersion: 1,
	contentHash: "sha256:validation",
	inputs: { boundaryRegistry: "sha256:registry" },
	summary: {
		resourceCount: 4,
		checkCount: 4,
		passedCount: 3,
		waivedCount: 1,
		coverage: {
			boundaryReleases: 1,
			areaIdentities: 1,
			servableGeometry: 0,
			withRelationships: 1,
			crosswalks: 1,
			weightedCrosswalks: 0,
			measures: 1,
			measureSources: 1,
		},
	},
	resources: [
		{
			id: "boundary-releases/ward/2025-01-en-ward",
			kind: "boundary-release",
			status: "waived",
			checks: [
				{
					id: "geometry-servable",
					status: "waived",
					detail: "Geometry is EPSG:3857, and no transformation to WGS84 is available.",
					waiver: { reason: "No transformation yet." },
				},
			],
		},
		{
			id: "crosswalks/constituency-2010-to-2024-official-lookup-v2",
			kind: "crosswalk",
			status: "passed",
			checks: [{ id: "artifact-integrity", status: "passed" }],
		},
		{
			id: "measures/crime-total",
			kind: "measure",
			status: "passed",
			checks: [{ id: "measure-definition", status: "passed" }],
		},
		{
			id: "exports/crime-total-observations",
			kind: "measure-source",
			status: "passed",
			checks: [
				{
					id: "components-sum-to-total",
					status: "passed",
					measured: { comparedCount: 314, mismatchCount: 0 },
				},
			],
		},
	],
};
