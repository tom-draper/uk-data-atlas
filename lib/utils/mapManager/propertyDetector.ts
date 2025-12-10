// lib/utils/mapManager/propertyDetector.ts
import { CONSTITUENCY_CODE_KEYS, LAD_CODE_KEYS, WARD_CODE_KEYS } from '@/lib/data/boundaries/boundaries';
import { BoundaryGeojson, PropertyKeys } from '@lib/types';

export class PropertyDetector {
    detectWardCode(features: BoundaryGeojson['features']) {
        return this.detectPropertyKey(features, WARD_CODE_KEYS);
    }

    detectConstituencyCode(features: BoundaryGeojson['features']) {
        return this.detectPropertyKey(features, CONSTITUENCY_CODE_KEYS);
    }

    detectLocalAuthorityCode(features: BoundaryGeojson['features']) {
        return this.detectPropertyKey(features, LAD_CODE_KEYS);
    }

    private detectPropertyKey(features: BoundaryGeojson['features'], possibleKeys: readonly PropertyKeys[]) {
        const firstFeature = features[0];
        if (!firstFeature) return possibleKeys[0];
        
        for (const key of possibleKeys) {
            if (key in firstFeature.properties) {
                return key;
            }
        }
        
        return possibleKeys[0];
    }
}