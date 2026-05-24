import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

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
app.get("/api/weather", async (req, res) => {
  const { location } = req.query;
  if (!location) {
    return res.status(400).json({ error: "Location is required" });
  }

  try {
    const weatherUrl = `https://wttr.in/${encodeURIComponent(location as string)}?format=j1`;
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Weather Proxy Error:", error);
    res.status(500).json({ error: "날씨 정보를 가져오는 데 실패했습니다." });
  }
});

app.post("/api/diagnosis", async (req, res) => {
  try {
    const { projectData } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY environment variable");
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }

    const prompt = `
      건설 현장 데이터 분석 전문가로서 현장 정밀 진단을 수행해 주세요.
      
      [현장 기초 정보]
      - 프로젝트: ${projectData.settings.projectName}
      - 기간: ${projectData.settings.startDate} ~ ${projectData.settings.endDate}
      - 소장: ${projectData.settings.managerName}
      
      [현장 특이사항 및 메모]
      ${projectData.dashboardNotes || "기록된 특이사항 없음"}
      
      [상세 공정 데이터]
      - 동별 진행 (JSON): ${JSON.stringify(projectData.buildings.map((b: any) => ({ name: b.name, progress: b.processes })))}
      - 시설물 현황: ${JSON.stringify(projectData.facilities.map((f: any) => ({ name: f.name, status: f.status })))}
      
      [일일 작업 현황 요약]
      ${(projectData.dailyReports || []).slice(0, 3).map((r: any) => `- ${r.date}: ${r.notes} (인원: ${r.manpower}, 날씨: ${r.weather})`).join('\n')}
      
      [진단 지시 사항]
      1. '현장 특이사항 및 메모'에 기술된 이슈(자재 협의, 민원, 기상 등)를 최우선으로 고려하여 현재 공정의 위협 요소를 분석해 주세요.
      2. 수치 데이터(동별 공정율)에서 나타나는 편차나 지연 징후를 포착하여 구체적으로 지적해 주세요.
      3. 현장 소장이 즉시 조치해야 할 '핵심 관리 포인트' 3가지를 제시해 주세요.
      4. 프로젝트의 성공적인 완수를 위한 선제적 제언을 리포트 형식으로 작성해 주세요.
      
      [응답 형식]
      반드시 다음과 같은 JSON 구조로 응답하십시오:
      {
        "diagnosis": "전체 진단 내용 (마크다운 형식)",
        "risks": ["핵심 위험 요소 1", "핵심 위험 요소 2", "핵심 위험 요소 3"],
        "actions": ["권장 조치 사항 1", "권장 조치 사항 2", "권장 조치 사항 3"]
      }
      
      참고: diagnosis 필드는 소장에게 보고하는 격식 있는 말투로 작성하고, risks와 actions는 리포트에서 추출한 핵심 요약을 짧은 문장으로 작성하십시오.
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
      res.json({ 
        diagnosis: parsed.diagnosis,
        risks: parsed.risks || [],
        actions: parsed.actions || []
      });
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, resultText);
      res.json({ diagnosis: resultText }); // Fallback if not valid JSON
    }
  } catch (error: any) {
    console.error("AI Diagnosis Error:", error);
    res.status(500).json({ error: error.message || "AI 진단 중 오류가 발생했습니다." });
  }
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
