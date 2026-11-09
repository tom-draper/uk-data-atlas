import { isDeepStrictEqual } from "node:util";

export const observationValuesEqual = (left: string, right: string) => {
	const parse = (text: string) =>
		JSON.parse(text, (key, value: unknown) => {
			if (key === "contentHash") return undefined;
			if (
				(key === "periods" || key === "records") &&
				Array.isArray(value)
			) {
				const keys = value.map((item: unknown) => {
					if (Array.isArray(item)) return item[0];
					if (typeof item !== "object" || item === null)
						return undefined;
					return key === "periods" && "period" in item
						? item.period
						: "areaCode" in item
							? item.areaCode
							: undefined;
				});
				if (keys.every((item) => typeof item === "string"))
					return value
						.map((item: unknown, index: number) => ({
							item,
							key: keys[index] as string,
						}))
						.sort((left, right) =>
							left.key.localeCompare(right.key),
						)
						.map(({ item }) => item);
			}
			return value;
		});
	return isDeepStrictEqual(parse(left), parse(right));
};
