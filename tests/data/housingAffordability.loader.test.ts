import { describe, expect, it } from "vitest";
import {
	housingAffordability,
	type DatasetReader,
} from "@uk-data-atlas/datasets";

const sheet = `Title
Country code,Country name,Local authority code,Local authority name,2024,2025
E12000001,North East,E06000001,Hartlepool,4.05,4.55
E12000007,London,E09000001,City of London,[x],[x]
W92000004,Wales,W06000024,Merthyr Tydfil,4.52,4.4
`;
const read = (text: string) =>
	housingAffordability.statistics.direct!.read({
		xlsxSheet: async (_path: string, name: string) => {
			expect(name).toBe("5c");
			return text;
		},
	} as DatasetReader);

describe("housing affordability source reader", () => {
	it("reads the 2025 ratios and omits suppressed values", async () => {
		const [part] = await read(sheet);
		expect(part.key).toBe("2025");
		expect(part.records).toEqual([
			{
				code: "E06000001",
				name: "Hartlepool",
				values: [
					{ measure: "house-price-to-earnings-ratio", value: 4.55 },
				],
			},
			{
				code: "W06000024",
				name: "Merthyr Tydfil",
				values: [
					{ measure: "house-price-to-earnings-ratio", value: 4.4 },
				],
			},
		]);
	});
	it("fails when the 2025 column is missing", async () => {
		await expect(read(sheet.replace(",2025\n", ",2026\n"))).rejects.toThrow(
			/no 2025 local authority column/,
		);
	});
});
