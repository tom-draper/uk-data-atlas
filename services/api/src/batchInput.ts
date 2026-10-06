import { problem, type ApiResponse } from "./routeResponse";
import type { RequestBody } from "./routing";

const mediaType = (contentType: string) =>
	contentType.split(";", 1)[0]!.trim().toLowerCase();

/** Read one named array of strings from a JSON batch request body. */
export const readBatchInput = (
	body: RequestBody | undefined,
	field: string,
): string[] | ApiResponse => {
	if (mediaType(body?.contentType ?? "") !== "application/json")
		return problem(
			415,
			"Unsupported Media Type",
			"Send the batch input as application/json.",
		);
	let parsed: unknown;
	try {
		parsed = JSON.parse(body?.text ?? "");
	} catch {
		return problem(400, "Invalid Body", "The body is not valid JSON.");
	}
	const values =
		typeof parsed === "object" && parsed !== null
			? (parsed as Record<string, unknown>)[field]
			: undefined;
	if (
		!Array.isArray(values) ||
		!values.every((value) => typeof value === "string")
	)
		return problem(
			400,
			"Invalid Body",
			`Send ${JSON.stringify({ [field]: ["…"] })}; ${field} must be an array of strings.`,
		);
	return values;
};
