import { describe, expect, it } from "vitest";
import { loadChildPoverty } from "@/lib/data/child-poverty/loader";

const worksheet = `
<table:table table:name="7_BHC_Relative_LA">
	<table:table-row><table:table-cell><text:p>Heading</text:p></table:table-cell></table:table-row>
	<table:table-row>
		<table:table-cell><text:p>Hartlepool</text:p></table:table-cell>
		<table:table-cell><text:p>E06000001</text:p></table:table-cell>
		<table:table-cell office:value="4538"><text:p>4,538</text:p></table:table-cell>
		<table:table-cell office:value="5215"><text:p>5,215</text:p></table:table-cell>
		<table:table-cell office:value="4994"><text:p>4,994</text:p></table:table-cell>
		<table:table-cell office:value="5041"><text:p>5,041</text:p></table:table-cell>
		<table:table-cell office:value="0.257665228"><text:p>25.8%</text:p></table:table-cell>
		<table:table-cell office:value="0.292944613"><text:p>29.3%</text:p></table:table-cell>
		<table:table-cell office:value="0.275197002"><text:p>27.5%</text:p></table:table-cell>
		<table:table-cell office:value="0.271839948"><text:p>27.2%</text:p></table:table-cell>
	</table:table-row>
</table:table>`;

describe("loadChildPoverty", () => {
	it("extracts annual local-authority counts and rates from the official ODS worksheet", () => {
		const datasets = loadChildPoverty(worksheet);

		expect(datasets[2022].data.E06000001.childCount).toBe(4538);
		expect(datasets[2025].data.E06000001.childPovertyRate).toBeCloseTo(
			27.1839948,
		);
		expect(datasets[2025].data.E06000001.childrenPopulation).toBeCloseTo(
			18544,
		);
		expect(datasets[2025]).toMatchObject({
			id: "childPoverty2025",
			type: "childPoverty",
			boundaryType: "localAuthority",
			boundaryYear: 2024,
		});
	});
});
