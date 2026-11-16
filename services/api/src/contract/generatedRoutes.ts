import { resolveBoundaryMetadata } from "../boundaries/resolveBoundaryMetadata";
import { compareBoundaryMetadata } from "../boundaries/compareBoundaryMetadata";
import { boundaryFastifyRoutes } from "../boundaries/boundaryFastifyRoutes";
import { similarAreasFastifyRoutes } from "../areas/similarAreasFastifyRoutes";
import { similarAreasContract } from "../areas/similarAreasContract";
import { similarAreasMetadata } from "../areas/similarAreasMetadata";
import {
	boundaryReleaseDetail,
	resolveBoundary,
	compareBoundary,
	boundaryReleases,
	boundaries,
} from "../boundaries/boundaryContract";
import { boundaryReleaseMetadata } from "../boundaries/boundaryReleaseMetadata";
import { boundaryReleasesMetadata } from "../boundaries/boundaryReleasesMetadata";
import { boundariesMetadata } from "../boundaries/boundariesMetadata";
import { atlasAssetFastifyRoutes } from "../atlas/atlasAssetFastifyRoutes";
import { atlasLookupContract } from "../atlas/atlasLookupContract";
import { atlasLookupMetadata } from "../atlas/atlasLookupMetadata";
import { atlasPageContract } from "../atlas/atlasPageContract";
import { atlasPageMetadata } from "../atlas/atlasPageMetadata";
import { coordinateContract } from "../coordinates/coordinateContract";
import { coordinateFastifyRoutes } from "../coordinates/coordinateFastifyRoutes";
import { coordinateMetadata } from "../coordinates/coordinateMetadata";
import { translationContract } from "../crosswalks/translationContract";
import { translationFastifyRoutes } from "../crosswalks/translationFastifyRoutes";
import { translationMetadata } from "../crosswalks/translationMetadata";
import { attributionContract } from "../attribution/attributionContract";
import { attributionFastifyRoutes } from "../attribution/attributionFastifyRoutes";
import { attributionMetadata } from "../attribution/attributionMetadata";
import {
	analysisGeographiesContract,
	analysisPlanContract,
} from "../analysis/analysisContract";
import { analysisFastifyRoutes } from "../analysis/analysisFastifyRoutes";
import { analysisGeographiesMetadata } from "../analysis/analysisGeographiesMetadata";
import { analysisPlanMetadata } from "../analysis/analysisPlanMetadata";
import { documentContract } from "../documents/documentContract";
import { documentFastifyRoutes } from "../documents/documentFastifyRoutes";
import { documentMetadata } from "../documents/documentMetadata";
import { measureExportRoutes } from "../data/measureExportRoutes";
import { measureExportMetadata } from "../data/measureExportContract";
import Fastify from "fastify";
import { z } from "zod";
import {
	datasets,
	datasetDetail,
	measures,
	measureDetail,
	themes,
	modules,
} from "../catalogue/catalogueContract";
import { catalogueFastifyRoutes } from "../catalogue/catalogueFastifyRoutes";
import { datasetMetadata } from "../catalogue/datasetMetadata";
import { measureMetadata } from "../catalogue/measureMetadata";
import { datasetsMetadata } from "../catalogue/datasetsMetadata";
import { measuresMetadata } from "../catalogue/measuresMetadata";
import { themesMetadata } from "../catalogue/themesMetadata";
import { modulesMetadata } from "../catalogue/modulesMetadata";
import swagger from "@fastify/swagger";
import type { RouteContextFor } from "../runtime/index.ts";
import { atlasRelease } from "./atlasRelease";
import { atlasReleaseRoutes } from "./atlasReleaseRoutes";
import { documentation } from "./documentation";
import { documentationRoutes } from "./documentationRoutes";
import { openapiDescription } from "./openapiDescription";
import { rootRoutes } from "./rootRoutes";
import { rootMetadata } from "./rootMetadata";

export const createContractApp = async (context: RouteContextFor<never>) => {
	const app = Fastify({ exposeHeadRoutes: false });
	await app.register(swagger, {
		openapi: {
			openapi: "3.1.0",
			info: { title: "UK Data Atlas API", version: "1" },
		},
	});
	await app.register(documentationRoutes, { context });
	await app.register(rootRoutes, { context });
	await app.register(atlasReleaseRoutes, { context });
	await app.register(catalogueFastifyRoutes, { context });
	await app.register(boundaryFastifyRoutes, { context });
	await app.register(similarAreasFastifyRoutes, { context });
	await app.register(documentFastifyRoutes, { context });
	await app.register(atlasAssetFastifyRoutes, { context });
	await app.register(coordinateFastifyRoutes, { context });
	await app.register(translationFastifyRoutes, { context });
	await app.register(attributionFastifyRoutes, { context });
	await app.register(analysisFastifyRoutes, { context });
	await app.register(measureExportRoutes, { context });
	await app.ready();
	return app;
};

/**
 * Fastify names path parameters in camel case and cannot spell a suffix after
 * one, so a few paths are renamed to the form the description publishes.
 */
const openapiPath = (path: string) =>
	path
		.replace("{datasetId}", "{dataset-id}")
		.replace("{measureId}", "{measure-id}")
		.replace("/documents/{documentId}", "/documents/{document-id}.json")
		.replace("/atlas-lookups/{lookupId}", "/atlas-lookups/{lookup-id}.json")
		.replace("/atlas-pages/{pageId}", "/atlas-pages/{page-id}.json");

/**
 * An object that declares no properties and allows any other is written
 * `type: object`, which says the same and is how the description reads it.
 */
const openObjectAsPlain = <T extends Record<string, unknown>>(schema: T) => {
	const { properties, additionalProperties, ...rest } = schema as Record<
		string,
		unknown
	>;
	const isEmpty = (value: unknown) =>
		typeof value === "object" &&
		value !== null &&
		Object.keys(value).length === 0;
	if (
		properties !== undefined &&
		isEmpty(properties) &&
		isEmpty(additionalProperties)
	)
		return rest as Omit<T, "$schema">;
	return schema as Omit<T, "$schema">;
};

export const generatedPaths = async () => {
	const app = await createContractApp({
		boundaryRegistry: { schemaVersion: 1, contentHash: "", releases: [] },
	});
	const paths = Object.fromEntries(
		Object.entries(app.swagger().paths ?? {}).map(([path, operation]) => [
			openapiPath(path),
			operation,
		]),
	);
	if (!paths["/"]?.get) throw new Error("Missing Fastify operation: /");
	Object.assign(paths["/"].get, rootMetadata);
	for (const route of [openapiDescription, documentation, atlasRelease]) {
		const operation = paths[route.path]?.get;
		if (!operation)
			throw new Error(`Missing Fastify operation: ${route.path}`);
		operation.responses["503"] = route.responses[503];
		if (route.path === atlasRelease.path) {
			const { schema, ...media } =
				atlasRelease.responses[200].content["application/json"];
			operation.responses["200"] = {
				description: atlasRelease.responses[200].description,
				content: {
					"application/json": {
						...media,
						schema: {
							$ref: "#/components/schemas/AtlasReleaseEnvelope",
						},
					},
				},
			};
		}
	}
	for (const [path, metadata, definition] of [
		["/boundaries", boundariesMetadata, boundaries],
		[
			"/boundary-releases:resolve",
			resolveBoundaryMetadata,
			resolveBoundary,
		],
		[
			"/boundary-releases:compare",
			compareBoundaryMetadata,
			compareBoundary,
		],
		["/boundary-releases", boundaryReleasesMetadata, boundaryReleases],
		[
			"/boundary-releases/{geography}/{release}",
			boundaryReleaseMetadata,
			boundaryReleaseDetail,
		],
		["/datasets", datasetsMetadata, datasets],
		["/datasets/{dataset-id}", datasetMetadata, datasetDetail],
		["/measures", measuresMetadata, measures],
		["/measures/{measure-id}", measureMetadata, measureDetail],
		["/themes", themesMetadata, themes],
		["/modules", modulesMetadata, modules],
		[
			"/areas/{geography}/{code}/similar",
			similarAreasMetadata,
			similarAreasContract,
		],
		["/documents/{document-id}.json", documentMetadata, documentContract],
		[
			"/atlas-lookups/{lookup-id}.json",
			atlasLookupMetadata,
			atlasLookupContract,
		],
		["/atlas-pages/{page-id}.json", atlasPageMetadata, atlasPageContract],
		["/coordinates:convert", coordinateMetadata, coordinateContract],
		["/translations", translationMetadata, translationContract],
		["/attribution", attributionMetadata, attributionContract],
		[
			"/analysis-geographies",
			analysisGeographiesMetadata,
			analysisGeographiesContract,
		],
		["/analysis:plan", analysisPlanMetadata, analysisPlanContract],
	] as const) {
		const operation = paths[path]?.get;
		if (!operation) throw new Error(`Missing Fastify operation: ${path}`);
		// A response described only in words publishes no body schema.
		if (!("content" in metadata.responses[200])) {
			Object.assign(operation, metadata);
			continue;
		}
		const { $schema, ...described } = openObjectAsPlain(
			z.toJSONSchema(
				definition.responses[200].content["application/json"].schema,
			),
		);
		// A schema the description shares by reference keeps that reference.
		const published = metadata.responses[200].content[
			"application/json"
		] as { schema?: { $ref?: string } };
		const schema = published.schema?.$ref ? published.schema : described;
		Object.assign(operation, metadata, {
			responses: {
				...metadata.responses,
				200: {
					...metadata.responses[200],
					content: {
						"application/json": {
							...metadata.responses[200].content[
								"application/json"
							],
							schema,
						},
					},
				},
			},
		});
	}
	const exportOperation = paths["/data/{measure-id}/export"]?.get;
	if (!exportOperation)
		throw new Error("Missing Fastify operation: measure export");
	Object.assign(exportOperation, measureExportMetadata);
	await app.close();
	return paths;
};
