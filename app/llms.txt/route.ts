import { buildLlmsTxt } from "@/lib/docs/llms";
import { loadApiContract } from "@/lib/docs/openapi";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
	return new Response(buildLlmsTxt(loadApiContract(), SITE_URL), {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}
