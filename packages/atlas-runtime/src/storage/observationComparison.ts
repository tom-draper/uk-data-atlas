import { isDeepStrictEqual } from "node:util";

export const observationValuesEqual = (left: string, right: string) => {
	const parse = (text: string) =>
		JSON.parse(text, (key, value: unknown) =>
			key === "contentHash" ? undefined : value,
		);
	return isDeepStrictEqual(parse(left), parse(right));
};
