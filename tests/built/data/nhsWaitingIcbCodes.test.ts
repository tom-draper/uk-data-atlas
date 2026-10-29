import { readFileSync } from "node:fs";
import { ICB_ODS_TO_GSS } from "@uk-data-atlas/datasets/data/nhs-waiting/icbToGss";
import { expect, it } from "vitest";

it("maps every ICB in the compiled waiting-times dataset one to one", () => {
	const dataset = JSON.parse(
		readFileSync("data/build/datasets/nhs-waiting.json", "utf8"),
	) as Record<string, { data: Record<string, unknown> }>;
	const codes = Object.values(dataset).flatMap(({ data }) =>
		Object.keys(data),
	);
	const unmatched = [
		...new Set(codes.filter((code) => !ICB_ODS_TO_GSS[code])),
	];
	expect(unmatched).toEqual([]);
	expect(new Set(codes).size).toBe(42);
	expect(new Set(codes.map((code) => ICB_ODS_TO_GSS[code])).size).toBe(42);
	expect(ICB_ODS_TO_GSS.QSL).toBe("E54000038");
});
