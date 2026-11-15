import { expect, it } from "vitest";
import { directDigest } from "../../src/statistics/directDigest.ts";

const part = (value: number) => [
	{
		key: "2024",
		records: [{ code: "E01000001", values: [{ measure: "m", value }] }],
	},
];

it("hashes the parts as read, so a changed value changes the entry", () => {
	expect(directDigest(part(1))).toEqual(directDigest(part(1)));
	expect(directDigest(part(1)).sha256).not.toBe(directDigest(part(2)).sha256);
	expect(directDigest(part(1)).bytes).toBe(
		Buffer.byteLength(JSON.stringify(part(1))),
	);
});
