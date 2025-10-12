
// lib/utils/statsCalculator.ts
import { ChartData, LocationBounds, WardData } from '@lib//types';

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