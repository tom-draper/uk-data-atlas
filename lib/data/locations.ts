// lib/data/locations.ts
import { LocationBounds } from '@lib/types/index';

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
    {
        name: 'Solihull',
        lad_codes: ['E08000029'],
        bounds: [-1.85, 52.38, -1.7, 52.48]
    },
    {
        name: 'Walsall',
        lad_codes: ['E08000030'],
        bounds: [-2.05, 52.55, -1.95, 52.63]
    },
    {
        name: 'Dudley',
        lad_codes: ['E08000027'],
        bounds: [-2.15, 52.48, -2.05, 52.55]
    },
    {
        name: 'Sandwell',
        lad_codes: ['E08000028'],
        bounds: [-2.05, 52.48, -1.95, 52.55]
    },
    {
        name: 'Stoke-on-Trent',
        lad_codes: ['E06000021'],
        bounds: [-2.25, 52.97, -2.1, 53.08]
    },
    {
        name: 'Worcester',
        lad_codes: ['E07000237'],
        bounds: [-2.25, 52.17, -2.18, 52.22]
    },
    {
        name: 'Hereford',
        lad_codes: ['E06000019'],
        bounds: [-2.75, 51.95, -2.65, 52.15]
    },
    {
        name: 'Shrewsbury',
        lad_codes: ['E06000051'],
        bounds: [-2.8, 52.65, -2.65, 52.8]
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
    {
        name: 'Hull',
        lad_codes: ['E06000010'],
        bounds: [-0.4, 53.72, -0.3, 53.78]
    },
    {
        name: 'Doncaster',
        lad_codes: ['E08000017'],
        bounds: [-1.2, 53.5, -1.0, 53.58]
    },
    {
        name: 'Wakefield',
        lad_codes: ['E08000036'],
        bounds: [-1.55, 53.65, -1.45, 53.72]
    },
    {
        name: 'Barnsley',
        lad_codes: ['E08000016'],
        bounds: [-1.55, 53.52, -1.45, 53.58]
    },
    {
        name: 'Rotherham',
        lad_codes: ['E08000018'],
        bounds: [-1.4, 53.4, -1.3, 53.48]
    },
    {
        name: 'Halifax',
        lad_codes: ['E08000033'],
        bounds: [-2.0, 53.7, -1.8, 53.77]
    },
    {
        name: 'Huddersfield',
        lad_codes: ['E08000034'],
        bounds: [-1.85, 53.6, -1.75, 53.68]
    },
    {
        name: 'Harrogate',
        lad_codes: ['E07000165'],
        bounds: [-1.6, 53.95, -1.5, 54.02]
    },
    {
        name: 'Scarborough',
        lad_codes: ['E07000168'],
        bounds: [-0.45, 54.25, -0.35, 54.32]
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
    {
        name: 'Manchester',
        lad_codes: ['E08000003'],
        bounds: [-2.3, 53.45, -2.2, 53.52]
    },
    {
        name: 'Salford',
        lad_codes: ['E08000006'],
        bounds: [-2.35, 53.47, -2.25, 53.53]
    },
    {
        name: 'Bolton',
        lad_codes: ['E08000001'],
        bounds: [-2.45, 53.55, -2.4, 53.6]
    },
    {
        name: 'Stockport',
        lad_codes: ['E08000007'],
        bounds: [-2.2, 53.38, -2.1, 53.45]
    },
    {
        name: 'Oldham',
        lad_codes: ['E08000004'],
        bounds: [-2.15, 53.52, -2.05, 53.57]
    },
    {
        name: 'Rochdale',
        lad_codes: ['E08000005'],
        bounds: [-2.2, 53.6, -2.1, 53.65]
    },
    {
        name: 'Wigan',
        lad_codes: ['E08000010'],
        bounds: [-2.65, 53.52, -2.6, 53.57]
    },
    {
        name: 'Blackburn',
        lad_codes: ['E06000008'],
        bounds: [-2.5, 53.73, -2.43, 53.77]
    },
    {
        name: 'Blackpool',
        lad_codes: ['E06000009'],
        bounds: [-3.08, 53.8, -3.0, 53.85]
    },
    {
        name: 'Preston',
        lad_codes: ['E07000123'],
        bounds: [-2.75, 53.75, -2.68, 53.78]
    },
    {
        name: 'Lancaster',
        lad_codes: ['E07000121'],
        bounds: [-2.85, 54.02, -2.78, 54.08]
    },
    {
        name: 'Carlisle',
        lad_codes: ['E07000028'],
        bounds: [-3.0, 54.88, -2.9, 54.95]
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
    {
        name: 'Gateshead',
        lad_codes: ['E08000037'],
        bounds: [-1.7, 54.93, -1.55, 55.0]
    },
    {
        name: 'South Shields',
        lad_codes: ['E08000023'],
        bounds: [-1.45, 54.98, -1.4, 55.02]
    },
    {
        name: 'Darlington',
        lad_codes: ['E06000005'],
        bounds: [-1.6, 54.52, -1.5, 54.56]
    },
    {
        name: 'Hartlepool',
        lad_codes: ['E06000001'],
        bounds: [-1.25, 54.68, -1.18, 54.72]
    },
    {
        name: 'Stockton-on-Tees',
        lad_codes: ['E06000004'],
        bounds: [-1.35, 54.55, -1.25, 54.6]
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
    {
        name: 'Bath',
        lad_codes: ['E06000022'],
        bounds: [-2.4, 51.36, -2.32, 51.4]
    },
    {
        name: 'Cheltenham',
        lad_codes: ['E07000078'],
        bounds: [-2.12, 51.88, -2.05, 51.93]
    },
    {
        name: 'Gloucester',
        lad_codes: ['E07000081'],
        bounds: [-2.27, 51.85, -2.22, 51.89]
    },
    {
        name: 'Swindon',
        lad_codes: ['E06000030'],
        bounds: [-1.82, 51.54, -1.75, 51.58]
    },
    {
        name: 'Bournemouth',
        lad_codes: ['E06000058'],
        bounds: [-1.95, 50.7, -1.8, 50.75]
    },
    {
        name: 'Poole',
        lad_codes: ['E06000029'],
        bounds: [-2.05, 50.7, -1.95, 50.75]
    },
    {
        name: 'Torquay',
        lad_codes: ['E06000027'],
        bounds: [-3.55, 50.43, -3.48, 50.48]
    },
    {
        name: 'Truro',
        lad_codes: ['E06000052'],
        bounds: [-5.1, 50.23, -5.0, 50.28]
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
    {
        name: 'Canterbury',
        lad_codes: ['E07000106'],
        bounds: [0.95, 51.25, 1.15, 51.32]
    },
    {
        name: 'Maidstone',
        lad_codes: ['E07000110'],
        bounds: [0.48, 51.25, 0.58, 51.3]
    },
    {
        name: 'Guildford',
        lad_codes: ['E07000209'],
        bounds: [-0.6, 51.23, -0.55, 51.27]
    },
    {
        name: 'Crawley',
        lad_codes: ['E07000226'],
        bounds: [-0.2, 51.1, -0.15, 51.13]
    },
    {
        name: 'Basingstoke',
        lad_codes: ['E07000084'],
        bounds: [-1.1, 51.25, -1.05, 51.28]
    },
    {
        name: 'Winchester',
        lad_codes: ['E07000094'],
        bounds: [-1.35, 51.05, -1.28, 51.08]
    },
    {
        name: 'Slough',
        lad_codes: ['E06000039'],
        bounds: [-0.62, 51.5, -0.57, 51.53]
    },
    {
        name: 'Milton Keynes',
        lad_codes: ['E06000042'],
        bounds: [-0.82, 51.98, -0.68, 52.08]
    },
    {
        name: 'Luton',
        lad_codes: ['E06000032'],
        bounds: [-0.45, 51.87, -0.4, 51.9]
    },
    {
        name: 'Ipswich',
        lad_codes: ['E07000202'],
        bounds: [1.13, 52.04, 1.2, 52.08]
    },
    {
        name: 'Norwich',
        lad_codes: ['E07000148'],
        bounds: [1.25, 52.6, 1.35, 52.65]
    },
    {
        name: 'Colchester',
        lad_codes: ['E07000071'],
        bounds: [0.87, 51.88, 0.93, 51.92]
    },
    {
        name: 'Southend-on-Sea',
        lad_codes: ['E06000033'],
        bounds: [0.68, 51.53, 0.75, 51.56]
    },
    {
        name: 'Peterborough',
        lad_codes: ['E06000031'],
        bounds: [-0.28, 52.55, -0.2, 52.6]
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
    {
        name: 'Northampton',
        lad_codes: ['E06000061'],
        bounds: [-0.93, 52.22, -0.85, 52.27]
    },
    {
        name: 'Lincoln',
        lad_codes: ['E07000138'],
        bounds: [-0.58, 53.21, -0.52, 53.25]
    },
    {
        name: 'Mansfield',
        lad_codes: ['E07000174'],
        bounds: [-1.22, 53.13, -1.17, 53.17]
    },
    {
        name: 'Chesterfield',
        lad_codes: ['E07000033'],
        bounds: [-1.45, 53.23, -1.4, 53.27]
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
    {
        name: 'Inverness',
        lad_codes: ['S12000017'],
        bounds: [-4.3, 57.45, -4.2, 57.5]
    },
    {
        name: 'Stirling',
        lad_codes: ['S12000030'],
        bounds: [-4.0, 56.1, -3.9, 56.15]
    },
    {
        name: 'Perth',
        lad_codes: ['S12000048'],
        bounds: [-3.5, 56.38, -3.4, 56.43]
    },
    {
        name: 'Paisley',
        lad_codes: ['S12000038'],
        bounds: [-4.45, 55.83, -4.4, 55.87]
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
    {
        name: 'Wrexham',
        lad_codes: ['W06000006'],
        bounds: [-3.05, 53.03, -2.95, 53.08]
    },
    {
        name: 'Bangor',
        lad_codes: ['W06000001'],
        bounds: [-4.15, 53.22, -4.1, 53.25]
    },
    {
        name: 'Aberystwyth',
        lad_codes: ['W06000008'],
        bounds: [-4.1, 52.4, -4.05, 52.43]
    },
    
    // Northern Ireland
    {
        name: 'Belfast',
        lad_codes: ['N09000003'],
        bounds: [-6.0, 54.57, -5.85, 54.65]
    },
    {
        name: 'Londonderry',
        lad_codes: ['N09000005'],
        bounds: [-7.35, 54.98, -7.28, 55.03]
    },
    {
        name: 'Lisburn',
        lad_codes: ['N09000007'],
        bounds: [-6.08, 54.5, -6.0, 54.55]
    },
    {
        name: 'Newry',
        lad_codes: ['N09000010'],
        bounds: [-6.37, 54.17, -6.32, 54.2]
    }
];