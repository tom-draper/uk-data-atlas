import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem, unexpectedQueryParameter } from "../runtime/index.ts";
import type {
	ApiResponse,
	RequestBody,
	RouteContextFor,
} from "../runtime/index.ts";
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
	/**
	 * Replaces the default check that a 200 body parses as the declared schema,
	 * for bodies served as stored bytes that are too large to parse per request.
	 */
	validate?: (answer: ApiResponse) => ApiResponse;
};

/**
 * Hands a request to the production pipeline, which applies its limits, reads
 * a POST body, and then asks `handle` for the answer. A POST route's `handle`
 * is given the body the pipeline read.
 */
export type ContractDispatch = (
	request: FastifyRequest,
	reply: FastifyReply,
	handle: (body?: RequestBody) => ApiResponse | Promise<ApiResponse>,
) => Promise<unknown>;

export const registerGetRoute = (
	app: FastifyInstance,
	context: RouteContextFor<never>,
	route: GetRoute,
	handle: (request: FastifyRequest) => ApiResponse | Promise<ApiResponse>,
	dispatch?: ContractDispatch,
) => {
	const { method, path, responses, validate, ...metadata } = route;
	const [mediaType, media] = Object.entries(responses[200].content)[0]!;
	const check = (answer: ApiResponse) =>
		validate ? validate(answer) : validateResponse(media.schema, answer);
	const answerNow = (request: FastifyRequest) => {
		const answer = handle(request);
		if (answer instanceof Promise)
			throw new Error(
				"An asynchronous route is answered through the dispatcher",
			);
		return answer;
	};
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
				return dispatch(request, reply, async () =>
					check(await handle(request)),
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
				return check(answerNow(request));
			});
			return sendFastifyResponse(reply, response);
		},
	);
};
