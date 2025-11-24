// lib/utils/mapManager/propertyDetector.ts
import { CONSTITUENCY_CODE_KEYS, LAD_CODE_KEYS, WARD_CODE_KEYS } from '@/lib/data/boundaries/boundaries';
import { BoundaryGeojson } from '@lib/types';

export class PropertyDetector {
    detectWardCode(geojson: BoundaryGeojson): string {
        return this.detectPropertyKey(geojson, WARD_CODE_KEYS);
    }

    detectConstituencyCode(geojson: BoundaryGeojson): string {
        return this.detectPropertyKey(geojson, CONSTITUENCY_CODE_KEYS);
    }

    detectLocalAuthorityCode(geojson: BoundaryGeojson): string {
        return this.detectPropertyKey(geojson, LAD_CODE_KEYS);
    }

    private detectPropertyKey(geojson: BoundaryGeojson, possibleKeys: string[]): string {
        const firstFeature = geojson.features[0];
        if (!firstFeature) return possibleKeys[0];
        
        for (const key of possibleKeys) {
            if (key in firstFeature.properties) {
                return key;
            }
        }
        
        return possibleKeys[0];
    }
}