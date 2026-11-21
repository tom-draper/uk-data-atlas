import { gunzipSync } from "node:zlib";
import {
	readStoredAtlasDataset,
	readVersionedAtlasDataset,
} from "@uk-data-atlas/catalogue/node";
import { parsePayloadKeys, pickPayloadEntries } from "@/lib/data/payloadKeys";

export const runtime = "nodejs";

type Context = { params: Promise<{ sha256: string; output: string }> };

// Recent trimmed payloads, so a popular slice is parsed once per process.
const TRIMMED_LIMIT = 64;
const trimmed = new Map<string, string>();

function cachedTrim(cacheKey: string) {
	const body = trimmed.get(cacheKey);
	if (body !== undefined) {
		trimmed.delete(cacheKey);
		trimmed.set(cacheKey, body);
	}
	return body;
}

function storeTrim(cacheKey: string, body: string) {
	trimmed.set(cacheKey, body);
	if (trimmed.size > TRIMMED_LIMIT)
		trimmed.delete(trimmed.keys().next().value!);
}

// Next.js strips `Content-Encoding` from route responses, so stored gzip is
// inflated here and compressed again by Next.js or the host.
function readPayload(
	name: string,
	sha256: string,
): Uint8Array<ArrayBuffer> | string | undefined {
	const stored = readStoredAtlasDataset(process.cwd(), name, sha256);
	if (stored) return new Uint8Array(gunzipSync(stored.gzip));
	return readVersionedAtlasDataset(process.cwd(), name, sha256);
}

function trimPayload(
	name: string,
	sha256: string,
	keys: string[],
): string | undefined {
	const cacheKey = `${name}:${sha256}:${keys.join(",")}`;
	const cached = cachedTrim(cacheKey);
	if (cached !== undefined) return cached;
	const payload = readPayload(name, sha256);
	if (payload === undefined) return undefined;
	const json =
		typeof payload === "string"
			? payload
			: Buffer.from(payload).toString("utf8");
	const body = JSON.stringify(pickPayloadEntries(JSON.parse(json), keys));
	storeTrim(cacheKey, body);
	return body;
}

const notFound = () =>
	new Response(null, {
		status: 404,
		headers: { "Cache-Control": "no-store" },
	});

/**
 * One catalogue payload. `?keys=2024,le` returns only those top-level entries,
 * so a card reading one year does not download every year (see
 * `lib/data/payloadKeys.ts`).
 */
export async function GET(request: Request, { params }: Context) {
	const { sha256, output } = await params;
	if (!/^[a-f0-9]{64}$/.test(sha256) || !/^[a-z0-9-]+\.json$/.test(output))
		return notFound();
	const name = output.slice(0, -5);
	const keysParam = new URL(request.url).searchParams.get("keys");
	const keys = parsePayloadKeys(keysParam);
	if (keysParam !== null && keys === null) return notFound();
	const body = keys
		? trimPayload(name, sha256, keys)
		: readPayload(name, sha256);
	if (body === undefined) return notFound();
	// The ETag names the JSON, so it is the same in every encoding.
	const variant = keys ? `${sha256}:${keys.join(",")}` : sha256;
	return new Response(body, {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=31536000, immutable",
			ETag: `W/"${variant}"`,
			Vary: "Accept-Encoding",
			"Content-Length": String(
				typeof body === "string"
					? Buffer.byteLength(body)
					: body.length,
			),
		},
	});
}
