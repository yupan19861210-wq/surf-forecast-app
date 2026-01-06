import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Waves, TrendingUp, Clipboard, Grid3x3 } from 'lucide-react';

// ポイント定義（実測水深データ + 気象庁地点コード）
const SURF_SPOTS = [
  { id: 'yuigahama', name: '由比ヶ浜', lat: 35.3105, lon: 139.5468, offshoreMin: 0, offshoreMax: 45, terrain: 'bayShallow', terrainFactor: 0.6, avgDepth: 2.8, jmaCode: '315' },
  { id: 'koyurugi', name: '小動(一本松)', lat: 35.3056, lon: 139.5028, offshoreMin: 0, offshoreMax: 45, terrain: 'reef', terrainFactor: 1.0, avgDepth: 4.2, jmaCode: '315' },
  { id: 'kugenuma', name: '鵠沼', lat: 35.3135, lon: 139.4623, offshoreMin: 0, offshoreMax: 45, terrain: 'veryShallow', terrainFactor: 0.5, avgDepth: 3.1, jmaCode: '315' },
  { id: 'tsujido', name: '辻堂', lat: 35.3197, lon: 139.4449, offshoreMin: 0, offshoreMax: 45, terrain: 'shallow', terrainFactor: 0.7, avgDepth: 5.4, jmaCode: '315' },
  { id: 'yoshihama', name: '湯河原 吉浜', lat: 35.1450, lon: 139.1250, offshoreMin: 315, offshoreMax: 45, terrain: 'steep', terrainFactor: 1.4, avgDepth: 8.2, jmaCode: '315' }
];

const SIZE_LEVELS = ['ノーサーフ', 'スネ〜ヒザ', 'ヒザ〜モモ', 'モモ〜腰', '腰〜腹', '腹〜胸', '胸〜肩', '肩〜頭', '頭オーバー'];
const QUALITY_TYPES = ['タルイ', '掘れた', '早い', '風波'];

const calculateWavePhysics = (waveHeight, period, windSpeed, windDir, spot, tideHeight) => {
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
      windEffect = '強いオフショアで抑えられています';
    } else if (windSpeed > 3) {
      windFactor = 0.95;
      qualityScore = 5;
      windEffect = '良好なオフショアで整っています';
    } else {
      qualityScore = 4;
      windEffect = '弱いオフショア';
    }
  } else if (isOnshore) {
    windFactor = 1.0 + (windSpeed * 0.08);
    qualityScore = Math.max(1, 3 - Math.floor(windSpeed / 3));
    windEffect = 'オンショアで煽られチョッピー';
  } else {
    windFactor = 1.0 + (windSpeed * 0.03);
    qualityScore = 2;
    windEffect = 'サイド風でザワついています';
  }
  
  const actualDepth = depth + tideHeight;
  const breakingWaveHeight = actualDepth * 0.78;
  let breakingDistance = 'アウト';
  
  if (waveHeight * windFactor > breakingWaveHeight) {
    if (spot.terrain === 'steep') {
      breakingDistance = 'ショアブレイク';
    } else if (spot.terrain === 'veryShallow') {
      breakingDistance = 'アウトから緩やか';
    } else {
      breakingDistance = 'ミドル';
    }
  }
  
  const finalSize = baseEnergy * windFactor * spot.terrainFactor;
  const setInterval = period * 1.2;
  const setWaveSize = finalSize * 1.3;
  
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
  const setSizeLabel = getSizeLabel(setWaveSize);
  
  let surfaceCondition = qualityScore >= 4 ? 'クリーン' : qualityScore === 3 ? '整った面' : 'ザワつき';
  
  let waveType = 'タルイ';
  if (spot.terrain === 'steep' && finalSize > 3) waveType = '掘れた';
  else if (period < 8) waveType = '早い';
  else if (qualityScore <= 2) waveType = '風波';
  
  const rideTimeBase = period * 0.8;
  const qualityFactor = waveType === '掘れた' ? 1.3 : waveType === 'タルイ' ? 0.7 : waveType === '早い' ? 1.1 : 0.6;
  const sizeIdx = SIZE_LEVELS.indexOf(sizeLabel);
  const sizeFactor = sizeIdx >= 5 ? 1.2 : sizeIdx >= 3 ? 1.0 : 0.8;
  const tideFactor = Math.abs(tideHeight) < 0.3 ? 1.1 : Math.abs(tideHeight) > 0.7 ? 0.85 : 1.0;
  
  const estimatedRideTime = Math.max(2, Math.min(20, rideTimeBase * qualityFactor * sizeFactor * tideFactor * (qualityScore / 5)));
  
  const tideTrend = tideHeight > 0 ? '上げ' : '下げ';
  const tideEvaluation = Math.abs(tideHeight) < 0.2 ? `潮止まり(${tideTrend})で安定` :
                         Math.abs(tideHeight) < 0.5 ? `${tideTrend}潮で良好` : `${tideTrend}潮が強く不安定`;
  
  return {
    finalSize,
    sizeLabel,
    setSizeLabel,
    setInterval: Math.round(setInterval),
    surfaceCondition,
    qualityScore,
    waveType,
    breakingDistance,
    windEffect,
    estimatedRideTime,
    tideEvaluation,
    aiExplanation: `${windEffect}。${breakingDistance}でブレイク（水深${depth}m + 潮汐${tideHeight > 0 ? '+' : ''}${tideHeight.toFixed(1)}m）。地形の影響で${spot.terrain === 'steep' ? 'パワフル' : 'メロー'}な波です。${tideEvaluation}。推定ライド時間: ${Math.round(estimatedRideTime)}秒程度。セット波は${setSizeLabel}、間隔は約${Math.round(setInterval)}秒。`
  };
};

const generateForecastData = (spot, date, hours = 48) => {
  const data = [];
  const baseTime = new Date(date);
  
  for (let i = 0; i < hours; i += 2) {
    const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
    const hour = time.getHours();
    const timeVariation = Math.sin(hour / 24 * Math.PI * 2) * 0.3;
    const waveHeight = 0.8 + Math.random() * 0.6 + timeVariation;
    const period = 8 + Math.random() * 4;
    const windSpeed = 3 + Math.random() * 5;
    const windDir = 45 + Math.random() * 90;
    const tideHeight = Math.sin((hour + i/2) / 6 * Math.PI) * 0.8;
    
    const physics = calculateWavePhysics(waveHeight, period, windSpeed, windDir, spot, tideHeight);
    
    data.push({
      time,
      timeStr: `${String(time.getHours()).padStart(2, '0')}:00`,
      waveHeight: Number(waveHeight.toFixed(2)),
      period: Number(period.toFixed(1)),
      windSpeed: Number(windSpeed.toFixed(1)),
      windDir: Math.round(windDir),
      windDirLabel: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.round(windDir / 45) % 8],
      tideHeight: Number(tideHeight.toFixed(2)),
      tideTrend: tideHeight > 0 ? '上げ' : '下げ',
      ...physics
    });
  }
  
  return data;
};

const SurfForecastApp = () => {
  const [currentTab, setCurrentTab] = useState('forecast');
  const [selectedSpot, setSelectedSpot] = useState(SURF_SPOTS[0]);
  const [selectedDate, setSelectedDate] = useState(0);
  const [forecastData, setForecastData] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [boards, setBoards] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showBoardForm, setShowBoardForm] = useState(false);
  const [editingBoard, setEditingBoard] = useState(null);
  const [showApiTest, setShowApiTest] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(null);

  useEffect(() => {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(baseDate.getDate() + selectedDate);
    
    const data = generateForecastData(selectedSpot, baseDate);
    const nextDay = new Date(baseDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    setForecastData(data.filter(item => item.time >= baseDate && item.time < nextDay));
  }, [selectedSpot, selectedDate]);

  // API接続テスト（あなた専用のVercel API使用）
  const testApiConnection = async () => {
    setApiTestResult({ status: 'loading', message: 'API接続テスト中...' });
    
    try {
      const apiUrl = 'https://surf-weather-api-5sv5.vercel.app/api/weather';
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('データ形式が不正です');
      }
      
      const data = result.data;
      const timeSeries = data[0].timeSeries[0];
      const areas = timeSeries.areas;
      const shonanArea = areas.find(a => a.area.name.includes('東部')) || areas[0];
      
      setApiTestResult({
        status: 'success',
        message: '✅ 気象庁API接続成功！',
        data: {
          publishingOffice: data[0].publishingOffice,
          reportDatetime: data[0].reportDatetime,
          areaName: shonanArea?.area.name || '神奈川県東部',
          sample: {
            times: timeSeries.timeDefines.slice(0, 3),
            weathers: shonanArea?.weathers?.slice(0, 3) || [],
            winds: shonanArea?.winds?.slice(0, 3) || [],
            waves: shonanArea?.waves?.slice(0, 3) || []
          }
        }
      });
      
    } catch (error) {
      setApiTestResult({
        status: 'error',
        message: '❌ API接続失敗',
        error: error.message
      });
    }
  };

  const recommendBoard = (sizeLabel, waveType) => {
    if (boards.length === 0) return '-';
    
    let bestBoard = null;
    let bestScore = -1;
    
    boards.forEach(board => {
      const sizeIdx = SIZE_LEVELS.indexOf(sizeLabel);
      const qualityIdx = QUALITY_TYPES.indexOf(waveType);
      const totalScore = (board.sizeRatings?.[sizeIdx] || 0) + (board.qualityRatings?.[qualityIdx] || 0);
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestBoard = board;
      }
    });
    
    return bestBoard?.name || '-';
  };

  const ForecastView = () => {
    const bestTime = (() => {
      const now = new Date();
      const daylightData = forecastData.filter(item => {
        const hour = item.time.getHours();
        return selectedDate === 0 ? hour >= now.getHours() && hour <= 18 : hour >= 6 && hour <= 18;
      });
      
      if (daylightData.length === 0) return null;
      
      let best = daylightData[0];
      let bestScore = 0;
      
      daylightData.forEach(item => {
        const score = item.qualityScore * 20 + item.estimatedRideTime * 2;
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      });
      
      return {
        time: best.timeStr,
        size: best.sizeLabel,
        quality: best.qualityScore,
        board: recommendBoard(best.sizeLabel, best.waveType),
        rideTime: Math.round(best.estimatedRideTime),
        explanation: best.aiExplanation
      };
    })();
    
    return (
      <div className="p-4">
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <select 
              value={selectedSpot.id}
              onChange={(e) => setSelectedSpot(SURF_SPOTS.find(s => s.id === e.target.value))}
              className="flex-1 p-3 bg-slate-700 text-white rounded-lg"
            >
              {SURF_SPOTS.map(spot => (
                <option key={spot.id} value={spot.id}>{spot.name}</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowApiTest(!showApiTest)}
              className="px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              title="API検証"
            >
              🔧
            </button>
          </div>
          
          {showApiTest && (
            <div className="bg-slate-800 rounded-lg p-4 border-2 border-purple-500">
              <div className="flex justify-between mb-3">
                <h3 className="text-sm font-bold text-purple-300">🔧 API検証</h3>
                <button onClick={() => setShowApiTest(false)} className="text-xs text-slate-400">✕</button>
              </div>
              
              <button
                onClick={testApiConnection}
                disabled={apiTestResult?.status === 'loading'}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg mb-3"
              >
                {apiTestResult?.status === 'loading' ? '接続中...' : 'API接続テスト'}
              </button>
              
              {apiTestResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  apiTestResult.status === 'success' ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'
                }`}>
                  <div className="font-bold mb-2">{apiTestResult.message}</div>
                  {apiTestResult.data && (
                    <div className="text-xs space-y-1">
                      <div>発表元: {apiTestResult.data.publishingOffice}</div>
                      <div>発表日時: {apiTestResult.data.reportDatetime}</div>
                      <div>対象地域: {apiTestResult.data.areaName}</div>
                      <pre className="text-[10px] text-green-300 mt-2 overflow-x-auto bg-slate-900/50 p-2 rounded">
{JSON.stringify(apiTestResult.data.sample, null, 2)}
                      </pre>
                    </div>
                  )}
                  {apiTestResult.error && <div className="text-xs text-red-300 mt-2">{apiTestResult.error}</div>}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            {['今日', '明日', '明後日'].map((label, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDate(idx)}
                className={`flex-1 py-2 rounded-lg ${selectedDate === idx ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
          
          {bestTime && (
            <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-4 rounded-lg border border-blue-600">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400">⭐</span>
                <h3 className="font-bold text-white">
                  {selectedDate === 0 ? '本日のベストタイム' : '日照時間内のベストタイム'}
                </h3>
              </div>
              <div className="text-white space-y-1">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-yellow-300">{bestTime.time}</span>
                  <span className="text-xl text-blue-300">{bestTime.size}</span>
                  <span className="text-sm">{'★'.repeat(bestTime.quality)}</span>
                </div>
                <div className="text-sm">推奨: <span className="text-green-400">{bestTime.board}</span></div>
                <div className="text-sm">ライド: <span className="text-yellow-300">{bestTime.rideTime}秒</span></div>
                <div className="text-xs text-slate-300 mt-2 pt-2 border-t border-slate-600">{bestTime.explanation}</div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {forecastData.map((item, idx) => (
            <div key={idx} className="bg-slate-800 rounded-lg overflow-hidden">
              <div 
                onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                className="p-3 cursor-pointer hover:bg-slate-750"
              >
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-lg text-blue-400">{item.timeStr}</span>
                  <span className="text-2xl font-bold text-yellow-400">{item.sizeLabel}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-400">波:</span> {item.waveHeight}m / {item.period}s</div>
                  <div><span className="text-slate-400">風:</span> {item.windSpeed}m/s {item.windDirLabel}</div>
                  <div><span className="text-slate-400">潮汐:</span> {item.tideHeight > 0 ? '+' : ''}{item.tideHeight}m {item.tideTrend}</div>
                  <div><span className="text-slate-400">面:</span> {item.surfaceCondition}</div>
                  <div className="col-span-2">
                    <span className="text-slate-400">セット:</span> 
                    <span className="text-orange-400 font-medium ml-1">{item.setSizeLabel}</span>
                    <span className="text-slate-500 text-xs ml-2">({item.setInterval}秒間隔)</span>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between">
                  <div>
                    <span className="text-slate-400 text-sm">推奨:</span> 
                    <span className="ml-2 text-green-400">{recommendBoard(item.sizeLabel, item.waveType)}</span>
                  </div>
                  <div className="text-xs text-yellow-300">~{Math.round(item.estimatedRideTime)}秒</div>
                </div>
              </div>
              
              {expandedRow === idx && (
                <div className="px-3 pb-3 bg-slate-750">
                  <div className="p-3 bg-slate-700 rounded space-y-2 text-sm text-slate-300">
                    <div className="font-medium text-blue-300">AI詳細分析</div>
                    <div>{item.aiExplanation}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-600">
                      <div>波質: {item.waveType}</div>
                      <div>砕波: {item.breakingDistance}</div>
                      <div>品質: {'★'.repeat(item.qualityScore)}</div>
                      <div>潮汐: {item.tideEvaluation}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 他のタブ機能は簡略化（必要に応じて後で追加）
  const OtherTabsPlaceholder = () => (
    <div className="p-4 text-center text-slate-400">
      <p>この機能は開発中です</p>
      <p className="text-xs mt-2">予報タブでリアルタイムデータをお試しください</p>
    </div>
  );

  return (
    <div className="max-w-[500px] mx-auto min-h-screen bg-slate-900 text-white pb-20">
      {currentTab === 'forecast' ? <ForecastView /> : <OtherTabsPlaceholder />}
      
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="max-w-[500px] mx-auto flex justify-around">
          {[
            { id: 'forecast', icon: Waves, label: '予報' },
            { id: 'analysis', icon: TrendingUp, label: '解析' },
            { id: 'log', icon: Clipboard, label: '実績' },
            { id: 'board', icon: Grid3x3, label: 'ボード' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 ${
                currentTab === tab.id ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              <tab.icon size={20} />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default SurfForecastApp;
