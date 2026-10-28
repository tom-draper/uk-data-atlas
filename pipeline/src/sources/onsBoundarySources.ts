import type { GeographyKind } from "@uk-data-atlas/geography";

export type OnsBoundarySource = {
	geography: GeographyKind;
	release: string;
	itemId: string;
	service: string;
	title: string;
	count: number;
	contentHash: `sha256:${string}`;
	codeProperty: string;
	nameProperty: string;
	countries: string[];
};

export const ONS_BOUNDARY_SOURCES: OnsBoundarySource[] = [
	{
		geography: "seneddConstituency",
		release: "2026-05-w-bgc",
		itemId: "de9eae7b7f674e83875573e85bef7e0c",
		service: "SENC_MAY_2026_WA_BGC",
		title: "Senedd Cymru constituencies, May 2026 (Wales, generalised, clipped)",
		count: 16,
		contentHash:
			"sha256:7fe57bd2e79e127942a4fbd7e52d6f443f75f01fb1824f67d224772a540fac45",
		codeProperty: "SENC26CD",
		nameProperty: "SENC26NM",
		countries: ["GB-WLS"],
	},
	{
		geography: "msoa",
		release: "2001-12-ew-bgc-v2",
		itemId: "f2eab69e79af491688919db0bfbd6845",
		service:
			"Middle_Layer_Super_Output_Areas_Dec_2001_Boundaries_EW_BGC_2022",
		title: "Middle layer super output areas, December 2001 (England and Wales, generalised, clipped, version 2)",
		count: 7194,
		contentHash:
			"sha256:7671e79015a3782a7e6c30a5e1cc3279196f43b1be0be32b0b0e6f575b6a3e27",
		codeProperty: "MSOA01CD",
		nameProperty: "MSOA01NM",
		countries: ["GB-ENG", "GB-WLS"],
	},
	{
		geography: "msoa",
		release: "2011-12-ew-bgc-v3",
		itemId: "54bc14349a5543d7996e7a1e3565dd06",
		service: "MSOA_Dec_2011_Boundaries_Generalised_Clipped_BGC_EW_V3_2022",
		title: "Middle layer super output areas, December 2011 (England and Wales, generalised, clipped, version 3)",
		count: 7201,
		contentHash:
			"sha256:4ac6aeabe587de0be41cb0d42b9fb416f4a4cdad8c3207c1d945050c40cee099",
		codeProperty: "MSOA11CD",
		nameProperty: "MSOA11NM",
		countries: ["GB-ENG", "GB-WLS"],
	},
	{
		geography: "lsoa",
		release: "2001-12-ew-bgc-v2",
		itemId: "98b573a6f3ea483e97f7e08771624316",
		service: "Lower_Layer_Super_Output_Areas_Dec_2001_EW_BGC_2022",
		title: "Lower layer super output areas, December 2001 (England and Wales, generalised, clipped, version 2)",
		count: 34378,
		contentHash:
			"sha256:4a4fa7f7e413fbff7862a139343bd84f62cbabafa1cee441204bb1d49a66b5d3",
		codeProperty: "LSOA01CD",
		nameProperty: "LSOA01NM",
		countries: ["GB-ENG", "GB-WLS"],
	},
	{
		geography: "outputArea",
		release: "2001-12-ew-bgc",
		itemId: "6c949149484a430a8e4eb11e17421c86",
		service: "Output_Areas_Dec_2001_Boundaries_EW_BGC_2022",
		title: "Output areas, December 2001 (England and Wales, generalised, clipped)",
		count: 175434,
		contentHash:
			"sha256:409212376aa99c09b6bab881694fe21ab5d42544e3671240f71e524291291a3f",
		codeProperty: "OA01CD",
		nameProperty: "OA01CD",
		countries: ["GB-ENG", "GB-WLS"],
	},
	{
		geography: "outputArea",
		release: "2011-12-ew-bgc-v2",
		itemId: "8df53342abe043ab89534214206617ae",
		service: "Output_Areas_Dec_2011_Boundaries_EW_BGC_2022",
		title: "Output areas, December 2011 (England and Wales, generalised, clipped, version 2)",
		count: 181408,
		contentHash:
			"sha256:22f38816493f03d27a0faadf2930b7c8b85aa9770a68a33dd895c1e06a247b6c",
		codeProperty: "OA11CD",
		nameProperty: "OA11CD",
		countries: ["GB-ENG", "GB-WLS"],
	},
];
