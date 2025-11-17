// lib/data/locations.ts
import { LocationBounds } from '@lib/types/index';

export const LOCATIONS: Record<string, LocationBounds> = {

    'England': {
        lad_codes: [],
        bounds: [-6.5, 49.9, 1.8, 55.8]
    },
    'Scotland': {
        lad_codes: [],
        bounds: [-8.6, 54.6, 1.8, 60.9]
    },
    'Wales': {
        lad_codes: [],
        bounds: [-5.3, 51.3, -2.6, 53.5]
    },
    'Northern Ireland': {
        lad_codes: [],
        bounds: [-8.3, 53.9, -5.3, 55.4]
    },
    'United Kingdom': {
        lad_codes: [],
        bounds: [-8.6, 49.9, 1.8, 60.9]
    },

    'Greater Manchester': {
        lad_codes: ['E08000001', 'E08000002', 'E08000003', 'E08000004', 'E08000005', 'E08000006', 'E08000007', 'E08000008', 'E08000009', 'E08000010'],
        bounds: [-2.5, 53.3, -2.0, 53.7]
    },
    'London': {
        lad_codes: ['E09000001', 'E09000002', 'E09000003', 'E09000004', 'E09000005', 'E09000006', 'E09000007', 'E09000008', 'E09000009', 'E09000010', 'E09000011', 'E09000012', 'E09000013', 'E09000014', 'E09000015', 'E09000016', 'E09000017', 'E09000018', 'E09000019', 'E09000020', 'E09000021', 'E09000022', 'E09000023', 'E09000024', 'E09000025', 'E09000026', 'E09000027', 'E09000028', 'E09000029', 'E09000030', 'E09000031', 'E09000032', 'E09000033'],
        bounds: [-0.5, 51.3, 0.3, 51.7]
    },
    'Birmingham': {
        lad_codes: ['E08000025'],
        bounds: [-2.0, 52.4, -1.75, 52.6]
    },

    // West Midlands
    // 'West Midlands': {
    //     lad_codes: ['E08000025', 'E08000026', 'E08000027', 'E08000028', 'E08000029', 'E08000030', 'E08000031'],
    //     bounds: [-2.2, 52.35, -1.7, 52.65]
    // },
    'Coventry': {
        lad_codes: ['E08000026'],
        bounds: [-1.6, 52.35, -1.45, 52.45]
    },
    'Wolverhampton': {
        lad_codes: ['E08000031'],
        bounds: [-2.2, 52.55, -2.05, 52.63]
    },
    'Solihull': {
        lad_codes: ['E08000029'],
        bounds: [-1.85, 52.38, -1.7, 52.48]
    },
    'Walsall': {
        lad_codes: ['E08000030'],
        bounds: [-2.05, 52.55, -1.95, 52.63]
    },
    'Dudley': {
        lad_codes: ['E08000027'],
        bounds: [-2.15, 52.48, -2.05, 52.55]
    },
    'Sandwell': {
        lad_codes: ['E08000028'],
        bounds: [-2.05, 52.48, -1.95, 52.55]
    },
    'Stoke-on-Trent': {
        lad_codes: ['E06000021'],
        bounds: [-2.25, 52.97, -2.1, 53.08]
    },
    'Worcester': {
        lad_codes: ['E07000237'],
        bounds: [-2.25, 52.17, -2.18, 52.22]
    },
    'Hereford': {
        lad_codes: ['E06000019'],
        bounds: [-2.75, 51.95, -2.65, 52.15]
    },
    'Shrewsbury': {
        lad_codes: ['E06000051'],
        bounds: [-2.8, 52.65, -2.65, 52.8]
    },

    // Yorkshire
    'Leeds': {
        lad_codes: ['E08000035'],
        bounds: [-1.7, 53.7, -1.4, 53.9]
    },
    'Sheffield': {
        lad_codes: ['E08000019'],
        bounds: [-1.6, 53.3, -1.3, 53.5]
    },
    'Bradford': {
        lad_codes: ['E08000032'],
        bounds: [-2.0, 53.75, -1.7, 53.85]
    },
    'York': {
        lad_codes: ['E06000014'],
        bounds: [-1.15, 53.92, -1.0, 54.0]
    },
    'Hull': {
        lad_codes: ['E06000010'],
        bounds: [-0.4, 53.72, -0.3, 53.78]
    },
    'Doncaster': {
        lad_codes: ['E08000017'],
        bounds: [-1.2, 53.5, -1.0, 53.58]
    },
    'Wakefield': {
        lad_codes: ['E08000036'],
        bounds: [-1.55, 53.65, -1.45, 53.72]
    },
    'Barnsley': {
        lad_codes: ['E08000016'],
        bounds: [-1.55, 53.52, -1.45, 53.58]
    },
    'Rotherham': {
        lad_codes: ['E08000018'],
        bounds: [-1.4, 53.4, -1.3, 53.48]
    },
    'Halifax': {
        lad_codes: ['E08000033'],
        bounds: [-2.0, 53.7, -1.8, 53.77]
    },
    'Huddersfield': {
        lad_codes: ['E08000034'],
        bounds: [-1.85, 53.6, -1.75, 53.68]
    },
    'Harrogate': {
        lad_codes: ['E07000165'],
        bounds: [-1.6, 53.95, -1.5, 54.02]
    },
    'Scarborough': {
        lad_codes: ['E07000168'],
        bounds: [-0.45, 54.25, -0.35, 54.32]
    },

    // North West
    'Merseyside': {
        lad_codes: ['E08000012', 'E08000013', 'E08000014', 'E08000015', 'E08000011'],
        bounds: [-3.1, 53.3, -2.7, 53.55]
    },
    'Liverpool': {
        lad_codes: ['E08000012'],
        bounds: [-3.0, 53.35, -2.85, 53.48]
    },
    'Warrington': {
        lad_codes: ['E06000007'],
        bounds: [-2.65, 53.35, -2.5, 53.45]
    },
    'Chester': {
        lad_codes: ['E06000050'],
        bounds: [-2.95, 53.15, -2.85, 53.25]
    },
    'Manchester': {
        lad_codes: ['E08000003'],
        bounds: [-2.3, 53.45, -2.2, 53.52]
    },
    'Salford': {
        lad_codes: ['E08000006'],
        bounds: [-2.35, 53.47, -2.25, 53.53]
    },
    'Bolton': {
        lad_codes: ['E08000001'],
        bounds: [-2.45, 53.55, -2.4, 53.6]
    },
    'Stockport': {
        lad_codes: ['E08000007'],
        bounds: [-2.2, 53.38, -2.1, 53.45]
    },
    'Oldham': {
        lad_codes: ['E08000004'],
        bounds: [-2.15, 53.52, -2.05, 53.57]
    },
    'Rochdale': {
        lad_codes: ['E08000005'],
        bounds: [-2.2, 53.6, -2.1, 53.65]
    },
    'Wigan': {
        lad_codes: ['E08000010'],
        bounds: [-2.65, 53.52, -2.6, 53.57]
    },
    'Blackburn': {
        lad_codes: ['E06000008'],
        bounds: [-2.5, 53.73, -2.43, 53.77]
    },
    'Blackpool': {
        lad_codes: ['E06000009'],
        bounds: [-3.08, 53.8, -3.0, 53.85]
    },
    'Preston': {
        lad_codes: ['E07000123'],
        bounds: [-2.75, 53.75, -2.68, 53.78]
    },
    'Lancaster': {
        lad_codes: ['E07000121'],
        bounds: [-2.85, 54.02, -2.78, 54.08]
    },
    'Carlisle': {
        lad_codes: ['E07000028'],
        bounds: [-3.0, 54.88, -2.9, 54.95]
    },

    // North East
    'Newcastle upon Tyne': {
        lad_codes: ['E08000021'],
        bounds: [-1.75, 54.95, -1.55, 55.05]
    },
    'Sunderland': {
        lad_codes: ['E08000024'],
        bounds: [-1.45, 54.85, -1.3, 54.95]
    },
    'Durham': {
        lad_codes: ['E06000047'],
        bounds: [-1.9, 54.5, -1.4, 54.9]
    },
    'Middlesbrough': {
        lad_codes: ['E06000002'],
        bounds: [-1.3, 54.53, -1.15, 54.58]
    },
    'Gateshead': {
        lad_codes: ['E08000037'],
        bounds: [-1.7, 54.93, -1.55, 55.0]
    },
    'South Shields': {
        lad_codes: ['E08000023'],
        bounds: [-1.45, 54.98, -1.4, 55.02]
    },
    'Darlington': {
        lad_codes: ['E06000005'],
        bounds: [-1.6, 54.52, -1.5, 54.56]
    },
    'Hartlepool': {
        lad_codes: ['E06000001'],
        bounds: [-1.25, 54.68, -1.18, 54.72]
    },
    'Stockton-on-Tees': {
        lad_codes: ['E06000004'],
        bounds: [-1.35, 54.55, -1.25, 54.6]
    },

    // South West
    'Bristol': {
        lad_codes: ['E06000023'],
        bounds: [-2.7, 51.4, -2.5, 51.55]
    },
    'Plymouth': {
        lad_codes: ['E06000026'],
        bounds: [-4.2, 50.35, -4.05, 50.45]
    },
    'Exeter': {
        lad_codes: ['E07000041'],
        bounds: [-3.6, 50.7, -3.45, 50.75]
    },
    'Bath': {
        lad_codes: ['E06000022'],
        bounds: [-2.4, 51.36, -2.32, 51.4]
    },
    'Cheltenham': {
        lad_codes: ['E07000078'],
        bounds: [-2.12, 51.88, -2.05, 51.93]
    },
    'Gloucester': {
        lad_codes: ['E07000081'],
        bounds: [-2.27, 51.85, -2.22, 51.89]
    },
    'Swindon': {
        lad_codes: ['E06000030'],
        bounds: [-1.82, 51.54, -1.75, 51.58]
    },
    'Bournemouth': {
        lad_codes: ['E06000058'],
        bounds: [-1.95, 50.7, -1.8, 50.75]
    },
    'Poole': {
        lad_codes: ['E06000029'],
        bounds: [-2.05, 50.7, -1.95, 50.75]
    },
    'Torquay': {
        lad_codes: ['E06000027'],
        bounds: [-3.55, 50.43, -3.48, 50.48]
    },
    'Cornwall': {
        lad_codes: ['E06000052'],
        bounds: [-5.1, 50.23, -5.0, 50.28]
    },

    // South East
    'Brighton and Hove': {
        lad_codes: ['E06000043'],
        bounds: [-0.2, 50.8, -0.05, 50.87]
    },
    'Southampton': {
        lad_codes: ['E06000045'],
        bounds: [-1.45, 50.88, -1.35, 50.95]
    },
    'Portsmouth': {
        lad_codes: ['E06000044'],
        bounds: [-1.15, 50.77, -1.05, 50.85]
    },
    'Reading': {
        lad_codes: ['E06000038'],
        bounds: [-1.0, 51.42, -0.92, 51.48]
    },
    'Oxford': {
        lad_codes: ['E07000178'],
        bounds: [-1.3, 51.72, -1.2, 51.78]
    },
    'Cambridge': {
        lad_codes: ['E07000008'],
        bounds: [0.08, 52.18, 0.18, 52.23]
    },
    'Canterbury': {
        lad_codes: ['E07000106'],
        bounds: [0.95, 51.25, 1.15, 51.32]
    },
    'Maidstone': {
        lad_codes: ['E07000110'],
        bounds: [0.48, 51.25, 0.58, 51.3]
    },
    'Guildford': {
        lad_codes: ['E07000209'],
        bounds: [-0.6, 51.23, -0.55, 51.27]
    },
    'Crawley': {
        lad_codes: ['E07000226'],
        bounds: [-0.2, 51.1, -0.15, 51.13]
    },
    'Basingstoke': {
        lad_codes: ['E07000084'],
        bounds: [-1.1, 51.25, -1.05, 51.28]
    },
    'Winchester': {
        lad_codes: ['E07000094'],
        bounds: [-1.35, 51.05, -1.28, 51.08]
    },
    'Slough': {
        lad_codes: ['E06000039'],
        bounds: [-0.62, 51.5, -0.57, 51.53]
    },
    'Milton Keynes': {
        lad_codes: ['E06000042'],
        bounds: [-0.82, 51.98, -0.68, 52.08]
    },
    'Luton': {
        lad_codes: ['E06000032'],
        bounds: [-0.45, 51.87, -0.4, 51.9]
    },
    'Ipswich': {
        lad_codes: ['E07000202'],
        bounds: [1.13, 52.04, 1.2, 52.08]
    },
    'Norwich': {
        lad_codes: ['E07000148'],
        bounds: [1.25, 52.6, 1.35, 52.65]
    },
    'Colchester': {
        lad_codes: ['E07000071'],
        bounds: [0.87, 51.88, 0.93, 51.92]
    },
    'Southend-on-Sea': {
        lad_codes: ['E06000033'],
        bounds: [0.68, 51.53, 0.75, 51.56]
    },
    'Peterborough': {
        lad_codes: ['E06000031'],
        bounds: [-0.28, 52.55, -0.2, 52.6]
    },

    // East Midlands
    'Nottingham': {
        lad_codes: ['E06000018'],
        bounds: [-1.2, 52.9, -1.1, 53.0]
    },
    'Leicester': {
        lad_codes: ['E06000016'],
        bounds: [-1.2, 52.6, -1.05, 52.68]
    },
    'Derby': {
        lad_codes: ['E06000015'],
        bounds: [-1.52, 52.88, -1.42, 52.97]
    },
    'Northampton': {
        lad_codes: ['E06000061'],
        bounds: [-0.93, 52.22, -0.85, 52.27]
    },
    'Lincoln': {
        lad_codes: ['E07000138'],
        bounds: [-0.58, 53.21, -0.52, 53.25]
    },
    'Mansfield': {
        lad_codes: ['E07000174'],
        bounds: [-1.22, 53.13, -1.17, 53.18]
    },
    'Chesterfield': {
        lad_codes: ['E07000034'],
        bounds: [-1.45, 53.22, -1.38, 53.25]
    },

    // Scotland
    'Glasgow': {
        lad_codes: ['S12000046'],
        bounds: [-4.35, 55.8, -4.15, 55.92]
    },
    'Edinburgh': {
        lad_codes: ['S12000036'],
        bounds: [-3.3, 55.9, -3.1, 56.0]
    },
    'Aberdeen': {
        lad_codes: ['S12000033'],
        bounds: [-2.2, 57.1, -2.0, 57.2]
    },
    'Dundee': {
        lad_codes: ['S12000042'],
        bounds: [-3.1, 56.45, -2.9, 56.5]
    },
    'Inverness': {
        lad_codes: ['S12000017'],
        bounds: [-4.3, 57.45, -4.2, 57.5]
    },
    'Stirling': {
        lad_codes: ['S12000030'],
        bounds: [-4.0, 56.1, -3.9, 56.15]
    },
    'Perth': {
        lad_codes: ['S12000048'],
        bounds: [-3.5, 56.38, -3.4, 56.43]
    },
    'Paisley': {
        lad_codes: ['S12000038'],
        bounds: [-4.45, 55.83, -4.4, 55.87]
    },

    // Wales
    'Cardiff': {
        lad_codes: ['W06000015'],
        bounds: [-3.25, 51.45, -3.1, 51.53]
    },
    'Swansea': {
        lad_codes: ['W06000011'],
        bounds: [-4.05, 51.6, -3.9, 51.67]
    },
    'Newport': {
        lad_codes: ['W06000022'],
        bounds: [-3.05, 51.55, -2.95, 51.62]
    },
    'Wrexham': {
        lad_codes: ['W06000006'],
        bounds: [-3.05, 53.03, -2.95, 53.08]
    },
    'Bangor': {
        lad_codes: ['W06000001'],
        bounds: [-4.15, 53.22, -4.1, 53.25]
    },
    'Aberystwyth': {
        lad_codes: ['W06000008'],
        bounds: [-4.1, 52.4, -4.05, 52.43]
    },

    // Northern Ireland
    'Belfast': {
        lad_codes: ['N09000003'],
        bounds: [-6.0, 54.57, -5.85, 54.65]
    },
    'Londonderry': {
        lad_codes: ['N09000005'],
        bounds: [-7.35, 54.98, -7.28, 55.03]
    },
    'Lisburn': {
        lad_codes: ['N09000007'],
        bounds: [-6.08, 54.5, -6.0, 54.55]
    },
    'Newry': {
        lad_codes: ['N09000010'],
        bounds: [-6.37, 54.17, -6.32, 54.2]
    },

    // North West England
    'North West': {
        lad_codes: [
            // Greater Manchester
            'E08000001', 'E08000002', 'E08000003', 'E08000004', 'E08000005', 'E08000006',
            'E08000007', 'E08000008', 'E08000009', 'E08000010',
            // Merseyside
            'E08000011', 'E08000012', 'E08000013', 'E08000014', 'E08000015',
            // Cheshire
            'E06000049', 'E06000050', 'E06000006', 'E06000007', 'E06000008', 'E06000009',
            'E06000064', 'E06000063',
            // Lancashire
            'E07000117', 'E07000118', 'E07000119', 'E07000120', 'E07000121', 'E07000122', 'E07000123',
            'E07000124', 'E07000125', 'E07000126', 'E07000127', 'E07000128',
            // Cumbria
            'E07000026', 'E07000027', 'E07000028', 'E07000029', 'E07000030', 'E07000031'
        ],
        bounds: [-3.6, 53.3, -2.1, 55.1]
    },

    // North East England
    // 'North East': {
    //     lad_codes: [
    //         'E06000001', 'E06000002', 'E06000003', 'E06000004', 'E06000005', 'E06000047', // Tees Valley
    //         'E08000020', 'E08000021', 'E08000022', 'E08000023', 'E08000024' // Tyne & Wear
    //     ],
    //     bounds: [-2.2, 54.5, -1.1, 55.8]
    // },

    // North East England
'North East': {
    lad_codes: [
        // Tees Valley Unitary Authorities
        'E06000001', // Hartlepool
        'E06000002', // Middlesbrough
        'E06000003', // Redcar and Cleveland
        'E06000004', // Stockton-on-Tees
        'E06000005', // Darlington

        // County Durham and Northumberland Unitary Authorities
        'E06000047', // County Durham
        'E06000048', // Northumberland (***This was missing from your list***)

        // Tyne and Wear Metropolitan Districts
        'E08000037', // Gateshead (***The correct code for Gateshead***)
        'E08000021', // Newcastle upon Tyne
        'E08000022', // North Tyneside
        'E08000023', // South Tyneside
        'E08000024'  // Sunderland
    ],
    // Corrected bounding box
    bounds: [-2.7, 54.2, -0.5, 55.9]
},

    // West Midlands
    'West Midlands': {
        lad_codes: [
            'E08000025', 'E08000026', 'E08000027', 'E08000028', 'E08000029', 'E08000030', 'E08000031', // Metro area
            'E07000192', 'E07000193', 'E07000194', 'E07000195', 'E07000196', 'E07000197', 'E07000199', // Staffordshire
            'E06000019', 'E06000020', 'E06000021', // Telford, Stoke
            'E06000051',
            'E07000218', 'E07000219', 'E07000220', 'E07000221', 'E07000222', // Warwickshire
            'E07000234', 'E07000235', 'E07000236', 'E07000237', 'E07000238', 'E07000239'
        ],
        bounds: [-3.1, 52.2, -1.4, 53.0]
    },

    // // South West England
    // 'South West': {
    //     lad_codes: [
    //         // Devon
    //         'E07000040', 'E07000041', 'E07000042', 'E07000043', 'E07000044', 'E07000045', 'E07000046', 'E07000047',
    //         'E06000052',
    //         // Cornwall
    //         'E06000052', 'E06000053',
    //         // Somerset
    //         'E07000187', 'E07000188', 'E07000189', 'E07000190', 'E07000191',
    //         // Dorset
    //         'E06000059', 'E06000058'
    //     ],
    //     bounds: [-5.3, 50.2, -1.9, 51.3]
    // },
    // South West England
    'South West': {
        lad_codes: [
            // Bristol, Bath and Somerset Unitaries/Authorities
            'E06000023', // Bristol, City of
            'E06000022', // Bath and North East Somerset
            'E06000024', // North Somerset
            // 'E06000056', // Somerset (Unitary Authority since 2023)

            // Cornwall and Devon Unitaries/Authorities
            'E06000052', // Cornwall
            'E06000053', // Isles of Scilly
            'E06000028', // Plymouth, City of
            'E06000027', // Torbay
            'E07000040', // East Devon
            'E07000041', // Exeter
            'E07000042', // Mid Devon
            'E07000043', // North Devon
            'E07000044', // South Hams
            'E07000045', // Teignbridge
            'E07000046', // Tiverton (West Devon)
            'E07000047', // Torridge

            // Dorset Unitaries
            'E06000058', // Bournemouth, Christchurch and Poole
            'E06000059', // Dorset Council
            'E06000066', // Dorset Council

            // Gloucestershire Authorities
            'E06000025', // South Gloucestershire
            'E06000026', // South Gloucestershire
            'E07000078', // Cheltenham
            'E07000079', // Cotswold
            'E07000080', // Forest of Dean
            'E07000081', // Gloucester
            'E07000082', // Stroud
            'E07000083', // Tewkesbury

            // Wiltshire Unitaries
            'E06000054', // Swindon
            // 'E06000055'  // Wiltshire Council
        ],
        // Corrected bounding box
        bounds: [-6.5, 49.9, -1.3, 52.1]
    },

    // South East England
    "South East": {
        "lad_codes": [
            // Unitary Authorities (13 codes)
            "E06000035", // Medway
            "E06000036", // Bracknell Forest
            "E06000037", // West Berkshire
            "E06000038", // Reading
            "E06000039", // Slough
            "E06000040", // Windsor and Maidenhead
            "E06000041", // Wokingham
            "E06000042", // Milton Keynes
            "E06000043", // Brighton and Hove
            "E06000044", // Portsmouth
            "E06000045", // Southampton
            "E06000046", // Isle of Wight
            "E06000060", // Buckinghamshire UA (Supersedes E07 codes for Aylesbury Vale, Chiltern, South Bucks, Wycombe)

            // East Sussex (5 codes)
            "E07000061", // Eastbourne
            "E07000062", // Hastings
            "E07000063", // Lewes
            "E07000064", // Rother
            "E07000065", // Wealden

            // Hampshire Districts (13 codes)
            "E07000084", // Basingstoke and Deane
            "E07000085", // East Hampshire
            "E07000086", // Eastleigh
            "E07000087", // Fareham
            "E07000088", // Gosport
            "E07000089", // Hart
            "E07000090", // Havant
            "E07000091", // New Forest
            "E07000092", // Rushmoor
            "E07000093", // Test Valley
            "E07000094", // Winchester
            // "E07000095", // City of London (While technically a separate entity, sometimes grouped with wider region data)
            // "E07000096", // Westminster (Similar note to above)

            // Kent Districts (12 codes)
            "E07000105", // Ashford
            "E07000106", // Ashford
            "E07000107", // Ashford
            "E07000108", // Canterbury
            "E07000109", // Dartford
            "E07000110", // Dover
            "E07000111", // Gravesham
            "E07000112", // Maidstone
            "E07000113", // Sevenoaks
            "E07000114", // Shepway (now Folkestone and Hythe)
            "E07000115", // Swale
            "E07000116", // Thanet
            // "E07000117", // Tonbridge and Malling
            // "E07000118", // Tunbridge Wells

            // Oxfordshire Districts (5 codes)
            // "E07000176", // Cherwell
            // "E07000177", // Oxford
            "E07000178", // South Oxfordshire
            "E07000179", // Vale of White Horse
            "E07000180", // West Oxfordshire

            // Surrey Districts (11 codes)
            "E07000207", // Elmbridge
            "E07000208", // Epsom and Ewell
            "E07000209", // Guildford
            "E07000210", // Mole Valley
            "E07000211", // Reigate and Banstead
            "E07000212", // Runnymede
            "E07000213", // Spelthorne
            "E07000214", // Surrey Heath
            "E07000215", // Tandridge
            "E07000216", // Waverley
            "E07000217", // Woking

            // West Sussex Districts (7 codes - Missing from your original list)
            // "E07000218", // Adur
            // "E07000219", // Arun
            // "E07000220", // Chichester
            // "E07000221", // Crawley
            // "E07000222", // Horsham
            "E07000223", // Mid Sussex
            "E07000224",  // Worthing
            "E07000225",  // Worthing
            "E07000226",  // Worthing
            "E07000227",  // Worthing
            "E07000228",  // Worthing
        ],
        "bounds": [-1.8, 50.7, 1.5, 52.1]
    },

    // East of England
    // 'East of England': {
    //     lad_codes: [
    //         'E06000031', 'E06000032', 'E06000033', 'E06000034', // Essex/Thurrock/Southend
    //         'E07000100', 'E07000101', 'E07000102', 'E07000103', 'E07000104', 'E07000105', // Cambridgeshire
    //         'E07000200', 'E07000201', 'E07000202', 'E07000203', 'E07000204', // Norfolk
    //         'E07000095', 'E07000096', 'E07000097', 'E07000098', 'E07000099', // Suffolk
    //         'E07000207', 'E07000208', 'E07000209', 'E07000210' // Hertfordshire
    //     ],
    //     bounds: [-0.6, 51.6, 1.8, 53.2]
    // },

    // East of England
    'East of England': {
        lad_codes: [
            // Bedfordshire UAs: Bedford, Central Bedfordshire, Luton
            'E06000032', 'E06000055', 'E06000056',

            // Cambridgeshire UAs/LADs: Peterborough UA, Cambridge, East Cambs, Fenland, Huntingdonshire, South Cambs
            'E06000031', 'E07000008', 'E07000009', 'E07000010', 'E07000011', 'E07000012',

            // Essex UAs/LADs: Southend-on-Sea UA, Thurrock UA, Basildon, Braintree, Brentwood, Castle Point, Chelmsford, Colchester, Epping Forest, Harlow, Maldon, Rochford, Tendring, Uttlesford
            'E06000033', 'E06000034', 'E07000066', 'E07000067', 'E07000068', 'E07000069', 'E07000070', 'E07000071', 'E07000072', 'E07000073', 'E07000074', 'E07000075', 'E07000076', 'E07000077',

            // Hertfordshire LADs: Broxbourne, Dacorum, East Herts, Hertsmere, North Herts, St Albans, Stevenage, Three Rivers, Watford, Welwyn Hatfield
            'E07000095', 'E07000096', 'E07000097', 'E07000098', 'E07000099', 'E07000100', 'E07000101', 'E07000102', 'E07000103', 'E07000104',

            // Suffolk LADs: Ipswich, East Suffolk, West Suffolk (incorporating boundary changes up to 2019)
            'E07000200', 'E07000201', 'E07000202', 'E07000203', 'E07000240', 'E07000241', 'E07000242', 'E07000243', 'E07000244', 'E07000245',

            // Norfolk LADs: Breckland, Broadland, Great Yarmouth, King's Lynn & West Norfolk, North Norfolk, Norwich, South Norfolk
            'E07000143', 'E07000144', 'E07000145', 'E07000146', 'E07000147', 'E07000148', 'E07000149'
        ],
        bounds: [-0.6, 51.6, 1.8, 53.2]
    },

    // Devon
    'Devon': {
        lad_codes: [
            'E07000040', 'E07000041', 'E07000042', 'E07000043', 'E07000044', 'E07000045', 'E07000046', 'E07000047', // Devon districts
            'E06000052' // Plymouth
        ],
        bounds: [-4.9, 50.2, -2.9, 51.3]
    },

    // Cornwall
    // 'Cornwall': {
    //     lad_codes: ['E06000052', 'E06000053'],
    //     bounds: [-5.7, 49.9, -4.0, 50.7]
    // },

    // Somerset
    'Somerset': {
        lad_codes: [
            'E07000187', 'E07000188', 'E07000189', 'E07000190', 'E07000191'
        ],
        bounds: [-3.8, 50.9, -2.2, 51.4]
    },

    // Dorset
    'Dorset': {
        lad_codes: ['E06000058', 'E06000059'],
        bounds: [-2.8, 50.6, -1.6, 51.1]
    },

    // Hampshire
    'Hampshire': {
        lad_codes: [
            'E07000084', 'E07000085', 'E07000086', 'E07000087', 'E07000088',
            'E07000089', 'E07000090', 'E07000091', 'E07000092', 'E07000093', // Hampshire districts
            'E06000044', 'E06000045' // Portsmouth, Southampton
        ],
        bounds: [-1.9, 50.7, -0.7, 51.4]
    },

    // Kent
    'Kent': {
        lad_codes: [
            'E07000105', 'E07000106', 'E07000107', 'E07000108', 'E07000109', 'E07000110', 'E07000111',
            'E07000112', 'E07000113', 'E07000114', 'E07000115', 'E07000116',
            'E06000035', 'E06000036', 'E07000094', 'E07000093' // Medway, Thurrock
        ],
        bounds: [0.3, 50.8, 1.6, 51.5]
    },

    // Sussex (combined East + West)
    'Sussex': {
        lad_codes: [
            'E07000223', 'E07000224', 'E07000225', 'E07000226', // West Sussex
            'E07000061', 'E07000062', 'E07000063', 'E07000064', 'E06000043' // East Sussex & Brighton
        ],
        bounds: [-0.9, 50.7, 1.0, 51.2]
    },

    // Essex
    'Essex': {
        lad_codes: [
            'E07000066', 'E07000067', 'E07000068', 'E07000069', 'E07000070', 'E07000071',
            'E07000072', 'E07000073', 'E07000074', 'E07000075', 'E07000076',
            'E06000033' // Thurrock, Southend
        ],
        bounds: [0.2, 51.5, 1.3, 52.1]
    },

    // Hertfordshire
    'Hertfordshire': {
        lad_codes: [
            'E07000095', 'E07000096', 'E07000097', 'E07000098', 'E07000099', 'E07000100', 'E07000101', 'E07000102', 'E07000103', 'E07000104'
        ],
        bounds: [-0.6, 51.6, 0.3, 52.1]
    },

    // Oxfordshire
    'Oxfordshire': {
        lad_codes: [
            'E07000175', 'E07000176', 'E07000177', 'E07000178', 'E07000179'
        ],
        bounds: [-1.8, 51.5, -0.9, 52.2]
    },

    // Gloucestershire
    'Gloucestershire': {
        lad_codes: [
            'E07000077', 'E07000078', 'E07000079', 'E07000080', 'E07000081', 'E07000082'
        ],
        bounds: [-2.6, 51.6, -1.7, 52.1]
    },

    // Lancashire
    'Lancashire': {
        lad_codes: [
            'E07000117', 'E07000118', 'E07000119', 'E07000120', 'E07000121', 'E07000122', 'E07000123',
            'E07000124', 'E07000125', 'E07000126', 'E07000127', 'E07000128',
        ],
        bounds: [-3.2, 53.7, -2.2, 54.2]
    },

    // Cheshire
    'Cheshire': {
        lad_codes: ['E06000049', 'E06000050', 'E06000006', 'E06000007'],
        bounds: [-3.1, 53.0, -2.3, 53.5]
    },

    // Yorkshire (combined)
    'Yorkshire': {
        lad_codes: [
            // West Yorkshire
            'E08000032', 'E08000033', 'E08000034', 'E08000035', 'E08000036',
            // South Yorkshire
            'E08000016', 'E08000017', 'E08000018', 'E08000019',
            // North Yorkshire
            'E07000163', 'E07000164', 'E07000165', 'E07000166', 'E07000167', 'E06000010', 'E06000011',
            // East Riding
            'E06000014', 'E06000065',
        ],
        bounds: [-2.6, 53.3, -0.3, 54.6]
    },

    // Lincolnshire
    'Lincolnshire': {
        lad_codes: [
            'E07000136', 'E07000137', 'E07000138', 'E07000139', 'E07000140', 'E07000141', 'E07000142',
            'E06000013', 'E06000014', 'E06000015' // North & NE Lincs, Hull
        ],
        bounds: [-0.8, 52.6, 0.4, 53.7]
    },

    // Norfolk
    'Norfolk': {
        lad_codes: [
            'E07000143', 'E07000144', 'E07000145', 'E07000146', 'E07000147', 'E07000148', 'E07000149'
        ],
        bounds: [0.2, 52.3, 1.8, 53.0]
    },

    // Suffolk
    'Suffolk': {
        lad_codes: [
            'E07000200', 'E07000201', 'E07000202', 'E07000203', 'E07000204'
        ],
        bounds: [0.3, 51.9, 1.7, 52.6]
    },

    // Staffordshire
    'Staffordshire': {
        lad_codes: [
            'E07000192', 'E07000193', 'E07000194', 'E07000195', 'E07000196',
            'E06000021' // Stoke-on-Trent
        ],
        bounds: [-2.3, 52.6, -1.5, 53.2]
    },

    // Derbyshire
    'Derbyshire': {
        lad_codes: [
            'E07000032', 'E07000033', 'E07000034', 'E07000035', 'E07000036', 'E07000037', 'E07000038',
            'E06000015' // Derby
        ],
        bounds: [-2.0, 52.8, -1.3, 53.5]
    },

    // ----------------------------
    // SCOTLAND
    // ----------------------------

    // The Highlands
    'The Highlands': {
        lad_codes: ['S12000017'], // Highland Council
        bounds: [-6.0, 56.3, -3.0, 58.7]
    },

    // Grampian (Aberdeenshire + Aberdeen City + Moray)
    'Grampian': {
        lad_codes: ['S12000033', 'S12000020', 'S12000013'],
        bounds: [-3.8, 56.8, -1.8, 58.0]
    },

    // Central Belt (Glasgow + Edinburgh + Stirling + Falkirk + West Lothian)
    'Central Belt': {
        lad_codes: ['S12000049', 'S12000036', 'S12000030', 'S12000014', 'S12000039'],
        bounds: [-4.6, 55.7, -3.0, 56.1]
    },

    // Scottish Borders
    'Scottish Borders': {
        lad_codes: ['S12000026'],
        bounds: [-3.7, 55.0, -2.0, 55.9]
    },

    // The Hebrides (Na h-Eileanan Siar + Skye)
    'The Hebrides': {
        lad_codes: ['S12000013', 'S12000048'], // Western Isles + Highland (Skye area)
        bounds: [-8.0, 56.7, -5.5, 58.4]
    },

    // Tayside (Perth & Kinross, Angus, Dundee)
    'Tayside': {
        lad_codes: ['S12000041', 'S12000045', 'S12000042'],
        bounds: [-4.6, 56.2, -2.5, 57.2]
    },

    // Lowlands (South Ayrshire, Dumfries & Galloway)
    'Lowlands': {
        lad_codes: ['S12000028', 'S12000006'],
        bounds: [-5.5, 54.8, -2.9, 55.5]
    },

    // Greater Glasgow & Clyde
    'Greater Glasgow and Clyde': {
        lad_codes: [
            'S12000049', // Glasgow City
            'S12000035', // East Renfrewshire
            'S12000038', // Renfrewshire
            'S12000045', // Inverclyde
            'S12000046', // East Dunbartonshire
            'S12000047', // West Dunbartonshire
        ],
        bounds: [-4.6, 55.7, -4.0, 56.1]
    },

    // North East Scotland
    'North East Scotland': {
        lad_codes: ['S12000020', 'S12000033', 'S12000013'],
        bounds: [-3.8, 56.9, -1.9, 58.0]
    },

    // Islands (Orkney + Shetland + Western Isles)
    'Scottish Islands': {
        lad_codes: ['S12000023', 'S12000027', 'S12000013'],
        bounds: [-8.6, 56.7, -0.8, 60.9]
    },

    // ----------------------------
    // WALES
    // ----------------------------

    // North Wales
    'North Wales': {
        lad_codes: [
            'W06000001', // Isle of Anglesey
            'W06000002', // Gwynedd
            'W06000003', // Conwy
            'W06000004', // Denbighshire
            'W06000005', // Flintshire
            'W06000006', // Wrexham
        ],
        bounds: [-4.8, 52.7, -2.8, 53.5]
    },

    // Mid Wales
    'Mid Wales': {
        lad_codes: [
            'W06000023', // Powys
            'W06000024', // Ceredigion
        ],
        bounds: [-4.8, 51.8, -2.9, 52.8]
    },

    // South Wales
    'South Wales': {
        lad_codes: [
            'W06000009', 'W06000010', 'W06000011', 'W06000012', 'W06000013',
            'W06000014', 'W06000015', 'W06000016', 'W06000018', 'W06000019',
            'W06000020', 'W06000021', 'W06000022'
        ],
        bounds: [-4.8, 51.3, -2.8, 51.8]
    },

    // West Wales (Pembrokeshire + Carmarthenshire + Swansea)
    'West Wales': {
        lad_codes: ['W06000008', 'W06000010', 'W06000011'],
        bounds: [-5.5, 51.4, -3.7, 52.2]
    },

    // Cardiff & The Valleys
    'Cardiff and The Valleys': {
        lad_codes: [
            'W06000015', 'W06000016', 'W06000018', 'W06000019', 'W06000020', 'W06000021', 'W06000022'
        ],
        bounds: [-3.5, 51.4, -2.8, 51.8]
    },

    // South East Wales
    'South East Wales': {
        lad_codes: ['W06000013', 'W06000014', 'W06000015', 'W06000016', 'W06000018'],
        bounds: [-3.3, 51.4, -2.6, 51.8]
    },

    // The Valleys (Rhondda Cynon Taf, Merthyr, Caerphilly, Blaenau Gwent, Torfaen)
    'The Valleys': {
        lad_codes: ['W06000019', 'W06000024', 'W06000020', 'W06000021', 'W06000022'],
        bounds: [-3.5, 51.5, -2.9, 51.8]
    },

    // Pembrokeshire Coast
    'Pembrokeshire Coast': {
        lad_codes: ['W06000009'],
        bounds: [-5.5, 51.6, -4.5, 52.1]
    }
};
