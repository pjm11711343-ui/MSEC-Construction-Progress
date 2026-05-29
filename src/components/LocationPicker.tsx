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

  // Intercept console.error to catch specific Google Maps activation errors
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const errorStrings = args.map(arg => {
      if (arg instanceof Error) {
        return arg.message + ' ' + (arg.stack || '');
      }
      if (arg && typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    });
    const errorMsg = errorStrings.join(' ');
    const lowerMsg = errorMsg.toLowerCase();
    if (
      lowerMsg.includes('apinotactivatedmaperror') || 
      lowerMsg.includes('billingnotenabledmaperror') ||
      lowerMsg.includes('invalidkeymaperror') ||
      lowerMsg.includes('deletedkeymaperror') ||
      lowerMsg.includes('notactivated') ||
      lowerMsg.includes('api-not-activated') ||
      lowerMsg.includes('google maps javascript api error') ||
      lowerMsg.includes('maperror')
    ) {
      globalHasError = true;
      errorListeners.forEach(l => l());
      // Return early to silence console.error telemetry since we already handle this with custom in-app fallbacks
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Catch unhandled promise rejections which can happen when loading maps fails
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMsg = reason instanceof Error ? (reason.message + ' ' + (reason.stack || '')) : String(reason);
    const lowerMsg = errorMsg.toLowerCase();
    if (
      lowerMsg.includes('apinotactivatedmaperror') || 
      lowerMsg.includes('billingnotenabledmaperror') ||
      lowerMsg.includes('invalidkeymaperror') ||
      lowerMsg.includes('deletedkeymaperror') ||
      lowerMsg.includes('notactivated') ||
      lowerMsg.includes('api-not-activated') ||
      lowerMsg.includes('google maps javascript api error')
    ) {
      globalHasError = true;
      errorListeners.forEach(l => l());
      // Prevent browser default unhandled rejection display
      event.preventDefault();
    }
  });

  // Catch generic script errors that often happen when Google Maps fails to load cross-origin
  window.addEventListener('error', (event) => {
    // If we have an API key and the script load failed, it's likely the cause
    if (event.message === 'Script error.' || (event.target as any)?.src?.includes('maps.googleapis')) {
      // We don't want to trigger this for EVERY script error, 
      // but if we are in the middle of loading maps it's a good hint
      if (hasValidKey) {
        console.warn("Generic script error detected, possibly related to Google Maps load failure.");
        // Prevent default error handling
        event.preventDefault();
        // We give it a small delay to see if more specific errors are caught
        setTimeout(() => {
          globalHasError = true;
          errorListeners.forEach(l => l());
        }, 500);
      }
    }
  }, true);
}

class LocalErrorBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { onError: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error("ErrorBoundary caught maps rendering error:", error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface LocationPickerProps {
  onLocationSelect: (location: string, coords: { lat: number; lng: number }) => void;
  initialCoords?: { lat: number; lng: number };
  initialLocation?: string;
  theme?: string;
}

export default function LocationPicker({ onLocationSelect, initialCoords, initialLocation, theme = 'slate' }: LocationPickerProps) {
  const isIndustrial = theme === 'industrial';
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
      <div className={`rounded-2xl p-6 border-2 border-dashed flex flex-col items-center justify-center text-center space-y-4 ${
        isIndustrial ? 'bg-slate-800/10 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}>
        <div className="p-3 bg-blue-50/55 rounded-full">
          <Info className="w-6 h-6 text-blue-500" />
        </div>
        <div className="space-y-1">
          <h3 className={`font-black ${isIndustrial ? 'text-white' : 'text-slate-800'}`}>Google Maps API 키가 필요합니다</h3>
          <p className={`text-xs font-bold max-w-sm ${isIndustrial ? 'text-slate-400' : 'text-slate-500'}`}>
            지도로 위치를 정확하게 설정하려면 설정에서 GOOGLE_MAPS_PLATFORM_KEY를 등록해 주세요.
          </p>
        </div>
        <div className={`p-4 rounded-xl border text-left text-[10px] space-y-2 w-full max-w-md ${
          isIndustrial ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
        }`}>
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
      <div className={`space-y-4 p-5 rounded-2xl border ${
        isIndustrial ? 'bg-slate-800/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}>
        <div className={`flex justify-between items-center pb-2 border-b ${
          isIndustrial ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <span className={`text-xs font-black flex items-center gap-1.5 ${
            isIndustrial ? 'text-slate-200' : 'text-slate-700'
          }`}>
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            직접 주소 및 좌표 입력 모드
          </span>
          {!mapHasAuthError && (
            <button 
              type="button"
              onClick={() => setIsManualMode(false)}
              className="text-[10px] font-black text-blue-600 hover:text-blue-700 hover:underline"
            >
              지도 모드로 돌아가기
            </button>
          )}
        </div>

        {mapHasAuthError && (
          <div className={`p-3.5 rounded-xl border text-[11px] space-y-1 font-semibold leading-relaxed ${
            isIndustrial ? 'bg-rose-950/20 border-rose-900/40 text-rose-300' : 'bg-rose-50 border-rose-100 text-rose-700'
          }`}>
            <p className={`font-extrabold text-xs ${isIndustrial ? 'text-rose-200' : 'text-rose-800'}`}>⚠️ Google Maps API 서비스 미활성화 감지</p>
            <p className={`text-[10px] leading-relaxed ${isIndustrial ? 'text-rose-400' : 'text-rose-600'}`}>
              입력하신 API 키의 <strong>"Maps JavaScript API"</strong> 서비스가 구글 클라우드 콘솔에서 활성화되어 있지 않거나 결제 계정이 연결되어 있지 않습니다.
              <br/>
              <br/>
              <strong>해결 방법:</strong>
              <br/>
              1. <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-black hover:opacity-80">Google Cloud Console</a> 접속
              <br/>
              2. <strong>'API 및 서비스 &gt; 라이브러리'</strong> 메뉴에서 <strong>"Maps JavaScript API"</strong> 검색 후 <strong>[사용]</strong> 클릭
              <br/>
              3. <strong>"Places API"</strong> 및 <strong>"Geocoding API"</strong>도 동일하게 활성화 (반영까지 5~10분 소요)
              <br/>
              <br/>
              그동안은 아래 필드를 통해 <strong>수동으로 위치를 지정</strong>할 수 있습니다.
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
              className={`w-full p-3 rounded-xl border text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                isIndustrial 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
              }`}
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
                className={`w-full p-3 rounded-xl border text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                 isIndustrial 
                   ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                   : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
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
                className={`w-full p-3 rounded-xl border text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                 isIndustrial 
                   ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                   : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium font-bold">※ 위도와 경도는 실시간 기상 위젯을 위해 정확한 소수값(예: 37.6412, 126.7143)으로 입력하시는 것을 추천합니다.</p>
        </div>

        <div className={`p-3 rounded-xl border text-[10px] space-y-1 ${
          isIndustrial ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50 border-indigo-100'
        }`}>
          <p className={`font-bold ${isIndustrial ? 'text-indigo-300' : 'text-indigo-800'}`}>💡 Google Cloud Console 설정 팁</p>
          <p className={`leading-relaxed font-semibold ${isIndustrial ? 'text-slate-400' : 'text-slate-600'}`}>
            Google Maps API Key에 "Maps JavaScript API" 및 "Geocoding API", "Places API" 라이브러리 상태를 <strong>사용(ON)</strong>으로 전환해 주셔야 지도와 자동 완성 기능이 원활히 동작합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LocalErrorBoundary onError={() => setMapHasAuthError(true)}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <AutocompleteInput 
                theme={theme}
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
              className="text-[10px] font-black text-rose-500 hover:text-rose-600 hover:underline whitespace-nowrap pt-1 sm:pt-0"
            >
              지도가 안 보이나요? 직접 주소 입력하기
            </button>
          </div>

          <div className={`h-[300px] w-full rounded-2xl overflow-hidden border relative ${
            isIndustrial ? 'border-slate-700' : 'border-slate-200'
          }`}>
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
            
            <div className={`absolute bottom-4 left-4 right-4 backdrop-blur-sm p-3 rounded-xl border shadow-xl flex items-center gap-3 ${
              isIndustrial 
                ? 'bg-[#1a1d23]/90 border-slate-700 text-white' 
                : 'bg-white/95 border-slate-200 text-slate-900'
            }`}>
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
    </LocalErrorBoundary>
  );
}

function AutocompleteInput({ onPlaceSelect, theme = 'slate' }: { onPlaceSelect: (place: google.maps.places.Place) => void; theme?: string }) {
  const placesLib = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const isIndustrial = theme === 'industrial';

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
        className={`w-full border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
          isIndustrial 
            ? 'bg-slate-800 text-white placeholder-slate-500' 
            : 'bg-slate-100 text-slate-900 placeholder-slate-400'
        }`}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl z-50 overflow-hidden ${
          isIndustrial ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => handleSelect(s)}
              className={`w-full px-4 py-3 text-left transition-colors border-b last:border-none flex items-start gap-3 ${
                isIndustrial 
                  ? 'hover:bg-slate-800 border-slate-700' 
                  : 'hover:bg-slate-50 border-slate-100'
              }`}
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
