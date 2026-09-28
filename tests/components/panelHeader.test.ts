import { describe, expect, it } from "vitest";
import { panelHeaderDetails } from "@/components/PanelHeader";
import type { SelectedArea } from "@/lib/types";

describe("panelHeaderDetails", () => {
	it("shows a ward's name, authority, and hierarchical codes", () => {
		const selectedArea: SelectedArea = {
			type: "ward",
			code: "E05014827",
			name: "Bolton E00000001",
			data: {
				ladCode: "E08000001",
				ladName: "Bolton",
				wardCode: "E05014827",
				wardName: "Bradshaw",
				totalVotes: 0,
				turnoutPercent: 0,
				electorate: 0,
				partyVotes: {},
			},
		};

		expect(panelHeaderDetails(null, selectedArea)).toEqual({
			title: "Bradshaw",
			subtitle: "Bolton",
			code: "E08000001 E05014827",
		});
	});

	it("uses the dataset name rather than a boundary label", () => {
		const selectedArea: SelectedArea = {
			type: "constituency",
			code: "E14001234",
			name: "North West",
			data: {
				constituencyName: "Bolton North East",
				onsId: "E14001234",
				regionName: "North West",
				countryName: "England",
				constituencyType: "County",
				memberFirstName: "",
				memberSurname: "",
				memberGender: "",
				result: "",
				firstParty: "",
				secondParty: "",
				electorate: 0,
				validVotes: 0,
				invalidVotes: 0,
				majority: 0,
				partyVotes: {},
				turnoutPercent: 0,
			},
		};

		expect(panelHeaderDetails(null, selectedArea)).toEqual({
			title: "Bolton North East",
			subtitle: "North West, England",
			code: "E14001234",
		});
	});

	it("shows an available referendum reporting-region code", () => {
		const selectedArea: SelectedArea = {
			type: "localAuthority",
			code: "E08000001",
			name: "Bolton",
			data: {
				ladCode: "E08000001",
				ladName: "Bolton",
				regionName: "North West",
				regionCode: "E12000002",
				countryName: "",
			},
		};

		expect(panelHeaderDetails(null, selectedArea)).toEqual({
			title: "Bolton",
			subtitle: "North West",
			code: "E12000002 E08000001",
		});
	});

	it("finds an English local authority's ONS region when a dataset omits it", () => {
		const selectedArea: SelectedArea = {
			type: "localAuthority",
			code: "E08000001",
			name: "Bolton",
			data: {
				ladCode: "E08000001",
				ladName: "Bolton",
				regionName: "",
				countryName: "England",
			},
		};

		expect(panelHeaderDetails(null, selectedArea)).toEqual({
			title: "Bolton",
			subtitle: "North West, England",
			code: "E12000002 E08000001",
		});
	});

	it("does not show a redundant geography label for an LSOA", () => {
		const selectedArea: SelectedArea = {
			type: "lsoa",
			code: "E01000001",
			name: "Bolton 001A",
			data: null,
		};

		expect(panelHeaderDetails(null, selectedArea)).toEqual({
			title: "Bolton 001A",
			subtitle: "",
			code: "E01000001",
		});
	});
});
