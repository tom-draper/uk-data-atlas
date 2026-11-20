import { gunzipSync } from "node:zlib";
import {
	readStoredAtlasDataset,
	readVersionedAtlasDataset,
} from "@uk-data-atlas/catalogue/node";

export const runtime = "nodejs";

type Context = { params: Promise<{ sha256: string; output: string }> };

const notFound = () =>
	new Response(null, {
		status: 404,
		headers: { "Cache-Control": "no-store" },
	});

export async function GET(request: Request, { params }: Context) {
	const { sha256, output } = await params;
	if (!/^[a-f0-9]{64}$/.test(sha256) || !/^[a-z0-9-]+\.json$/.test(output))
		return notFound();
	const name = output.slice(0, -5);
	// The ETag names the JSON, so it is the same in every encoding.
	const headers = new Headers({
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "public, max-age=31536000, immutable",
		ETag: `W/"${sha256}"`,
		Vary: "Accept-Encoding",
	});
	const stored = readStoredAtlasDataset(process.cwd(), name, sha256);
	// Next.js strips `Content-Encoding` from route responses, so stored gzip
	// is inflated here and compressed again by Next.js or the host.
	let body: Uint8Array<ArrayBuffer> | string;
	if (stored) body = new Uint8Array(gunzipSync(stored.gzip));
	else {
		const payload = readVersionedAtlasDataset(process.cwd(), name, sha256);
		if (payload === undefined) return notFound();
		body = payload;
	}
	headers.set(
		"Content-Length",
		String(
			typeof body === "string" ? Buffer.byteLength(body) : body.length,
		),
	);
	return new Response(body, { headers });
}
