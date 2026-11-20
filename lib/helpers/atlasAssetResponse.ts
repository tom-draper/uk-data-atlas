import { gunzipSync } from "node:zlib";
import { readAtlasAsset, type AtlasAssetKind } from "@uk-data-atlas/atlas-db";

/**
 * Preserve the browser's existing URLs while serving SQLite rows. Next.js
 * strips `Content-Encoding` from route responses, so the stored gzip is
 * inflated here and compressed again by Next.js or the host.
 */
export async function atlasAssetResponse(
	request: Request,
	params: Promise<{ file: string }>,
	kind: AtlasAssetKind,
) {
	const { file } = await params;
	if (!/^[A-Za-z0-9-]+\.json$/.test(file))
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	const asset = readAtlasAsset(process.cwd(), kind, file.slice(0, -5));
	if (!asset)
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	// The suffix retires copies cached while the body was sent as gzip bytes
	// without their Content-Encoding header.
	const etag = `W/"${asset.sha256}-plain"`;
	const headers = new Headers({
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "public, max-age=0, must-revalidate",
		ETag: etag,
		Vary: "Accept-Encoding",
	});
	if (
		(request.headers.get("If-None-Match") ?? "")
			.split(",")
			.some((value) => {
				const tag = value.trim();
				return (
					tag === "*" ||
					tag.replace(/^W\//, "") === etag.replace(/^W\//, "")
				);
			})
	)
		return new Response(null, { status: 304, headers });
	const body = new Uint8Array(gunzipSync(asset.gzip));
	headers.set("Content-Length", String(body.byteLength));
	return new Response(body, { headers });
}
