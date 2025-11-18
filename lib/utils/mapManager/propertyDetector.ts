// lib/utils/mapManager/propertyDetector.ts
import { BoundaryGeojson } from '@lib/types';

const WARD_CODE_KEYS = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'];
const CONSTITUENCY_CODE_KEYS = ['PCON24CD', 'PCON25CD', 'pcon19cd', 'PCON17CD', 'PCON15CD'];

export class PropertyDetector {
    detectWardCode(geojson: BoundaryGeojson): string {
        return this.detectPropertyKey(geojson, WARD_CODE_KEYS);
    }

    detectConstituencyCode(geojson: BoundaryGeojson): string {
        return this.detectPropertyKey(geojson, CONSTITUENCY_CODE_KEYS);
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