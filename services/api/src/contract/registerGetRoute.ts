import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
	problem,
	unexpectedQueryParameter,
} from "@uk-data-atlas/atlas-runtime/api";
import type {
	ApiResponse,
	RouteContextFor,
} from "@uk-data-atlas/atlas-runtime/api";
import { httpResponse } from "../httpResponse";
import { sendFastifyResponse } from "../fastifyResponse";
import { validateResponse } from "./validateResponse";

type GetRoute = {
	method: "get";
	path: string;
	responses: {
		200: {
			description: string;
			content: Record<string, { schema: z.ZodType }>;
		};
	};
	operationId: string;
};

export type ContractDispatch = (
	request: FastifyRequest,
	reply: FastifyReply,
	handle: () => ApiResponse,
) => Promise<unknown>;

export const registerGetRoute = (
	app: FastifyInstance,
	context: RouteContextFor<never>,
	route: GetRoute,
	handle: (request: FastifyRequest) => ApiResponse,
	dispatch?: ContractDispatch,
) => {
	const { method, path, responses, ...metadata } = route;
	const [mediaType, media] = Object.entries(responses[200].content)[0]!;
	app.get(
		path,
		{
			exposeHeadRoute: true,
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
			if (dispatch)
				return dispatch(request, reply, () =>
					validateResponse(media.schema, handle(request)),
				);
			const url = new URL(request.url, "http://localhost");
			const unexpected = unexpectedQueryParameter(
				context.operationMatcher?.(url.pathname).operation,
				request.method,
				request.url,
			);
			const response = httpResponse(request.raw, () => {
				if (unexpected)
					return problem(
						400,
						"Unknown Query Parameter",
						`This operation does not accept the query parameter ${unexpected.parameter}.`,
						{ code: "unknown_query_parameter", ...unexpected },
					);
				return validateResponse(media.schema, handle(request));
			});
			return sendFastifyResponse(reply, response);
		},
	);
};
