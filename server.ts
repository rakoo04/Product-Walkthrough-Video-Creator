import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set body size limit to handle larger base64 audio and video configurations
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for Google GenAI client of @google/genai
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment secrets. Please set it in Settings > Secrets.");
  }

  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  return aiClient;
}

// API endpoint to analyze the video walkthrough context and create a timed timeline
app.post("/api/analyze-walkthrough", async (req, res) => {
  try {
    const { brief, duration, videoName, additionalContext, frames } = req.body;

    if (!duration || isNaN(Number(duration))) {
      res.status(400).json({ error: "A valid video duration in seconds is required." });
      return;
    }

    const videoLength = Math.round(Number(duration));
    
    let contextPrompt = `
      You are an expert product marketing specialist and video producer. Please create a professional product walkthrough timeline.
    `;

    if (frames && Array.isArray(frames) && frames.length > 0) {
      contextPrompt += `
      We have attached ${frames.length} key screenshots/frames extracted chronologically from the actual product video walkthrough. 
      Analyze the visual content of these screenshots with extreme precision (such as buttons, navigation bars, headers, forms, active data, charts, metrics, or table columns) and map them chronologically to the ${videoLength}-second timeline.
      The walkthrough steps MUST explain and narrate what is ACTUALLY visible in these screenshots! Avoid dull or generic filler language. Introduce and reference exact elements visible in the screenshots at their estimated timestamps, so that the narrator sounds like they have their eyes on the screen describing exactly what is happening in real-time.
      `;
    } else {
      contextPrompt += `
      Generate the professional timeline purely using the provided context brief. Since no frames are available, make assumptions based on standard product UX flows.
      `;
    }

    contextPrompt += `
      Walkthrough Details:
      - Video Name: ${videoName || "Walkthrough Video"}
      - Total Duration: ${videoLength} seconds
      - Product Description / Main Goal: ${brief || "Generate a generic product walkthrough."}
      - Additional Context or Instructions: ${additionalContext || "None provided."}

      Analyze this walkthrough request and divide the total ${videoLength} seconds of video into chronological, non-overlapping steps/segments that cover the entire duration of the video (from 0 to ${videoLength} seconds). Each step must have a startTime, an endTime, a descriptive title, a recommended action, and a natural, conversational voiceover narration script.

      Segment Guidelines:
      1. Create between 3 to 7 logical chronological steps depending on video length to fully map out the sequence.
      2. The steps must fully cover 0 to ${videoLength} with NO gaps and NO overlaps (e.g., Step 1: 0 to 8, Step 2: 8 to 20, etc.).
      3. For parts where there is loading, waiting, typing, or scrolling, recommend setting the action to either "speed_up_2x" or "speed_up_4x" or "skip" (to cut it entirely). Otherwise, use "normal" speed.
      4. If an action is 'skip' or fast-forwarded, keep the narrative script extremely short or empty so the voiceover has time to breath.
      5. CRITICAL: The narration script MUST match the duration of the segment perfectly. On average, a professional voiceover artist speaks at about 2.5 words per second. The number of words in your script MUST NEVER exceed (endTime - startTime) * 2.5. (For example, if a segment is 6 seconds, write exactly 12-15 words. If a segment is 10 seconds, write exactly 20-25 words).
      6. Use progressive timeline narration cues like "First, looking at...", "Now as we navigate to...", "Notice how...", "Let's speed through...", "And finally, we see..." to make the audio sync elegantly with the visual pacing.
      7. Focus on professional language, clear transitions, and high-value highlights of the product features.
    `;

    const parts: any[] = [];
    if (frames && Array.isArray(frames)) {
      frames.forEach((base64: string) => {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64
          }
        });
      });
    }
    parts.push({ text: contextPrompt });

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction: "You are an expert product marketing specialist and video producer. You design high-converting, concise and engaging interactive step-by-step product walkthrough playbooks. You inspect visual materials closely and detail actions step by step with precise UI alignments.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              description: "The list of timeline segments for the product walkthrough.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "A short, crystal-clear title of what is happening or highlighted in this step based on the video frame."
                  },
                  startTime: {
                    type: Type.INTEGER,
                    description: "Chronological start second tracker (cumulative from 0)."
                  },
                  endTime: {
                    type: Type.INTEGER,
                    description: "Chronological end second tracker (must be > startTime)."
                  },
                  action: {
                    type: Type.STRING,
                    description: "The speed action suggestion. Must be one of: 'normal', 'speed_up_2x', 'speed_up_4x', or 'skip'."
                  },
                  script: {
                    type: Type.STRING,
                    description: "The written voiceover script text for this segment. Highly descriptive, marketing-oriented and tailored to the segment's duration."
                  }
                },
                required: ["title", "startTime", "endTime", "action", "script"]
              }
            }
          },
          required: ["steps"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("No response text received from Gemini analysis.");
    }

    const result = JSON.parse(outputText);
    
    // Safety check constraints
    if (result && Array.isArray(result.steps)) {
      // Validate chronological order, adjust borders to ensure perfectly continuous timeline
      let currentSec = 0;
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        
        // Ensure starting time matches current border to make it continuous
        step.startTime = currentSec;
        
        if (step.endTime <= step.startTime) {
          step.endTime = step.startTime + 5; // default padding
        }
        
        // Final step should close perfectly at video duration
        if (i === result.steps.length - 1) {
          step.endTime = videoLength;
        }
        
        // Keep tracker continuous
        currentSec = step.endTime;
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error("Error analyzing walkthrough:", err);
    res.status(500).json({ error: err.message || "Internal server error analyzing video walkthrough." });
  }
});

// Simple pleasant base64 WAV generator to fallback gracefully when external TTS API keys or limits are constrained
function generateSyntheticWav(text: string): string {
  const sampleRate = 8000;
  const duration = 1.2; // 1.2 seconds
  const numSamples = Math.floor(sampleRate * duration);
  const headerSize = 44;
  const totalSize = headerSize + numSamples;
  const buffer = Buffer.alloc(totalSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); 
  buffer.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels = 1
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 1, 28); 
  buffer.writeUInt16LE(1, 32); 
  buffer.writeUInt16LE(8, 34); // BitsPerSample = 8

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples, 40);

  // Pitch variation based on text length to sound custom
  const textLength = text.length || 10;
  const baseFreq = 160 + (textLength % 8) * 15; 
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freqFactor = 1.0 + 0.12 * Math.sin(2 * Math.PI * 3.5 * t);
    const pitch = baseFreq * freqFactor;
    const val1 = Math.sin(2 * Math.PI * pitch * t);
    const val2 = 0.4 * Math.sin(2 * Math.PI * (pitch * 2) * t);
    const combined = (val1 + val2) / 1.4;
    
    let envelope = 1.0;
    if (i < 800) envelope = i / 800; // fade in
    if (i > numSamples - 1600) envelope = (numSamples - i) / 1600; // fade out
    
    const sampleValue = Math.floor(128 + combined * 105 * envelope);
    buffer.writeUInt8(sampleValue, headerSize + i);
  }

  return buffer.toString("base64");
}

// API endpoint to generate TTS voiceover audio using the gemini-3.1-flash-tts-preview model
app.post("/api/generate-voiceover", async (req, res) => {
  try {
    const { text, voice } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "The voiceover narration script text is required." });
      return;
    }

    const selectedVoice = voice || "Kore"; // Puck, Charon, Kore, Fenrir, Zephyr
    const promptText = `Speak naturally, professionally, and at a steady pace: ${text}`;

    let base64Audio: string | undefined;
    let isFallback = false;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        }
      });

      const candidate = response.candidates?.[0];
      const firstPart = candidate?.content?.parts?.[0];
      base64Audio = firstPart?.inlineData?.data;

      if (!base64Audio) {
        console.warn("Gemini TTS query empty payload context.", JSON.stringify(response));
        throw new Error("Empty audio output structure.");
      }
    } catch (apiError: any) {
      console.warn("External Gemini TTS API key limits or preview access blocked. Triggering high-fidelity dynamic sandbox carrier tone synthesizer fallback:", apiError.message);
      base64Audio = generateSyntheticWav(text);
      isFallback = true;
    }

    res.json({ base64Audio, isFallback });
  } catch (err: any) {
    console.error("Critical error in voiceover routine:", err);
    res.status(500).json({ error: err.message || "Failed to generate TTS voiceover audio." });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "alive" });
});

// Setup development server or serve assets in production
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting up on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Bootstrap failure:", err);
  process.exit(1);
});
