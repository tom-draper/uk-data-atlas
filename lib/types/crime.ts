export interface CrimeRecord {
    localAuthorityCode: string;
    localAuthorityName: string;
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

export interface CrimeDataset {
    id: string;
    year: number;
    type: 'crime';
    boundaryType: 'localAuthority';
    boundaryYear: number;
    dataDate: string;
    jurisdiction: string; // 'England and Wales', 'England', 'Wales', etc.
    records: Record<string, CrimeRecord>;
    metadata: {
        source: string;
        notes: string[];
    };
}

export interface AggregatedCrimeData {
    averageRecordedCrime: number;
}