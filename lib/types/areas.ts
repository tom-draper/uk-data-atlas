// lib/types/areas.ts
import {
	LocalElectionWardData,
	GeneralElectionConstituencyData,
	LocalAuthorityData,
} from "./elections";

type AreaMap = {
	ward: LocalElectionWardData;
	constituency: GeneralElectionConstituencyData;
	localAuthority: LocalAuthorityData;
	lsoa: null;
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
