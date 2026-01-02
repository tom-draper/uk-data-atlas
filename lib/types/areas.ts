// lib/types/areas.ts
import { WardData, ConstituencyData, LocalAuthorityData } from "./elections";

type AreaMap = {
    ward: WardData;
    constituency: ConstituencyData;
    localAuthority: LocalAuthorityData;
};

export type SelectedArea = {
    [K in keyof AreaMap]: {
        type: K;
        code: string;
        name: string;
        data: AreaMap[K];
    };
}[keyof AreaMap];
