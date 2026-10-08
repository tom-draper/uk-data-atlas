import { invalidQuery, type ApiResponse } from "./routeResponse";

/**
 * The one parameter every data route takes for where: `place`.
 *
 * It is an area code as published, or a place reference as `/v1/places`
 * returns one: `{geography}/{code}` for an area, `location/{id}` for a
 * curated named location. A reference that names a geography must agree with
 * any `geography` given beside it. A postcode is answered by
 * `/data/{measure}/value`, which finds the area it lies in.
 */
export type PlaceParameter =
	| { kind: "area"; code: string; geography?: string }
	| { kind: "location"; id: string };

const LOCATION_REFERENCE = "location/";
const POSTCODE_REFERENCE = "postcode/";

export const parsePlaceParameter = (
	searchParams: URLSearchParams,
	measureId: string,
	/**
	 * Whether `geography` is the place's own. Aggregation sums members of
	 * another geography, so there the two need not agree.
	 */
	geographyIsThePlaces = true,
): PlaceParameter | ApiResponse | undefined => {
	const text = searchParams.get("place")?.trim();
	if (text === undefined) return undefined;
	if (text === "")
		return invalidQuery(
			"place is empty. Give an area code, or a place reference from /v1/places such as localAuthority/E08000035 or location/north-wales.",
		);
	if (text.startsWith(LOCATION_REFERENCE)) {
		const id = text.slice(LOCATION_REFERENCE.length);
		return id
			? { kind: "location", id }
			: invalidQuery("location/ names no location.");
	}
	if (text.startsWith(POSTCODE_REFERENCE))
		return invalidQuery(
			`A postcode is answered by /v1/data/${measureId}/value?place=${encodeURIComponent(text)}, which finds the area it lies in.`,
		);
	const [first, second, ...rest] = text.split("/");
	if (rest.length > 0 || first === "")
		return invalidQuery(
			`place ${JSON.stringify(text)} is neither an area code nor a place reference such as localAuthority/E08000035.`,
		);
	if (second === undefined) return { kind: "area", code: first! };
	const geography = searchParams.get("geography");
	if (geographyIsThePlaces && geography !== null && geography !== first)
		return invalidQuery(
			`place names a ${first} but geography is ${geography}. Give one or the other, or make them agree.`,
		);
	return { kind: "area", code: second, geography: first };
};

/**
 * The geography a request is about: the one given, or else the one its
 * place reference names.
 */
export const requestedGeography = (
	searchParams: URLSearchParams,
	place: PlaceParameter | undefined,
) =>
	searchParams.get("geography") ??
	(place?.kind === "area" ? (place.geography ?? null) : null);
