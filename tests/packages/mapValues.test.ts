import { describe, expect, it } from "vitest";
import { featureIds } from "@uk-data-atlas/map-tiles/featureIds";
import {
	MapValuesMismatchError,
	codeListId,
	encodeMapValues,
	mapValuesKey,
	orderValues,
	parseMapValuesManifest,
	readMapValues,
	releaseCodeList,
	type MapValuesEntry,
} from "@uk-data-atlas/map-tiles/mapValues";

const entryFor = (
	codeList: readonly string[],
	values: readonly (number | null)[],
): MapValuesEntry => ({
	file: "x.json",
	bytes: encodeMapValues(values).length,
	sha256: "",
	codeList: codeListId(codeList),
	valueCount: values.filter((value) => value !== null).length,
});

describe("map values", () => {
	it("orders the code list the way tile feature ids number it", () => {
		const codes = ["E06000003", "E06000001", "E06000002"];
		const list = releaseCodeList(codes);
		expect(list).toEqual(["E06000001", "E06000002", "E06000003"]);
		const ids = featureIds(codes);
		list.forEach((code, index) => expect(ids.get(code)).toBe(index + 1));
	});

	it("refuses a code list with a repeated code", () => {
		expect(() => releaseCodeList(["A", "B", "A"])).toThrow(
			MapValuesMismatchError,
		);
	});

	it("puts each area's value at its feature id minus one", () => {
		const list = releaseCodeList(["B", "C", "A"]);
		const values = orderValues(
			list,
			(code) => ({ A: 1, B: 2, C: 3 })[code],
		);
		expect(values).toEqual([1, 2, 3]);
		const ids = featureIds(list);
		expect(values[(ids.get("B") ?? 0) - 1]).toBe(2);
	});

	it("keeps missing and non-finite values as null", () => {
		const list = ["A", "B", "C", "D"];
		const record: Record<string, unknown> = {
			A: 0,
			B: "12",
			C: Number.NaN,
		};
		expect(orderValues(list, (code) => record[code])).toEqual([
			0,
			null,
			null,
			null,
		]);
	});

	it("round trips an array with nulls", () => {
		const list = ["A", "B", "C"];
		const values = [1.5, null, 0];
		const read = readMapValues(
			encodeMapValues(values),
			entryFor(list, values),
			codeListId(list),
		);
		expect(read).toEqual(values);
	});

	it("rejects an array made for another code list", () => {
		const made = ["A", "B", "C"];
		const values = [1, 2, 3];
		const reordered = ["A", "C", "B"];
		expect(() =>
			readMapValues(
				encodeMapValues(values),
				entryFor(made, values),
				codeListId(reordered),
			),
		).toThrow(MapValuesMismatchError);
		expect(() =>
			readMapValues(
				encodeMapValues(values),
				entryFor(made, values),
				codeListId([...made, "D"]),
			),
		).toThrow(/code list/);
	});

	it("rejects an array of the wrong length or with a bad entry", () => {
		const list = ["A", "B"];
		const id = codeListId(list);
		const entry = entryFor(list, [1, 2]);
		expect(() => readMapValues("[1]", entry, id)).toThrow(
			MapValuesMismatchError,
		);
		expect(() => readMapValues('{"a":1}', entry, id)).toThrow(
			MapValuesMismatchError,
		);
		expect(() => readMapValues('[1,"2"]', entry, id)).toThrow(
			MapValuesMismatchError,
		);
	});

	it("gives different code lists different versions", () => {
		expect(codeListId(["A", "B"]).version).not.toBe(
			codeListId(["B", "A"]).version,
		);
		expect(codeListId(["A", "B"])).toEqual(codeListId(["A", "B"]));
	});

	it("rejects a manifest from another schema", () => {
		expect(() => parseMapValuesManifest({ schemaVersion: 9 })).toThrow(
			MapValuesMismatchError,
		);
		expect(
			parseMapValuesManifest({ schemaVersion: 1, entries: {} }).entries,
		).toEqual({});
		expect(mapValuesKey("council-tax", "lad-2026", 2025)).toBe(
			"council-tax/lad-2026/2025",
		);
	});
});
