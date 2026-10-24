import { atlasAssetResponse } from "@/lib/helpers/atlasAssetResponse";

export const runtime = "nodejs";

export function GET(
	request: Request,
	{ params }: { params: Promise<{ file: string }> },
) {
	return atlasAssetResponse(request, params, "pages");
}
