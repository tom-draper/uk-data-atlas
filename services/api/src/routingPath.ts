/**
 * Where a request line is routed. The API reads a path the way a URL parser
 * does: dot segments resolve, repeated and trailing slashes do not matter, and
 * a segment is decoded only once a route has matched it. The router matches
 * this normal form, while handlers still see the request line as sent.
 */

/** Matches no route, so a path that cannot be read is answered as one nothing owns. */
export const UNROUTABLE_PATH = "/\0";

const decodes = (segment: string) => {
	try {
		decodeURIComponent(segment);
		return true;
	} catch {
		return false;
	}
};

export const routingUrl = (target: string): string => {
	const queryAt = target.indexOf("?");
	const query = queryAt < 0 ? "" : target.slice(queryAt);
	let pathname: string;
	try {
		pathname = new URL(
			queryAt < 0 ? target : target.slice(0, queryAt),
			"http://localhost",
		).pathname;
	} catch {
		return UNROUTABLE_PATH + query;
	}
	const segments = pathname.split("/").filter(Boolean);
	if (!segments.every(decodes)) return UNROUTABLE_PATH + query;
	return `/${segments.join("/")}${query}`;
};
