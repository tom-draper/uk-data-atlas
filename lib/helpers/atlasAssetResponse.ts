import { gunzipSync } from "node:zlib";
import {
	readAtlasAsset,
	type AtlasAssetKind,
} from "@uk-data-atlas/atlas-runtime/storage";

/** Preserve the browser's existing URLs while serving precompressed SQLite rows. */
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
	const etag = `W/"${asset.sha256}"`;
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
	const encodings = new Map(
		(request.headers.get("Accept-Encoding") ?? "")
			.split(",")
			.map((entry) => {
				const [name, ...parameters] = entry
					.trim()
					.toLowerCase()
					.split(";");
				const quality = parameters.find((parameter) =>
					parameter.trim().startsWith("q="),
				);
				return [
					name,
					quality ? Number(quality.trim().slice(2)) : 1,
				] as const;
			}),
	);
	const gzip = (encodings.get("gzip") ?? encodings.get("*") ?? 0) > 0;
	const body = new Uint8Array(gzip ? asset.gzip : gunzipSync(asset.gzip));
	if (gzip) headers.set("Content-Encoding", "gzip");
	headers.set("Content-Length", String(body.byteLength));
	return new Response(body, { headers });
}
