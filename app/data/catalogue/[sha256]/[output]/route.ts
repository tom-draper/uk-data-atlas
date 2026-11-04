import { acceptsEncoding } from "@/lib/helpers/acceptedEncodings";
import { promisify } from "node:util";
import { gzip as gzipCallback } from "node:zlib";
import { readVersionedAtlasDataset } from "@uk-data-atlas/atlas-runtime/storage";

export const runtime = "nodejs";

const compress = promisify(gzipCallback);

type Context = { params: Promise<{ sha256: string; output: string }> };

export async function GET(request: Request, { params }: Context) {
	const { sha256, output } = await params;
	if (!/^[a-f0-9]{64}$/.test(sha256) || !/^[a-z0-9-]+\.json$/.test(output))
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	const payload = readVersionedAtlasDataset(
		process.cwd(),
		output.slice(0, -5),
		sha256,
	);
	if (payload === undefined)
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	const gzip = acceptsEncoding(request, "gzip");
	const body = gzip ? new Uint8Array(await compress(payload)) : payload;
	return new Response(body, {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Length": String(
				typeof body === "string"
					? Buffer.byteLength(body)
					: body.byteLength,
			),
			"Cache-Control": "public, max-age=31536000, immutable",
			...(gzip ? { "Content-Encoding": "gzip" } : {}),
			ETag: `W/"${sha256}"`,
			Vary: "Accept-Encoding",
		},
	});
}
