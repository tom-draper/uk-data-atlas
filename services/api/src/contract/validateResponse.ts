import {
	boundaryReleaseDetail,
	resolveBoundary,
	compareBoundary,
	boundaryReleases,
	boundaries,
} from "../boundaries/boundaryContract";
import { publicJson } from "@uk-data-atlas/atlas-runtime/storage";
import type { ApiResponse } from "@uk-data-atlas/atlas-runtime/api";
import type { z } from "zod";
import { atlasRelease } from "./atlasRelease";
import {
	datasets,
	measures,
	datasetDetail,
	measureDetail,
} from "../catalogue/catalogueContract";
import { documentation } from "./documentation";
import { openapiDescription } from "./openapiDescription";

export const validateResponse = (schema: z.ZodType, answer: ApiResponse) => {
	if (answer.status === 200)
		schema.parse(
			answer.representation?.body ??
				JSON.parse(publicJson(answer.body) ?? "null"),
		);
	return answer;
};

const schemas = new Map<string, z.ZodType>([
	[
		"/boundary-releases:resolve",
		resolveBoundary.responses[200].content["application/json"].schema,
	],
	[
		"/boundary-releases:compare",
		compareBoundary.responses[200].content["application/json"].schema,
	],
	[
		boundaries.path,
		boundaries.responses[200].content["application/json"].schema,
	],
	[
		boundaryReleases.path,
		boundaryReleases.responses[200].content["application/json"].schema,
	],
	[
		atlasRelease.path,
		atlasRelease.responses[200].content["application/json"].schema,
	],
	[
		documentation.path,
		documentation.responses[200].content["text/html"].schema,
	],
	[
		openapiDescription.path,
		openapiDescription.responses[200].content["application/yaml"].schema,
	],
	[datasets.path, datasets.responses[200].content["application/json"].schema],
	[measures.path, measures.responses[200].content["application/json"].schema],
]);
const detailSchemas = new Map<string, z.ZodType>([
	[
		"datasets",
		datasetDetail.responses[200].content["application/json"].schema,
	],
	[
		"measures",
		measureDetail.responses[200].content["application/json"].schema,
	],
]);

export const validateContractResponse = (
	segments: string[],
	answer: ApiResponse,
) => {
	if (segments[0] !== "v1") return answer;
	const schema =
		segments.length === 4 &&
		segments[1] === "boundary-releases" &&
		!(segments[3]!.endsWith(":join") && segments[3]!.length > 5)
			? boundaryReleaseDetail.responses[200].content["application/json"]
					.schema
			: segments.length === 2
				? schemas.get(`/${segments[1]}`)
				: segments.length === 3
					? detailSchemas.get(segments[1]!)
					: undefined;
	return schema ? validateResponse(schema, answer) : answer;
};
