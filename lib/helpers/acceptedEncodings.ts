/** Whether the request's `Accept-Encoding` allows a content coding. */
export function acceptsEncoding(request: Request, coding: string): boolean {
	const qualities = new Map(
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
	return (qualities.get(coding) ?? qualities.get("*") ?? 0) > 0;
}
