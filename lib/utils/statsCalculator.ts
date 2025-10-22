
// lib/utils/statsCalculator.ts
import { ChartData, LocationBounds, WardData } from '@lib/types';

export const calculateLocationStats = (
    location: LocationBounds,
    geoData: any,
    wardData: Record<string, WardData>
): ChartData => {
    const filteredFeatures = geoData.features.filter((f: any) =>
        location.lad_codes.includes(f.properties.LAD24CD)
    );

    const stats: ChartData = { LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 };

    filteredFeatures.forEach((feature: any) => {
        const wardCode = feature.properties.WD24CD;
        const data = wardData[wardCode];
        if (data) {
            stats.LAB += (data.LAB as number) || 0;
            stats.CON += (data.CON as number) || 0;
            stats.LD += (data.LD as number) || 0;
            stats.GREEN += (data.GREEN as number) || 0;
            stats.REF += (data.REF as number) || 0;
            stats.IND += (data.IND as number) || 0;
        }
    });

    return stats;
};

export const mapWard2023ToGeojson = (
    dataset2023: any,
    geoData2023: any
): { wardResults: Record<string, string>; wardData: Record<string, WardData> } => {
    const mappedWardData: Record<string, WardData> = {};
    const mappedWardResults: Record<string, string> = {};

    // Build lookup from 2023 GeoJSON: ward name -> ward code
    const wardNameToCode: Record<string, string> = {};

    geoData2023.features.forEach((feature: any) => {
        const wardCode = feature.properties.WD23CD || feature.properties.WD24CD; // Handle both 2023 and 2024 codes
        const wardName = (feature.properties.WD23NM || feature.properties.WD24NM || '').toLowerCase().trim();
        wardNameToCode[wardName] = wardCode;
    });

    console.log('2023 GeoJSON wards available:', Object.keys(wardNameToCode).length);

    let matched = 0;
    let unmatched: string[] = [];

    // Match 2023 CSV data to 2023 GeoJSON wards by ward name
    Object.entries(dataset2023.wardData).forEach(([nameKey, data]: [string, any]) => {
        const [county, district, ward] = nameKey.split('|');
        const normalizedWardName = ward.toLowerCase().trim();

        const wardCode = wardNameToCode[normalizedWardName];

        if (wardCode) {
            mappedWardData[wardCode] = { ...data };

            // Determine winning party
            let maxVotes = 0;
            let winningParty = 'OTHER';
            dataset2023.partyColumns.forEach((party: string) => {
                const votes = (data[party] as number) || 0;
                if (votes > maxVotes) {
                    maxVotes = votes;
                    winningParty = party;
                }
            });

            mappedWardResults[wardCode] = winningParty;
            matched++;
        } else {
            unmatched.push(normalizedWardName);
        }
    });

    console.log(`2023: Matched ${matched}/${Object.keys(dataset2023.wardData).length} wards`);
    if (unmatched.length > 0 && unmatched.length <= 10) {
        console.warn('2023: Unmatched ward names:', unmatched);
    } else if (unmatched.length > 10) {
        console.warn(`2023: ${unmatched.length} wards unmatched (first 5)`, unmatched.slice(0, 5));
    }

    return {
        wardResults: mappedWardResults,
        wardData: mappedWardData
    };
};
