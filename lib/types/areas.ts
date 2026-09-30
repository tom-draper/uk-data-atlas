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
		/**
		 * The boundary year of the map the area was picked from, so figures
		 * from other years can be found for the same area rather than for
		 * whatever carries its code.
		 */
		boundaryYear?: number;
	};
}[keyof AreaMap];
