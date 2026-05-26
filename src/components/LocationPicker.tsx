import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Search, Navigation, Info } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

let globalHasError = false;
const errorListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  const originalFailure = (window as any).gm_authFailure;
  (window as any).gm_authFailure = () => {
    console.warn("Google Maps API Authentication/Activation error detected globally.");
    globalHasError = true;
    errorListeners.forEach(l => l());
    if (typeof originalFailure === 'function') {
      originalFailure();
    }
  };
}

interface LocationPickerProps {
  onLocationSelect: (location: string, coords: { lat: number; lng: number }) => void;
  initialCoords?: { lat: number; lng: number };
  initialLocation?: string;
}

export default function LocationPicker({ onLocationSelect, initialCoords, initialLocation }: LocationPickerProps) {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(initialCoords || { lat: 37.5665, lng: 126.9780 }); // Defaults to Seoul
  const [address, setAddress] = useState(initialLocation || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [mapHasAuthError, setMapHasAuthError] = useState(globalHasError);
  const [manualLat, setManualLat] = useState(initialCoords?.lat?.toString() || '37.5665');
  const [manualLng, setManualLng] = useState(initialCoords?.lng?.toString() || '126.9780');

  useEffect(() => {
    const handler = () => {
      setMapHasAuthError(true);
    };
    errorListeners.add(handler);
    return () => {
      errorListeners.delete(handler);
    };
  }, []);

  const handleManualSave = () => {
    const latNum = parseFloat(manualLat);
    const lngNum = parseFloat(manualLng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('위도와 경도는 올바른 수치 형태여야 합니다.');
      return;
    }
    const coords = { lat: latNum, lng: lngNum };
    setSelectedCoords(coords);
    onLocationSelect(address, coords);
  };

  if (!hasValidKey) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
          <Info className="w-6 h-6 text-blue-500" />
        </div>
        <div className="space-y-1">
          <h3 className="font-black text-slate-900 dark:text-white">Google Maps API 키가 필요합니다</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-sm">
            지도로 위치를 정확하게 설정하려면 설정에서 GOOGLE_MAPS_PLATFORM_KEY를 등록해 주세요.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-[10px] space-y-2 w-full max-w-md">
          <p className="font-bold">방법:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-500 font-semibold">
            <li>우측 상단 ⚙️ 아이콘 클릭 (Settings)</li>
            <li>Secrets 탭에서 GOOGLE_MAPS_PLATFORM_KEY 추가</li>
            <li>키 값 입력 후 저장</li>
          </ol>
        </div>
      </div>
    );
  }

  if (isManualMode || mapHasAuthError) {
    return (
      <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            직접 주소 및 좌표 입력 모드
          </span>
          {!mapHasAuthError && (
            <button 
              type="button"
              onClick={() => setIsManualMode(false)}
              className="text-[10px] font-black text-blue-600 hover:underline"
            >
              지도 모드로 돌아가기
            </button>
          )}
        </div>

        {mapHasAuthError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 space-y-1 font-semibold leading-relaxed">
            <p className="font-extrabold text-xs text-rose-800 dark:text-rose-200">⚠️ Google Maps API Key 미활성화 감지 (ApiNotActivatedMapError)</p>
            <p className="text-[10px] text-rose-600 dark:text-rose-450 leading-relaxed">
              입력하신 구글 지도 키에 <strong>"Maps JavaScript API"</strong> 및 <strong>"Places API"</strong> 서비스가 활성화(Activated) 되어 있지 않습니다.
              구글 클라우드 콘솔의 해당 프로젝트에서 주소 검색 및 지도를 위해 API 라이브러리를 활성화 및 결제 프로필을 등록해 주세요. (반영에 약 5~10분이 소요됩니다.)
              <br/>
              그동안은 아래의 <strong>직접 입력 필드</strong>를 이용해 현장 위치명과 기상 정보 수집용 위/경도를 수동 지정할 수 있습니다.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">현장 주소</label>
            <input 
              type="text" 
              value={address} 
              onChange={(e) => {
                setAddress(e.target.value);
                onLocationSelect(e.target.value, selectedCoords || { lat: 37.5665, lng: 126.9780 });
              }}
              placeholder="예: 경기도 김포시 북변동 380-8" 
              className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">위도 (Latitude)</label>
              <input 
                type="text" 
                value={manualLat} 
                onChange={(e) => {
                  setManualLat(e.target.value);
                  const latVal = parseFloat(e.target.value);
                  if (!isNaN(latVal)) {
                    const coords = { lat: latVal, lng: parseFloat(manualLng) || 126.9780 };
                    setSelectedCoords(coords);
                    onLocationSelect(address, coords);
                  }
                }}
                placeholder="37.5665" 
                className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">경도 (Longitude)</label>
              <input 
                type="text" 
                value={manualLng} 
                onChange={(e) => {
                  setManualLng(e.target.value);
                  const lngVal = parseFloat(e.target.value);
                  if (!isNaN(lngVal)) {
                    const coords = { lat: parseFloat(manualLat) || 37.5665, lng: lngVal };
                    setSelectedCoords(coords);
                    onLocationSelect(address, coords);
                  }
                }}
                placeholder="126.9780" 
                className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">※ 위도와 경도는 실시간 기상 위젯을 위해 정확한 소수값(예: 37.6412, 126.7143)으로 입력하시는 것을 추천합니다.</p>
        </div>

        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-[10px] space-y-1">
          <p className="font-bold text-indigo-800 dark:text-indigo-300">💡 Google Cloud Console 설정 팁</p>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
            Google Maps API Key에 "Maps JavaScript API" 및 "Geocoding API", "Places API" 라이브러리 상태를 <strong>사용(ON)</strong>으로 전환해 주셔야 지도와 자동 완성 기능이 원활히 동작합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <AutocompleteInput 
              onPlaceSelect={(place) => {
                if (place.location && place.displayName) {
                  const lat = place.location.lat();
                  const lng = place.location.lng();
                  const coords = { lat, lng };
                  setSelectedCoords(coords);
                  setAddress(place.formattedAddress || place.displayName || '');
                  onLocationSelect(place.formattedAddress || place.displayName || '', coords);
                  setManualLat(lat.toString());
                  setManualLng(lng.toString());
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsManualMode(true)}
            className="text-[10px] font-black text-rose-650 hover:underline whitespace-nowrap pt-1 sm:pt-0"
          >
            지도가 안 보이나요? 직접 주소 입력하기
          </button>
        </div>

        <div className="h-[300px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
          <Map
            defaultCenter={selectedCoords || { lat: 37.5665, lng: 126.9780 }}
            defaultZoom={15}
            mapId="LOCATION_PICKER_MAP"
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            onClick={(e) => {
              if (e.detail.latLng) {
                const coords = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
                setSelectedCoords(coords);
                // Reverse geocode would be nice, but for now we update coords
                // We'll use a component that handles geocoding or just mark the spot
              }
            }}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          >
            {selectedCoords && (
              <AdvancedMarker position={selectedCoords} />
            )}
            <MapEventsHandler onLocationUpdate={(addr, coords) => {
               setAddress(addr);
               setSelectedCoords(coords);
               onLocationSelect(addr, coords);
            }} />
          </Map>
          
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl flex items-center gap-3">
             <div className="p-2 bg-blue-500 rounded-lg">
                <MapPin className="w-4 h-4 text-white" />
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase">선택된 위치</p>
                <p className="text-xs font-black truncate">{address || '지도를 클릭하여 위치를 선택하세요'}</p>
             </div>
          </div>
        </div>
      </div>
    </APIProvider>
  );
}

function AutocompleteInput({ onPlaceSelect }: { onPlaceSelect: (place: google.maps.places.Place) => void }) {
  const placesLib = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    autocompleteService.current = new placesLib.AutocompleteService();
  }, [placesLib]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (!val) {
      setSuggestions([]);
      return;
    }

    autocompleteService.current?.getPlacePredictions(
      { input: val, componentRestrictions: { country: 'kr' } },
      (predictions, status) => {
        if (status === 'OK' && predictions) {
          setSuggestions(predictions);
          setShowSuggestions(true);
        }
      }
    );
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    setInputValue(prediction.description);
    setShowSuggestions(false);
    
    // Get details for the selected place
    const div = document.createElement('div');
    const service = new google.maps.places.PlacesService(div);
    service.getDetails({ placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'name'] }, (place, status) => {
      if (status === 'OK' && place && place.geometry && place.geometry.location) {
        onPlaceSelect({
          location: place.geometry.location,
          displayName: place.name || '',
          formattedAddress: place.formatted_address || '',
        } as any);
      }
    });
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => inputValue && setShowSuggestions(true)}
        placeholder="현장 주소 또는 건물명 검색..."
        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-300"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => handleSelect(s)}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none flex items-start gap-3"
            >
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-black">{s.structured_formatting.main_text}</p>
                <p className="text-[10px] text-slate-500 font-bold">{s.structured_formatting.secondary_text}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MapEventsHandler({ onLocationUpdate }: { onLocationUpdate: (address: string, coords: { lat: number; lng: number }) => void }) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');

  useEffect(() => {
    if (!map || !geocodingLib) return;

    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        const geocoder = new geocodingLib.Geocoder();
        geocoder.geocode({ location: e.latLng }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            onLocationUpdate(results[0].formatted_address, coords);
          } else {
             onLocationUpdate(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`, coords);
          }
        });
      }
    });

    return () => google.maps.event.removeListener(listener);
  }, [map, geocodingLib]);

  return null;
}
