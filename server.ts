import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  next();
});

// Gemini Initialization
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

app.get("/api/weather", async (req, res) => {
  const { location, date } = req.query;
  if (!location) {
    return res.status(400).json({ error: "Location is required" });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const sanitizedLocation = (location as string).trim();
  
  // Try a standard browser User-Agent which is less likely to be blocked than curl
  const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const fetchWithRetry = async (locStr: string, dateStr?: string, retries = 1): Promise<Response> => {
    // Better location mapping for wttr.in consistency in Korea
    let refinedLoc = locStr;
    const lowerLoc = locStr.toLowerCase();
    
    // Skip refinement if it looks like coordinates (lat,lng)
    const isCoords = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(locStr);
    
    if (!isCoords) {
      // wttr.in works best with city names in English or well-known Korean cities
      if (lowerLoc.includes('김포') || lowerLoc.includes('gimpo')) refinedLoc = 'Gimpo';
      else if (lowerLoc.includes('서울') || lowerLoc.includes('seoul')) refinedLoc = 'Seoul';
      else if (lowerLoc.includes('인천') || lowerLoc.includes('incheon')) refinedLoc = 'Incheon';
      else if (lowerLoc.includes('부산') || lowerLoc.includes('busan')) refinedLoc = 'Busan';
      else if (lowerLoc.includes('대구') || lowerLoc.includes('daegu')) refinedLoc = 'Daegu';
      else if (lowerLoc.includes('대전') || lowerLoc.includes('daejeon')) refinedLoc = 'Daejeon';
      else if (lowerLoc.includes('광주') || lowerLoc.includes('gwangju')) refinedLoc = 'Gwangju';
      else if (lowerLoc.includes('울산') || lowerLoc.includes('ulsan')) refinedLoc = 'Ulsan';
      else if (lowerLoc.includes('수원') || lowerLoc.includes('suwon')) refinedLoc = 'Suwon';
      else if (lowerLoc.includes('고양') || lowerLoc.includes('goyang')) refinedLoc = 'Goyang';
      else if (lowerLoc.includes('성남') || lowerLoc.includes('seongnam')) refinedLoc = 'Seongnam';
      else if (lowerLoc.includes('용인') || lowerLoc.includes('yongin')) refinedLoc = 'Yongin';
    }

    const locPart = encodeURIComponent(refinedLoc).replace(/%20/g, '+');
    let url = `https://wttr.in/${locPart}?format=j1`;
    if (dateStr && dateStr !== todayStr) {
      url = `https://wttr.in/${locPart}@${dateStr}?format=j1`;
    }

    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'application/json',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'close',
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });

        if (response.ok) return response;
        
        if (response.status >= 500 && i < retries) {
          await new Promise(r => setTimeout(r, 1500 * (i + 1)));
          continue;
        }
        
        return response;
      } catch (err: any) {
        if (i < retries) {
          console.warn(`Weather API attempt ${i+1} errored for ${refinedLoc}: ${err.message}. Retrying...`);
          await new Promise(r => setTimeout(r, 1500 * (i + 1)));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error('Retries exhausted');
  };

  try {
    let response;
    try {
      response = await fetchWithRetry(sanitizedLocation, date as string);
    } catch (e) {
      // If original location fails, try a broader one immediately as part of catch
      if (sanitizedLocation.includes(' ')) {
        const parts = sanitizedLocation.split(' ');
        response = await fetchWithRetry(parts[0], date as string);
      } else {
        throw e;
      }
    }
    
    // Fallback: If response not ok, and we haven't already tried a broad location
    if (!response.ok && sanitizedLocation.includes(' ')) {
      const parts = sanitizedLocation.split(' ');
      const fallbackLoc = parts[0];
      response = await fetchWithRetry(fallbackLoc, date as string);
    }

    if (!response.ok) {
      // Mock data for "future" dates or consistently failing API
      // In a construction app, showing at least "Season Default" is better than an error
      const month = date ? parseInt((date as string).split('-')[1]) : new Date().getMonth() + 1;
      let weatherDesc = '맑음';
      let temp = '20';
      
      if (month <= 2 || month === 12) { weatherDesc = '추움/맑음'; temp = '-2'; }
      else if (month >= 6 && month <= 8) { weatherDesc = '무더위/습함'; temp = '30'; }
      else if (month >= 3 && month <= 5) { weatherDesc = '포근함'; temp = '18'; }
      else { weatherDesc = '선선함'; temp = '15'; }

      console.warn(`Weather API final error: ${response.status} for ${location}. Returning seasonal fallback.`);
      return res.json({
        current_condition: [{ temp_C: temp, weatherDesc: [{ value: weatherDesc }], humidity: "50", windspeedKmph: "10" }],
        weather: [{ date: date || todayStr, avgtempC: temp, totalPrecip_mm: "0", hourly: [{}, {}, {}, {}, { weatherDesc: [{ value: weatherDesc }], tempC: temp }] }],
        is_fallback: true
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("Weather Proxy Timeout:", location);
      return res.status(504).json({ error: "Weather API timeout" });
    }
    console.error("Weather Proxy Error:", error);
    res.status(500).json({ error: "날씨 정보를 가져오는 데 실패했습니다." });
  }
});

app.post("/api/diagnosis", async (req, res) => {
  console.log("POST /api/diagnosis received");
  try {
    const { projectData } = req.body;
    console.log("Project name:", projectData?.settings?.projectName);
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY environment variable");
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }

    const prompt = `
      건설 현장 데이터 분석 전문가로서 현장 정밀 진단을 수행해 주세요. 특히 최근 기상 악화 상황이 향후 공정에 미칠 영향을 심층 분석하는 것이 이번 진단의 핵심입니다.
      
      [현장 기초 정보]
      - 프로젝트: ${projectData.settings.projectName}
      - 기간: ${projectData.settings.startDate} ~ ${projectData.settings.endDate}
      - 소장: ${projectData.settings.managerName}
      - 현재 위치: ${projectData.settings.location || "위치 정보 없음"}
      
      [현장 특이사항 및 메모]
      ${projectData.dashboardNotes || "기록된 특이사항 없음"}
      
      [상세 공정 데이터]
      - 동별 진행 (JSON): ${JSON.stringify(projectData.buildings.map((b: any) => ({ name: b.name, progress: b.processes })))}
      - 시설물 현황: ${JSON.stringify(projectData.facilities.map((f: any) => ({ name: f.name, status: f.status })))}
      
      [최근 7일간 작업 현황 및 기상 기록]
      ${(projectData.dailyReports || []).slice(0, 10).map((r: any) => `- ${r.date}: ${r.notes} (인원: ${r.manpower}, 날씨/환경: ${r.weather})`).join('\n')}
      
      [진단 핵심 지시 사항]
      1. 기상 분석: 최근 기상 데이터(강수, 기온, 강풍 등)를 바탕으로 현재 공정(골조, 마감, 인프라 등)에 미친 실질적 지연 요소를 도출하십시오.
      2. 향후 영향: 현재의 기상 추세나 누적된 습도/기온 이슈가 향후 1~2주 내 예정된 핵심 공정(콘크리트 타설, 외벽 작업, 타워크레인 운용 등)에 미칠 위험을 예측하십시오.
      3. 데이터 기반 편차분석: 동별 공정율 데이터에서 나타나는 부진 구간을 포착하고, 이것이 기상 이슈와 결합했을 때의 가중 위험을 지적하십시오.
      4. 소장 대응 전략: 현장 소장이 즉시 조치해야 할 '핵심 관리 포인트' 3가지를 기상 대응을 포함하여 제시하십시오.
      
      [응답 형식]
      반드시 다음과 같은 JSON 구조로 응답하십시오:
      {
        "diagnosis": "전체 진단 내용 (마크다운 형식, 기상 분석 섹션 포함 필수)",
        "risks": ["기상 관련 위험 포함 핵심 요소 1", "위험 요소 2", "위험 요소 3"],
        "actions": ["날씨 대응 포함 권장 조치 1", "권장 조치 2", "권장 조치 3"]
      }
      
      참고: diagnosis 필드는 소개, 현황 분석, 기상 영향 평가, 향후 전망 순으로 격식 있는 말투로 작성하십시오.
    `;

    console.log("Sending diagnosis request to Gemini with model gemini-3.5-flash...");
    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    console.log("Gemini response received");
    const resultText = response.text;
    if (!resultText) {
      console.error("Empty or invalid response from Gemini");
      throw new Error("Gemini API에서 유효한 응답을 받지 못했습니다.");
    }

    try {
      const parsed = JSON.parse(resultText);
      console.log("Successfully parsed Gemini response");
      res.json({ 
        diagnosis: parsed.diagnosis,
        risks: parsed.risks || [],
        actions: parsed.actions || []
      });
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, resultText);
      res.json({ 
        diagnosis: resultText,
        risks: [],
        actions: []
      }); // Fallback
    }
  } catch (error: any) {
    console.error("AI Diagnosis Error:", error);
    res.status(500).json({ error: error.message || "AI 진단 중 오류가 발생했습니다." });
  }
});

app.post("/api/extract-progress", async (req, res) => {
  console.log("POST /api/extract-progress received");
  try {
    const { image, mimeType } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }

    if (!image) {
      return res.status(400).json({ error: "Image data is required" });
    }

    const prompt = `
      건설 현장의 공정표(엑셀 스크린샷 등) 이미지를 분석하여 동별, 공종별 진행 상태를 정밀하게 추출해 주세요.
      
      [분석 지침]
      1. 이미지에서 '동'(예: 101동, 107동)과 '공종'(예: 건축골조, HOIST, 스리브, 위생배관 등)을 식별하십시오.
      2. 각 셀의 값(예: 완료, 27층, 12층, 지붕층, 미정 등)을 분석하여 숫자로 변환하십시오.
         - '완료' 또는 '100%' -> 100
         - '#층' -> 해당 층수 (예: '27층' -> 27)
         - '지붕층' -> 프로젝트의 최대 층수(보통 29) 또는 높은 단계로 간주
         - '#.#완료' -> (예: '0.2완료') -> 층수 0.2 또는 직접적인 값
         - '미정' 또는 빈 칸 -> 0
      3. 추출된 데이터를 반드시 아래 JSON 구조로 응답하십시오.
      
      [응답 형식]
      {
        "buildings": [
          {
            "name": "101동",
            "processes": {
              "건축골조": 27,
              "HOIST": 100,
              "스리브": 100,
              "위생배관": 100,
              ...
            }
          },
          ...
        ]
      }
      
      참고: 이미지의 텍스트가 정확하지 않을 수 있으니 문맥상 가장 적절한 공종명과 동번호를 선택하십시오.
    `;

    console.log("Sending extraction request to Gemini with model gemini-3.5-flash...");
    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || "image/png", data: image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini API에서 추출 결과를 받지 못했습니다.");
    }

    const parsed = JSON.parse(resultText);
    res.json(parsed);

  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    res.status(500).json({ error: error.message || "공정 추출 중 오류가 발생했습니다." });
  }
});

// API 404 handler
app.all("/api/*", (req, res) => {
  res.status(404).json({ 
    error: `API route not found: ${req.method} ${req.url}`,
    tip: "Check if the route is defined in server.ts and if the request method is correct."
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
