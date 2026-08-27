import { describe, expect, it } from "vitest";
import { loadHomelessness } from "@/lib/data/homelessness/loader";

const worksheet = `
<table:table table:name="TA1">
	<table:table-row>
		<table:table-cell office:value-type="string"><text:p>E06000001</text:p></table:table-cell>
		<table:table-cell office:value-type="string"><text:p>Hartlepool</text:p></table:table-cell>
		<table:table-cell office:value="310"><text:p>310</text:p></table:table-cell>
		<table:table-cell office:value="42"><text:p>42</text:p></table:table-cell>
		<table:table-cell office:value="7.4"><text:p>7.4</text:p></table:table-cell>
		<table:table-cell office:value="180"><text:p>180</text:p></table:table-cell>
		<table:table-cell office:value="430"><text:p>430</text:p></table:table-cell>
	</table:table-row>
	<table:table-row>
		<table:table-cell office:value-type="string"><text:p>E92000001</text:p></table:table-cell>
		<table:table-cell office:value-type="string"><text:p>ENGLAND</text:p></table:table-cell>
	</table:table-row>
</table:table>`;

describe("loadHomelessness", () => {
	it("extracts TA1 local-authority temporary accommodation data", () => {
		const dataset = loadHomelessness(worksheet)[2026];
		expect(dataset).toMatchObject({
			id: "homelessness2026q1",
			type: "homelessness",
			quarter: "Jan-Mar 2026",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
		});
		expect(dataset.data.E06000001).toEqual({
			ladCode: "E06000001",
			ladName: "Hartlepool",
			householdsInTemporaryAccommodation: 310,
			householdsPerThousand: 7.4,
			householdsWithChildren: 180,
			childrenInTemporaryAccommodation: 430,
		});
		expect(dataset.data.E92000001).toBeUndefined();
	});
});
