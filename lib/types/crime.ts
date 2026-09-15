export interface CrimeLADData {
	ladCode: string;
	ladName: string;
	policeForceAreaCode?: string;
	policeForceAreaName?: string;
	communitySafetyPartnershipCode?: string;
	communitySafetyPartnershipName?: string;
	totalRecordedCrime: number;
	violenceAgainstPerson: number;
	homicide: number;
	deathSeriesInjuryUnlawfulDriving: number;
	violenceWithInjury: number;
	violenceWithoutInjury: number;
	stalkingHarassment: number;
	sexualOffences: number;
	robbery: number;
	theftOffences: number;
	burglary: number;
	residentialBurglary: number;
	nonResidentialBurglary: number;
	vehicleOffences: number;
	theftFromPerson: number;
	bicycleTheft: number;
	shoplifting: number;
	otherTheftOffences: number;
	criminalDamageArson: number;
	drugOffences: number;
	possessionWeapons: number;
	publicOrderOffences: number;
	miscellaneousCrimes: number;
}

/** The offence counts every crime record carries, whatever area it is for. */
export type CrimeCounts = Pick<
	CrimeLADData,
	| "totalRecordedCrime"
	| "violenceAgainstPerson"
	| "homicide"
	| "deathSeriesInjuryUnlawfulDriving"
	| "violenceWithInjury"
	| "violenceWithoutInjury"
	| "stalkingHarassment"
	| "sexualOffences"
	| "robbery"
	| "theftOffences"
	| "burglary"
	| "residentialBurglary"
	| "nonResidentialBurglary"
	| "vehicleOffences"
	| "theftFromPerson"
	| "bicycleTheft"
	| "shoplifting"
	| "otherTheftOffences"
	| "criminalDamageArson"
	| "drugOffences"
	| "possessionWeapons"
	| "publicOrderOffences"
	| "miscellaneousCrimes"
>;

/**
 * One community safety partnership, the unit the table is published for.
 * A partnership covering several authorities has no single authority code.
 */
export interface CrimePartnershipData extends CrimeCounts {
	communitySafetyPartnershipCode: string;
	communitySafetyPartnershipName: string;
	policeForceAreaCode: string;
	policeForceAreaName: string;
	localAuthorityCode: string | null;
	localAuthorityName: string | null;
}

export interface CrimeDataset {
	id: string;
	year: number;
	type: "crime";
	boundaryType: "localAuthority";
	boundaryYear: number;
	dataDate: string;
	jurisdiction: string;
	/**
	 * By local authority, for authorities whose crime the table fully
	 * attributes: one partnership, or several partnerships summed.
	 */
	data: Record<string, CrimeLADData>;
	/** Every partnership in the table, keyed by partnership code. */
	partnerships: Record<string, CrimePartnershipData>;
	metadata: {
		source: string;
		notes: string[];
	};
}

export interface AggregatedCrimeData {
	averageRecordedCrime: number;
}
