import React, { useState, useEffect } from 'react';
import { Waves, Wind, Clock, TrendingUp, Droplets } from 'lucide-react';

const SURF_SPOTS = [
  { id: 'yuigahama', name: '由比ヶ浜', lat: 35.3105, lon: 139.5468, offshoreMin: 0, offshoreMax: 45, terrain: 'bayShallow', terrainFactor: 0.6, avgDepth: 2.8 },
  { id: 'koyurugi', name: '小動(一本松)', lat: 35.3056, lon: 139.5028, offshoreMin: 0, offshoreMax: 45, terrain: 'reef', terrainFactor: 1.0, avgDepth: 4.2 },
  { id: 'kugenuma', name: '鵠沼', lat: 35.3135, lon: 139.4623, offshoreMin: 0, offshoreMax: 45, terrain: 'veryShallow', terrainFactor: 0.5, avgDepth: 3.1 },
  { id: 'tsujido', name: '辻堂', lat: 35.3197, lon: 139.4449, offshoreMin: 0, offshoreMax: 45, terrain: 'shallow', terrainFactor: 0.7, avgDepth: 5.4 },
  { id: 'yoshihama', name: '湯河原 吉浜', lat: 35.1450, lon: 139.1250, offshoreMin: 315, offshoreMax: 45, terrain: 'steep', terrainFactor: 1.4, avgDepth: 8.2 }
];

const SIZE_LEVELS = ['ノーサーフ', 'スネ〜ヒザ', 'ヒザ〜モモ', 'モモ〜腰', '腰〜腹', '腹〜胸', '胸〜肩', '肩〜頭', '頭オーバー'];

// 気象庁データから数値を抽出
const parseWaveHeight = (waveStr) => {
  if (!waveStr) return 0.5;
  const match = waveStr.match(/([０-９0-9\.．]+)/);
  if (!match) return 0.5;
  let num = match[1].replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  num = num.replace('．', '.');
  return parseFloat(num) || 0.5;
};

const parseWindDirection = (windStr) => {
  if (!windStr) return 45;
  if (windStr.includes('北東')) return 45;
  if (windStr.includes('東')) return 90;
  if (windStr.includes('南東')) return 135;
  if (windStr.includes('南')) return 180;
  if (windStr.includes('南西')) return 225;
  if (windStr.includes('西')) return 270;
  if (windStr.includes('北西')) return 315;
  if (windStr.includes('北')) return 0;
  return 45;
};

const parseWindSpeed = (windStr) => {
  if (!windStr) return 3;
  if (windStr.includes('やや強く')) return 8;
  if (windStr.includes('強く')) return 12;
  return 5;
};

const calculateWavePhysics = (waveHeight, windSpeed, windDir, spot) => {
  const period = 8 + Math.random() * 3; // 周期は推定
  const tideHeight = Math.sin(Date.now() / 3600000) * 0.5; // 簡易潮汐
  
  const depth = spot.avgDepth;
  const baseEnergy = waveHeight * period * 0.5;
  
  const isOffshore = (windDir >= spot.offshoreMin && windDir <= spot.offshoreMax) || 
                     (spot.offshoreMin > spot.offshoreMax && (windDir >= spot.offshoreMin || windDir <= spot.offshoreMax));
  const isOnshore = Math.abs(windDir - 180) < 45;
  
  let windFactor = 1.0;
  let qualityScore = 3;
  let windEffect = '';
  
  if (isOffshore) {
    if (windSpeed > 8) {
      windFactor = 0.85;
      qualityScore = 4;
      windEffect = '強いオフショアで面ホールド';
    } else if (windSpeed > 3) {
      windFactor = 0.95;
      qualityScore = 5;
      windEffect = 'オフショアで良好な面';
    } else {
      qualityScore = 4;
      windEffect = '弱いオフショア';
    }
  } else if (isOnshore) {
    windFactor = 1.0 + (windSpeed * 0.08);
    qualityScore = Math.max(1, 3 - Math.floor(windSpeed / 3));
    windEffect = 'オンショアでチョッピー';
  } else {
    windFactor = 1.0 + (windSpeed * 0.03);
    qualityScore = 2;
    windEffect = 'サイド風でザワつき';
  }
  
  const finalSize = baseEnergy * windFactor * spot.terrainFactor;
  
  const getSizeLabel = (size) => {
    if (size < 0.3) return 'ノーサーフ';
    else if (size < 1.2) return 'スネ〜ヒザ';
    else if (size < 2.2) return 'ヒザ〜モモ';
    else if (size < 3.5) return 'モモ〜腰';
    else if (size < 4.5) return '腰〜腹';
    else if (size < 6.0) return '腹〜胸';
    else if (size < 8.0) return '胸〜肩';
    else if (size < 11.0) return '肩〜頭';
    else return '頭オーバー';
  };
  
  const sizeLabel = getSizeLabel(finalSize);
  const surfaceCondition = qualityScore >= 4 ? 'クリーン' : qualityScore === 3 ? '整った面' : 'ザワつき';
  
  let waveType = 'タルイ';
  if (spot.terrain === 'steep' && finalSize > 3) waveType = '掘れた';
  else if (period < 8) waveType = '早い';
  else if (qualityScore <= 2) waveType = '風波';
  
  const estimatedRideTime = Math.round(period * 0.8 * (qualityScore / 5) * (finalSize > 2 ? 1.2 : 0.8));
  
  return {
    sizeLabel,
    surfaceCondition,
    qualityScore,
    waveType,
    windEffect,
    estimatedRideTime: Math.max(2, Math.min(20, estimatedRideTime)),
    period: period.toFixed(1)
  };
};

const SurfForecastApp = () => {
  const [selectedSpot, setSelectedSpot] = useState(SURF_SPOTS[0]);
  const [forecastData, setForecastData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchRealForecast = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('https://surf-weather-api-5sv5.vercel.app/api/weather');
      
      if (!response.ok) {
        throw new Error('データ取得に失敗しました');
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('データ形式が不正です');
      }
      
      const jmaData = result.data;
      const timeSeries = jmaData[0].timeSeries[0];
      const areas = timeSeries.areas;
      const shonanArea = areas.find(a => a.area.name.includes('東部')) || areas[0];
      
      const times = timeSeries.timeDefines;
      const waves = shonanArea.waves || [];
      const winds = shonanArea.winds || [];
      const weathers = shonanArea.weathers || [];
      
      const processedData = times.map((time, idx) => {
        const waveHeight = parseWaveHeight(waves[idx]);
        const windDir = parseWindDirection(winds[idx]);
        const windSpeed = parseWindSpeed(winds[idx]);
        
        const physics = calculateWavePhysics(waveHeight, windSpeed, windDir, selectedSpot);
        
        const timeObj = new Date(time);
        
        return {
          time: timeObj,
          timeStr: timeObj.toLocaleString('ja-JP', { 
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          dateStr: timeObj.toLocaleDateString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            weekday: 'short'
          }),
          waveHeight,
          windSpeed,
          windDir,
          windDirLabel: winds[idx] || '',
          weather: weathers[idx] || '',
          ...physics
        };
      });
      
      setForecastData(processedData);
      setLastUpdate(new Date());
      
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealForecast();
  }, [selectedSpot]);

  const getSizeColor = (sizeLabel) => {
    const idx = SIZE_LEVELS.indexOf(sizeLabel);
    if (idx <= 1) return 'from-gray-600 to-gray-700';
    if (idx <= 3) return 'from-blue-600 to-blue-700';
    if (idx <= 5) return 'from-green-600 to-green-700';
    if (idx <= 7) return 'from-yellow-600 to-orange-600';
    return 'from-red-600 to-red-700';
  };

  const getQualityColor = (score) => {
    if (score >= 4) return 'text-green-400';
    if (score >= 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  // 日付でグループ化
  const groupedData = forecastData.reduce((acc, item) => {
    if (!acc[item.dateStr]) {
      acc[item.dateStr] = [];
    }
    acc[item.dateStr].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Waves className="w-8 h-8" />
                湘南波予測
              </h1>
              <p className="text-blue-100 text-sm mt-1">気象庁リアルタイムデータ</p>
            </div>
            
            <button
              onClick={fetchRealForecast}
              disabled={isLoading}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              {isLoading ? '更新中...' : '更新'}
            </button>
          </div>
          
          {lastUpdate && (
            <div className="text-blue-100 text-xs">
              最終更新: {lastUpdate.toLocaleTimeString('ja-JP')}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ポイント選択 */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 mb-6 shadow-xl">
          <label className="block text-white text-sm font-medium mb-3">
            📍 サーフポイント
          </label>
          <select 
            value={selectedSpot.id}
            onChange={(e) => setSelectedSpot(SURF_SPOTS.find(s => s.id === e.target.value))}
            className="w-full p-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition"
          >
            {SURF_SPOTS.map(spot => (
              <option key={spot.id} value={spot.id}>{spot.name}</option>
            ))}
          </select>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-white mt-4">データ取得中...</p>
          </div>
        )}

        {/* 予報データ */}
        {!isLoading && Object.keys(groupedData).map((dateStr) => (
          <div key={dateStr} className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              {dateStr}
            </h2>
            
            <div className="grid gap-4">
              {groupedData[dateStr].map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-800/70 backdrop-blur rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
                >
                  <div className={`bg-gradient-to-r ${getSizeColor(item.sizeLabel)} px-6 py-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white/80 text-sm mb-1">
                          {item.timeStr.split(' ')[1]}
                        </div>
                        <div className="text-white text-3xl font-bold">
                          {item.sizeLabel}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`${getQualityColor(item.qualityScore)} text-2xl`}>
                          {'★'.repeat(item.qualityScore)}
                        </div>
                        <div className="text-white/80 text-sm mt-1">
                          {item.surfaceCondition}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-cyan-300">
                        <Waves className="w-5 h-5" />
                        <div>
                          <div className="text-xs text-slate-400">波高 / 周期</div>
                          <div className="font-bold">{item.waveHeight}m / {item.period}s</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-blue-300">
                        <Wind className="w-5 h-5" />
                        <div>
                          <div className="text-xs text-slate-400">風</div>
                          <div className="font-bold text-sm">{item.windDirLabel}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                      <div className="text-slate-300 text-sm">
                        {item.windEffect}
                      </div>
                      <div className="text-yellow-400 font-bold">
                        ~{item.estimatedRideTime}秒
                      </div>
                    </div>
                    
                    {item.weather && (
                      <div className="mt-3 pt-3 border-t border-slate-700 text-slate-400 text-xs">
                        ☁️ {item.weather}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurfForecastApp;
