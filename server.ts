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
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }

    const prompt = `
      당신은 숙련된 건설 현장 소장 및 데이터 분석 전문가입니다.
      다음은 현재 아파트 건설 현장의 공정 데이터입니다:
      
      설정: ${JSON.stringify(projectData.settings)}
      동별 공정: ${JSON.stringify(projectData.buildings.map((b: any) => ({ name: b.name, processes: b.processes })))}
      부대시설 현황: ${JSON.stringify(projectData.facilities)}
      
      위 데이터를 바탕으로 현재 현장의 상태를 진단하고 다음 항목을 포함하여 전문적인 의견을 주십시오:
      1. 현재 전체적인 공정률 평가
      2. 지연이 우려되거나 집중 관리가 필요한 부분 (상세 데이터 기반)
      3. 향후 1개월간의 주요 관리 포인트 및 제언
      
      답변은 한국어로 작성하고, 현장 소장에게 보고하는 격식 있는 리포트 형식으로 작성해 주세요.
      마크다운 형식을 사용하여 가독성 있게 작성해 주세요.
    `;

    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ diagnosis: response.text });
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
