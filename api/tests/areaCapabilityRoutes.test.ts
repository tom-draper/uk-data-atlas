import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { route as routeRequest } from "../src/routes";
import {
	registry,
	compatibleWardAreaLookup,
	crosswalkLookup,
	namedLocationInventory,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
	measureCompatibilityInventory,
	testContext,
} from "./routeFixtures";

test("reports an area's exact-release capability and availability matrix", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/capabilities",
		testContext({
			boundaryRegistry: registry,
			areaLookup: compatibleWardAreaLookup,
			crosswalkLookup,
			namedLocationInventory,
			dataCatalog,
			populationObservations,
			populationLocalAuthorityObservations,
			measureObservations,
			measureCompatibilityInventory,
		}),
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object" && "capabilities" in data);
	const capabilities = (data as { capabilities: Record<string, unknown> })
		.capabilities;
	assert.deepEqual(capabilities.geometry, {
		status: "not-published",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/geometry",
	});
	assert.deepEqual(capabilities.relationships, {
		status: "available",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/relationships",
		count: 0,
		byRelation: {},
		parents: {
			count: 0,
			href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/parents",
		},
		children: {
			count: 0,
			href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/children",
		},
		crosswalks: [],
	});
	assert.equal(
		(capabilities.namedLocations as { status: string }).status,
		"available",
	);
	const measureData = capabilities.data as {
		status: string;
		measures: Array<{
			id: string;
			sources: Array<{
				periods: Array<{ availability: string; status?: string }>;
			}>;
		}>;
	};
	assert.equal(measureData.status, "available");
	assert.deepEqual(measureData.measures, [
		{
			id: "population-estimate",
			valueKind: "count",
			unit: "people",
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			href: "/v1/measures/population-estimate",
			sources: [
				{
					dataset: {
						id: "population",
						href: "/v1/datasets/population",
					},
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					codeSetCompatibility: {
						boundaryRelease: "2023-05-uk-bgc",
						title: "Wards, May 2023",
						coverageCountries: ["GB-ENG", "GB-WLS"],
						status: "code-set-compatible",
						sourceAreaCount: 2,
						boundaryAreaCount: 3,
						matchingSourceAreaCount: 2,
						matchingSourceAreaShare: 1,
						unmatchedSourceAreaCount: 0,
						candidateOnlyAreaCount: 1,
						eligibleForCodeJoin: true,
					},
					periods: [
						{
							period: "2022",
							artifact: "population-observations",
							contentHash: "sha256:population-observations",
							availability: "present",
							status: "observed",
						},
					],
				},
			],
		},
	]);
});

test("reports published geometry capability through the resolver", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2023-05-uk-bgc",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD23CD: "E05000001" },
						geometry: {
							type: "Point",
							coordinates: [-2.24, 53.48],
						},
					},
				],
			}),
		);
		const response = routeRequest(
			"GET",
			"/v1/areas/ward/2023-05-uk-bgc/E05000001/capabilities",
			testContext({
				boundaryRegistry: registry,
				areaLookup: compatibleWardAreaLookup,
				areaGeometryCache: new AreaGeometryCache(
					root,
					new Map([
						[
							"ward/2023-05-uk-bgc",
							{
								input: "boundaries/ward/2023-05-uk-bgc/wards.geojson",
								crs: "EPSG:4326",
								codeProperty: "WD23CD",
							},
						],
					]),
				),
			}),
		);
		const data = ("data" in response.body && response.body.data) as {
			capabilities: { geometry: unknown };
		};
		assert.deepEqual(data.capabilities.geometry, {
			status: "available",
			href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/geometry",
			provenance: { sourceCrs: "EPSG:4326" },
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
