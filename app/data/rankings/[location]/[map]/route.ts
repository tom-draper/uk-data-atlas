import {
	isLongRanking,
	rankingRow,
	resolveRanking,
	SERVER_ROWS,
} from "@/lib/atlas/rankingRows";

export const runtime = "nodejs";

/** The rows of a long ranking that its page leaves out until asked for. */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ location: string; map: string }> },
) {
	const resolved = await resolveRanking(await params);
	const { areas } = resolved;
	const from = isLongRanking(areas) ? SERVER_ROWS : areas.length;
	const rows = areas
		.slice(from)
		.map((area, index) => rankingRow(resolved, area, from + index));
	return Response.json(rows, {
		headers: { "Cache-Control": "public, max-age=3600" },
	});
}
