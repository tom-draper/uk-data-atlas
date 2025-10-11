'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Papa from 'papaparse';

interface WardData {
  [key: string]: string | number;
}

export default function MapsPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [wardResults, setWardResults] = useState<Record<string, string>>({});
  const [wardData, setWardData] = useState<Record<string, WardData>>({});
  const currentWardRef = useRef<string | null>(null);
  const lastHoveredFeatureRef = useRef<any>(null);

  useEffect(() => {
    // Load and parse election results CSV
    fetch('/data/election-results-2024.csv')
      .then(res => res.text())
      .then(csvText => {
        const lines = csvText.split('\n');
        const dataStart = lines.findIndex(line => line.includes('Local authority name'));
        const cleanedCsv = lines.slice(dataStart).join('\n');
        
        Papa.parse(cleanedCsv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log('CSV parsed, total rows:', results.data.length);
            
            const wardWinners: Record<string, string> = {};
            const allWardData: Record<string, WardData> = {};
            const partyColumns = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];
            
            results.data.forEach((row: any) => {
              const wardCode = row['Ward code'];
              if (!wardCode || wardCode.trim() === '') return;
              
              const trimmedCode = wardCode.trim();
              let maxVotes = 0;
              let winningParty = 'OTHER';
              
              // Store all party data for this ward
              const partyVotes: Record<string, number> = {};
              
              partyColumns.forEach(party => {
                const votes = parseInt(row[party]?.replace(/,/g, '') || '0');
                partyVotes[party] = votes;
                if (votes > maxVotes) {
                  maxVotes = votes;
                  winningParty = party;
                }
              });
              
              wardWinners[trimmedCode] = winningParty;
              allWardData[trimmedCode] = {
                wardName: row['Ward name'] || 'Unknown',
                ...partyVotes
              };
            });
            
            console.log('Election results loaded:', Object.keys(wardWinners).length, 'wards');
            setWardResults(wardWinners);
            setWardData(allWardData);
          },
          error: (error) => {
            console.error('CSV parse error:', error);
          }
        });
      })
      .catch(err => {
        console.error('Error loading election results:', err);
      });
  }, []);

  useEffect(() => {
    if (map.current) return;
    if (Object.keys(wardResults).length === 0) return;
    
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (!token) {
      setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable.');
      setLoading(false);
      return;
    }
    
    mapboxgl.accessToken = token;
    
    if (mapContainer.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          // center: [-2.5, 53.5],
          center: [-2.3, 53.5],
          zoom: 10,
        });

        map.current.on('load', () => {
          console.log('Map loaded successfully');
          
          fetch('/data/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson')
            .then(res => res.json())
            .then(data => {
              console.log('GeoJSON loaded, total features:', data.features?.length);
              
              const gmLADs = ['E08000001','E08000002','E08000003','E08000004','E08000005','E08000006','E08000007','E08000008','E08000009','E08000010'];
              const gmFeatures = data.features.filter((f: any) => 
                gmLADs.includes(f.properties.LAD24CD)
              );
              
              const combinedData = {
                type: 'FeatureCollection',
                features: gmFeatures
              };
              
              combinedData.features.forEach((feature: any) => {
                const wardCode = feature.properties.WD24CD;
                feature.properties.winningParty = wardResults[wardCode] || 'NONE';
              });
              
              const partyColors: Record<string, string> = {
                'LAB': '#DC241f',
                'CON': '#0087DC',
                'LD': '#FAA61A',
                'GREEN': '#6AB023',
                'REF': '#12B6CF',
                'IND': '#CCCCCC',
                'OTHER': '#999999',
                'NONE': '#EEEEEE'
              };
              
              map.current?.addSource('gm-wards', {
                type: 'geojson',
                data: combinedData
              });
              
              map.current?.addLayer({
                id: 'wards-fill',
                type: 'fill',
                source: 'gm-wards',
                paint: {
                  'fill-color': [
                    'match',
                    ['get', 'winningParty'],
                    'LAB', partyColors.LAB,
                    'CON', partyColors.CON,
                    'LD', partyColors.LD,
                    'GREEN', partyColors.GREEN,
                    'REF', partyColors.REF,
                    'IND', partyColors.IND,
                    'OTHER', partyColors.OTHER,
                    partyColors.NONE
                  ],
                  'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.35,
                    0.6
                  ]
                }
              });
              
              map.current?.addLayer({
                id: 'wards-line',
                type: 'line',
                source: 'gm-wards',
                paint: {
                  'line-color': '#000',
                  'line-width': 1,
                  'line-opacity': 0.0
                }
              });
              
              const popup = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: false,
                offset: 10
              });
              
              map.current?.on('mousemove', 'wards-fill', (e) => {
                if (!map.current) return;
                map.current.getCanvas().style.cursor = 'pointer';
                
                if (e.features && e.features.length > 0) {
                  const feature = e.features[0];
                  const props = feature.properties;
                  const wardCode = props.WD24CD;
                  
                  // Reset previous hover state
                  if (lastHoveredFeatureRef.current && lastHoveredFeatureRef.current.id !== feature.id) {
                    if (lastHoveredFeatureRef.current.id !== undefined) {
                      map.current.setFeatureState(
                        { source: 'gm-wards', id: lastHoveredFeatureRef.current.id },
                        { hover: false }
                      );
                    }
                  }
                  
                  // Set hover state on the current feature
                  if (feature.id !== undefined) {
                    map.current.setFeatureState(
                      { source: 'gm-wards', id: feature.id },
                      { hover: true }
                    );
                    lastHoveredFeatureRef.current = feature;
                  }
                  
                  // Only update popup if we've moved to a different ward
                  if (currentWardRef.current === wardCode) return;
                  
                  currentWardRef.current = wardCode;
                  
                  const partyNames: Record<string, string> = {
                    'LAB': 'Labour',
                    'CON': 'Conservative',
                    'LD': 'Liberal Democrat',
                    'GREEN': 'Green',
                    'REF': 'Reform',
                    'IND': 'Independent',
                    'OTHER': 'Other',
                    'NONE': 'No data'
                  };
                  
                  const data = wardData[wardCode];
                  const partyColumns = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];
                  const chartData = partyColumns.map(party => ({
                    party: partyNames[party],
                    votes: (data?.[party] as number) || 0,
                    color: {
                      'LAB': '#DC241f',
                      'CON': '#0087DC',
                      'LD': '#FAA61A',
                      'GREEN': '#6AB023',
                      'REF': '#12B6CF',
                      'IND': '#CCCCCC'
                    }[party]
                  }));
                  
                  const maxVotes = Math.max(...chartData.map(d => d.votes));
                  
                  const html = `
                    <div style="width: 220px; pointer-events: none;">
                      <strong style="font-size: 14px;">${props.WD24NM || 'Unknown Ward'}</strong><br/>
                      <span style="color: #666; font-size: 12px;">Winner: <strong>${partyNames[props.winningParty] || 'Unknown'}</strong></span>
                      <div style="margin-top: 12px;">
                        ${chartData.map(item => `
                          <div style="margin-bottom: 4px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                              <span style="font-size: 12px; color: #333;">${item.party}</span>
                              <span style="font-size: 12px; font-weight: bold;">${item.votes.toLocaleString()}</span>
                            </div>
                            <div style="height: 16px; background-color: #eee; border-radius: 2px; overflow: hidden;">
                              <div style="height: 100%; width: ${maxVotes > 0 ? (item.votes / maxVotes * 100) : 0}%; background-color: ${item.color}; transition: width 0.2s;"></div>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `;
                  
                  popup.setLngLat(e.lngLat).setHTML(html).addTo(map.current);
                }
              });
              
              const popupContainer = document.createElement('div');
              let popupHovered = false;
              
              map.current?.on('mouseleave', 'wards-fill', () => {
                if (!map.current) return;
                
                // Clear hover state from the last hovered feature
                if (lastHoveredFeatureRef.current && lastHoveredFeatureRef.current.id !== undefined) {
                  map.current.setFeatureState(
                    { source: 'gm-wards', id: lastHoveredFeatureRef.current.id },
                    { hover: false }
                  );
                  lastHoveredFeatureRef.current = null;
                }
                
                // Use setTimeout to check if mouse moved to popup
                setTimeout(() => {
                  if (!popupHovered) {
                    map.current!.getCanvas().style.cursor = '';
                    currentWardRef.current = null;
                    // popup.remove();
                  }
                }, 50);
              });
              
              // Handle popup hover state
              map.current?.on('mousemove', () => {
                const popupEl = document.querySelector('.mapboxgl-popup');
                if (popupEl) {
                  popupEl.addEventListener('mouseenter', () => {
                    popupHovered = true;
                  }, { once: true });
                  
                  popupEl.addEventListener('mouseleave', () => {
                    popupHovered = false;
                    if (map.current) {
                      map.current.getCanvas().style.cursor = '';
                      currentWardRef.current = null;
                      // popup.remove();
                    }
                  }, { once: true });
                }
              });
              
              console.log('Total wards loaded:', combinedData.features.length);
              setLoading(false);
            })
            .catch(err => {
              console.error('Error loading wards:', err);
              setError(`Failed to load ward data: ${err.message}`);
              setLoading(false);
            });
        });

        map.current.on('error', (e) => {
          console.error('Map error:', e);
          setError(`Map error: ${e.error?.message || 'Unknown error'}`);
          setLoading(false);
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError(`Failed to initialize map: ${err}`);
        setLoading(false);
      }
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [wardResults, wardData]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Map Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-lg">Loading map...</div>
        </div>
      )}
      <div className="fixed inset-0 z-100 h-full w-full pointer-events-none">
        <div className="absolute top-2 right-2 pointer-events-auto">
          <div className="bg-[rgba(255,255,255,0.8)] p-[10px] rounded-md backdrop-blur-md shadow-lg">
            <h3 className="font-bold text-sm mb-2">Local Elections 2024</h3>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{backgroundColor: '#DC241f'}}></div>
                <span>Labour</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{backgroundColor: '#0087DC'}}></div>
                <span>Conservative</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{backgroundColor: '#FAA61A'}}></div>
                <span>Liberal Democrat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{backgroundColor: '#6AB023'}}></div>
                <span>Green</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{backgroundColor: '#12B6CF'}}></div>
                <span>Reform</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{backgroundColor: '#CCCCCC'}}></div>
                <span>Independent</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
}