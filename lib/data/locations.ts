// lib/data/locations.ts
import { LocationBounds } from '@/lib/types/index';

export const LOCATIONS: LocationBounds[] = [
    {
        name: 'Greater Manchester',
        lad_codes: ['E08000001', 'E08000002', 'E08000003', 'E08000004', 'E08000005', 'E08000006', 'E08000007', 'E08000008', 'E08000009', 'E08000010'],
        bounds: [-2.5, 53.3, -2.0, 53.7]
    },
    {
        name: 'London',
        lad_codes: ['E09000001', 'E09000002', 'E09000003', 'E09000004', 'E09000005', 'E09000006', 'E09000007', 'E09000008', 'E09000009', 'E09000010', 'E09000011', 'E09000012', 'E09000013', 'E09000014', 'E09000015', 'E09000016', 'E09000017', 'E09000018', 'E09000019', 'E09000020', 'E09000021', 'E09000022', 'E09000023', 'E09000024', 'E09000025', 'E09000026', 'E09000027', 'E09000028', 'E09000029', 'E09000030', 'E09000031', 'E09000032', 'E09000033'],
        bounds: [-0.5, 51.3, 0.3, 51.7]
    },
    {
        name: 'Birmingham',
        lad_codes: ['E08000025'],
        bounds: [-2.0, 52.4, -1.75, 52.6]
    },
    
    // West Midlands
    {
        name: 'West Midlands',
        lad_codes: ['E08000025', 'E08000026', 'E08000027', 'E08000028', 'E08000029', 'E08000030', 'E08000031'],
        bounds: [-2.2, 52.35, -1.7, 52.65]
    },
    {
        name: 'Coventry',
        lad_codes: ['E08000026'],
        bounds: [-1.6, 52.35, -1.45, 52.45]
    },
    {
        name: 'Wolverhampton',
        lad_codes: ['E08000031'],
        bounds: [-2.2, 52.55, -2.05, 52.63]
    },
    
    // Yorkshire
    {
        name: 'Leeds',
        lad_codes: ['E08000035'],
        bounds: [-1.7, 53.7, -1.4, 53.9]
    },
    {
        name: 'Sheffield',
        lad_codes: ['E08000019'],
        bounds: [-1.6, 53.3, -1.3, 53.5]
    },
    {
        name: 'Bradford',
        lad_codes: ['E08000032'],
        bounds: [-2.0, 53.75, -1.7, 53.85]
    },
    {
        name: 'York',
        lad_codes: ['E06000014'],
        bounds: [-1.15, 53.92, -1.0, 54.0]
    },
    
    // North West
    {
        name: 'Merseyside',
        lad_codes: ['E08000012', 'E08000013', 'E08000014', 'E08000015', 'E08000011'],
        bounds: [-3.1, 53.3, -2.7, 53.55]
    },
    {
        name: 'Liverpool',
        lad_codes: ['E08000012'],
        bounds: [-3.0, 53.35, -2.85, 53.48]
    },
    {
        name: 'Warrington',
        lad_codes: ['E06000007'],
        bounds: [-2.65, 53.35, -2.5, 53.45]
    },
    {
        name: 'Chester',
        lad_codes: ['E06000050'],
        bounds: [-2.95, 53.15, -2.85, 53.25]
    },
    
    // North East
    {
        name: 'Newcastle upon Tyne',
        lad_codes: ['E08000021'],
        bounds: [-1.75, 54.95, -1.55, 55.05]
    },
    {
        name: 'Sunderland',
        lad_codes: ['E08000024'],
        bounds: [-1.45, 54.85, -1.3, 54.95]
    },
    {
        name: 'Durham',
        lad_codes: ['E06000047'],
        bounds: [-1.9, 54.5, -1.4, 54.9]
    },
    {
        name: 'Middlesbrough',
        lad_codes: ['E06000002'],
        bounds: [-1.3, 54.53, -1.15, 54.58]
    },
    
    // South West
    {
        name: 'Bristol',
        lad_codes: ['E06000023'],
        bounds: [-2.7, 51.4, -2.5, 51.55]
    },
    {
        name: 'Plymouth',
        lad_codes: ['E06000026'],
        bounds: [-4.2, 50.35, -4.05, 50.45]
    },
    {
        name: 'Exeter',
        lad_codes: ['E07000041'],
        bounds: [-3.6, 50.7, -3.45, 50.75]
    },
    
    // South East
    {
        name: 'Brighton and Hove',
        lad_codes: ['E06000043'],
        bounds: [-0.2, 50.8, -0.05, 50.87]
    },
    {
        name: 'Southampton',
        lad_codes: ['E06000045'],
        bounds: [-1.45, 50.88, -1.35, 50.95]
    },
    {
        name: 'Portsmouth',
        lad_codes: ['E06000044'],
        bounds: [-1.15, 50.77, -1.05, 50.85]
    },
    {
        name: 'Reading',
        lad_codes: ['E06000038'],
        bounds: [-1.0, 51.42, -0.92, 51.48]
    },
    {
        name: 'Oxford',
        lad_codes: ['E07000178'],
        bounds: [-1.3, 51.72, -1.2, 51.78]
    },
    {
        name: 'Cambridge',
        lad_codes: ['E07000008'],
        bounds: [0.08, 52.18, 0.18, 52.23]
    },
    
    // East Midlands
    {
        name: 'Nottingham',
        lad_codes: ['E06000018'],
        bounds: [-1.2, 52.9, -1.1, 53.0]
    },
    {
        name: 'Leicester',
        lad_codes: ['E06000016'],
        bounds: [-1.2, 52.6, -1.05, 52.68]
    },
    {
        name: 'Derby',
        lad_codes: ['E06000015'],
        bounds: [-1.52, 52.88, -1.42, 52.97]
    },
    
    // Scotland
    {
        name: 'Glasgow',
        lad_codes: ['S12000046'],
        bounds: [-4.35, 55.8, -4.15, 55.92]
    },
    {
        name: 'Edinburgh',
        lad_codes: ['S12000036'],
        bounds: [-3.3, 55.9, -3.1, 56.0]
    },
    {
        name: 'Aberdeen',
        lad_codes: ['S12000033'],
        bounds: [-2.2, 57.1, -2.0, 57.2]
    },
    {
        name: 'Dundee',
        lad_codes: ['S12000042'],
        bounds: [-3.1, 56.45, -2.9, 56.5]
    },
    
    // Wales
    {
        name: 'Cardiff',
        lad_codes: ['W06000015'],
        bounds: [-3.25, 51.45, -3.1, 51.53]
    },
    {
        name: 'Swansea',
        lad_codes: ['W06000011'],
        bounds: [-4.05, 51.6, -3.9, 51.67]
    },
    {
        name: 'Newport',
        lad_codes: ['W06000022'],
        bounds: [-3.05, 51.55, -2.95, 51.62]
    },
    
    // Northern Ireland
    {
        name: 'Belfast',
        lad_codes: ['N09000003'],
        bounds: [-6.0, 54.57, -5.85, 54.65]
    }
];
