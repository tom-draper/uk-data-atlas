import { parseMeasureValuesQuery } from "./request";
import {
	defaultMeasureValuesService,
	type MeasureValuesService,
} from "./server";

/**
 * The route handler for `GET /data/measures/{measure}`, over any service so
 * the route's rules can be tested without a build on disk.
 *
 * The URL is not content addressed (the filters are open ended), so it can be
 * served for five minutes without asking and for a day while revalidating,
 * and every answer carries an ETag so a repeat request costs a 304. The data
 * only changes with a deploy.
 */
const SUCCESS_CACHE = "public, max-age=300, stale-while-revalidate=86400";
const MEASURE = /^[a-z0-9][a-z0-9-]{0,80}$/;

const json = (status: number, body: string, headers: HeadersInit = {}) =>
	new Response(body, {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			Vary: "Accept-Encoding",
			...headers,
		},
	});

const refusal = (status: number, code: string, detail: string) =>
	json(status, JSON.stringify({ error: { code, detail } }), {
		"Cache-Control": "no-store",
	});

type Context = { params: Promise<{ measure: string }> };

export const createMeasureValuesHandler =
	(service: () => MeasureValuesService) =>
	async (request: Request, { params }: Context): Promise<Response> => {
		const { measure } = await params;
		if (!MEASURE.test(measure))
			return refusal(404, "unknown_measure", "No such measure.");
		const parsed = parseMeasureValuesQuery(
			measure,
			new URL(request.url).searchParams,
		);
		if (!parsed.ok) return refusal(400, "invalid_query", parsed.detail);
		const answer = service().answer(parsed.request);
		if (!answer.etag)
			return json(answer.status, answer.body, {
				"Cache-Control": "no-store",
			});
		const headers = { "Cache-Control": SUCCESS_CACHE, ETag: answer.etag };
		const sent = request.headers.get("If-None-Match");
		if (
			sent
				?.split(",")
				.some(
					(tag) =>
						tag.trim().replace(/^W\//, "") ===
						answer.etag!.replace(/^W\//, ""),
				)
		)
			return new Response(null, { status: 304, headers });
		return json(answer.status, answer.body, headers);
	};

export const measureValuesHandler = createMeasureValuesHandler(
	defaultMeasureValuesService,
);
