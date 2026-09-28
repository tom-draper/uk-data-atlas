// lib/types/areas.ts
import {
	LocalElectionWardData,
	GeneralElectionConstituencyData,
	LocalAuthorityData,
} from "./elections";

type LsoaAreaData = {
	lsoaCode?: string;
	lsoaName?: string;
	ladCode?: string;
	ladName?: string;
};

type AreaMap = {
	ward: LocalElectionWardData;
	constituency: GeneralElectionConstituencyData;
	localAuthority: LocalAuthorityData;
	lsoa: LsoaAreaData;
	dataZone: null;
	superOutputArea: null;
};

export type SelectedArea = {
	[K in keyof AreaMap]: {
		type: K;
		code: string;
		name: string;
		data: AreaMap[K] | null;
	};
}[keyof AreaMap];
