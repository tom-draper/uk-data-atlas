import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiResponse, RequestBody } from "../runtime/index.ts";
import type { ContractDispatch } from "./registerGetRoute";
import { boundTo } from "./routeBinding";
import { validateResponse } from "./validateResponse";

type PostRoute = {
	method: "post";
	path: string;
	responses: {
		200: {
			description: string;
			content: Record<string, { schema: z.ZodType }>;
		};
	};
	operationId: string;
	/** Replaces the default check that a 200 body parses as the declared schema. */
	validate?: (answer: ApiResponse) => ApiResponse;
};

/**
 * A POST route is answered by the production pipeline, which reads the body
 * under its own size limits and answers problems for a body it cannot read.
 * Fastify therefore leaves the body on the stream, whatever its type, and the
 * route runs only once the pipeline has read it.
 */
export const registerPostRoute = (
	app: FastifyInstance,
	route: PostRoute,
	handle: (
		request: FastifyRequest,
		body?: RequestBody,
	) => ApiResponse | Promise<ApiResponse>,
	dispatch?: ContractDispatch,
) => {
	const { method, path, responses, validate, ...metadata } = route;
	const [mediaType, media] = Object.entries(responses[200].content)[0]!;
	const check = (answer: ApiResponse) =>
		validate ? validate(answer) : validateResponse(media.schema, answer);
	app.removeAllContentTypeParsers();
	app.addContentTypeParser("*", (_request, _payload, done) => done(null));
	app.post(
		path,
		{
			config: boundTo(handle),
			schema: {
				...metadata,
				response: {
					200: {
						description: responses[200].description,
						content: {
							[mediaType]: {
								...media,
								schema: z.toJSONSchema(media.schema),
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			if (!dispatch)
				throw new Error(
					"A POST route is answered through the dispatcher",
				);
			return dispatch(request, reply, async (body) =>
				check(await handle(request, body)),
			);
		},
	);
};
