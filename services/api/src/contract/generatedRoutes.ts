import { resolveBoundaryMetadata } from "../boundaries/resolveBoundaryMetadata";
import { compareBoundaryMetadata } from "../boundaries/compareBoundaryMetadata";
import { boundaryFastifyRoutes } from "../boundaries/boundaryFastifyRoutes";
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
import Fastify from "fastify";
import { z } from "zod";
import {
	datasets,
	datasetDetail,
	measures,
	measureDetail,
} from "../catalogue/catalogueContract";
import { catalogueFastifyRoutes } from "../catalogue/catalogueFastifyRoutes";
import { datasetMetadata } from "../catalogue/datasetMetadata";
import { measureMetadata } from "../catalogue/measureMetadata";
import { datasetsMetadata } from "../catalogue/datasetsMetadata";
import { measuresMetadata } from "../catalogue/measuresMetadata";
import swagger from "@fastify/swagger";
import type { RouteContextFor } from "@uk-data-atlas/atlas-runtime/api";
import { atlasRelease } from "./atlasRelease";
import { atlasReleaseRoutes } from "./atlasReleaseRoutes";
import { documentation } from "./documentation";
import { documentationRoutes } from "./documentationRoutes";
import { openapiDescription } from "./openapiDescription";

export const createContractApp = async (context: RouteContextFor<never>) => {
	const app = Fastify({ exposeHeadRoutes: false });
	await app.register(swagger, {
		openapi: {
			openapi: "3.1.0",
			info: { title: "UK Data Atlas API", version: "1" },
		},
	});
	await app.register(documentationRoutes, { context });
	await app.register(atlasReleaseRoutes, { context });
	await app.register(catalogueFastifyRoutes, { context });
	await app.register(boundaryFastifyRoutes, { context });
	await app.ready();
	return app;
};

export const generatedPaths = async () => {
	const app = await createContractApp({
		boundaryRegistry: { schemaVersion: 1, contentHash: "", releases: [] },
	});
	const paths = Object.fromEntries(
		Object.entries(app.swagger().paths ?? {}).map(([path, operation]) => [
			path
				.replace("{datasetId}", "{dataset-id}")
				.replace("{measureId}", "{measure-id}"),
			operation,
		]),
	);
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
	] as const) {
		const operation = paths[path]?.get;
		if (!operation) throw new Error(`Missing Fastify operation: ${path}`);
		const { $schema, ...schema } = z.toJSONSchema(
			definition.responses[200].content["application/json"].schema,
		);
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
	await app.close();
	return paths;
};
