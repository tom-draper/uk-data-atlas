import { describe, expect, it } from "vitest";
import { loadHousePrice } from "@/lib/data/house-price/loader";

const csv = (rows: string[]) =>
	[
		"Median price paid by ward",
		"Local authority code,Local authority name,Ward code,Ward name,Year ending Dec 2021,Year ending Dec 2022",
		...rows,
	].join("\n");

const read = async () =>
	csv([
		"E08000006,Salford,E05000759,Barton,170000,179500",
		"E06000001,Hartlepool,E05008945,Foggy Furze,90000,95000",
	]);

describe("loadHousePrice", () => {
	it("keeps the publisher's code on a ward it moves for the map", async () => {
		const data = (await loadHousePrice(read))[2023].data;

		// Salford's redrawn ward joins the map under its 2021 code, but the old
		// code the price was published against stays on the record.
		expect(data.E05013018).toMatchObject({
			wardCode: "E05013018",
			sourceWardCode: "E05000759",
		});
		expect(data.E05013018.prices[2022]).toBe(179500);
	});

	it("adds no source code where the ward was not moved", async () => {
		const data = (await loadHousePrice(read))[2023].data;
		expect(data.E05008945).not.toHaveProperty("sourceWardCode");
	});
});
