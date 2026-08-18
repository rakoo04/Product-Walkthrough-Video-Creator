import React, { useState } from "react";
import { WalkthroughProject, WalkthroughStep } from "./types";
import Step1Upload from "./components/Step1Upload";
import Step2Timeline from "./components/Step2Timeline";
import Step3VoiceSelector from "./components/Step3VoiceSelector";
import Step4VoiceOverGenerator from "./components/Step4VoiceOverGenerator";
import Step5Export from "./components/Step5Export";
import { Sparkles, Calendar, Settings, Video, Volume2, Timer, FileText, ChevronRight, Check } from "lucide-react";

function extractVideoFrames(videoUrl: string, duration: number, numFrames = 4): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    if (videoUrl && !videoUrl.startsWith("blob:") && !videoUrl.startsWith("data:")) {
      video.crossOrigin = "anonymous";
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    
    // Hide off-screen and append to DOM so the browser initiates hardware/playback decoding
    video.style.position = "fixed";
    video.style.top = "-9999px";
    video.style.left = "-9999px";
    video.style.width = "100px";
    video.style.height = "100px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);
    
    const frames: string[] = [];
    const intervals = Array.from({ length: numFrames }, (_, i) => (duration * (i + 0.5)) / numFrames);
    let currentIdx = 0;
    
    const cleanupAndResolve = (result: string[]) => {
      try {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      } catch (err) {
        console.warn("Error during temporary video tag cleanup:", err);
      }
      resolve(result);
    };
    
    video.onloadeddata = () => {
      seekNext();
    };
    
    video.onerror = (e) => {
      console.warn("Video failed to load for frame capture:", e);
      cleanupAndResolve([]);
    };
    
    function seekNext() {
      if (currentIdx >= intervals.length) {
        cleanupAndResolve(frames);
        return;
      }
      video.currentTime = intervals[currentIdx];
    }
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 480 / (video.videoWidth || 480));
        canvas.width = Math.round((video.videoWidth || 640) * scale);
        canvas.height = Math.round((video.videoHeight || 360) * scale);
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          const base64 = dataUrl.split(",")[1];
          if (base64) {
            frames.push(base64);
          }
        }
      } catch (err) {
        console.warn("Could not draw frame to canvas (e.g. CORS restrictions on remote samples):", err);
      }
      currentIdx++;
      seekNext();
    };
    
    // Explicitly call load to trigger video buffers in background
    video.load();
    
    // Safety guard to fallback after 6 seconds
    setTimeout(() => {
      cleanupAndResolve(frames);
    }, 6000);
  });
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [videoName, setVideoName] = useState<string | undefined>(undefined);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [brief, setBrief] = useState<string>("");
  const [additionalContext, setAdditionalContext] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [steps, setSteps] = useState<WalkthroughStep[]>([]);
  const [codecError, setCodecError] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleVideoLoaded = (url: string, name: string, duration: number) => {
    setVideoUrl(url);
    setVideoName(name);
    setVideoDuration(duration);
    setErrorText(null);
  };

  const startAnalysis = async () => {
    if (!videoUrl || !videoDuration) {
      setErrorText("Please upload and prepare a video before analyzing.");
      return;
    }

    setIsLoading(true);
    setErrorText(null);
    setLoadingText("Extracting keyframes from video for visual walkthrough matching...");

    try {
      // First extract the frames from the loaded video element
      let frames: string[] = [];
      try {
        frames = await extractVideoFrames(videoUrl, videoDuration, 4);
      } catch (fErr) {
        console.warn("Soft issue during keyframe extraction, proceeding with text-only parameters:", fErr);
      }

      setLoadingText("Formulating step playbooks with Gemini AI...");

      const response = await fetch("/api/analyze-walkthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          duration: videoDuration,
          videoName,
          additionalContext,
          frames
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Failed during Gemini analysis pipeline request.");
      }

      const parsed = await response.json();
      
      if (parsed && Array.isArray(parsed.steps)) {
        // Enforce proper individual IDs on steps
        const initialized: WalkthroughStep[] = parsed.steps.map((st: any) => ({
          ...st,
          id: crypto.randomUUID(),
        }));
        setSteps(initialized);
        setCurrentStep(1); // Proceed to Step 2 Timeline editor
      } else {
        throw new Error("Invalid schema structured received from AI model.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setVideoUrl(undefined);
    setVideoName(undefined);
    setVideoDuration(undefined);
    setBrief("");
    setAdditionalContext("");
    setSteps([]);
    setCodecError(false);
    setErrorText(null);
  };

  // Stepper Header items
  const menuItems = [
    { label: "Brief & Asset", desc: "Upload walkthrough clip", icon: Video },
    { label: "Visual Timeline", desc: "Speed controls & actions", icon: Timer },
    { label: "Voice Presenter", desc: "Choose actor persona", icon: Volume2 },
    { label: "Synthesize Voice", desc: "Generate narrations", icon: Sparkles },
    { label: "Review & Export", desc: "Download package", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Visual Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Product Walkthrough</h1>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">AI Video Narrator & Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          UTC: 2026-05-24
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8 md:gap-10">
        
        {/* Step progress indicators progress */}
        <div id="progress-indicator-bar" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto w-full">
          <div className="flex items-center justify-between min-w-[700px]">
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              const isCompleted = currentStep > idx;
              const isActive = currentStep === idx;
              
              return (
                <React.Fragment key={idx}>
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                        isCompleted
                          ? "bg-emerald-555 bg-emerald-600 text-white"
                          : isActive
                          ? "bg-slate-900 text-white ring-4 ring-indigo-500/15"
                          : "bg-slate-150 bg-slate-100 text-slate-400"
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4 font-bold" /> : idx + 1}
                    </div>
                    <div>
                      <div className={`text-xs font-bold leading-tight ${isActive ? "text-slate-900" : isCompleted ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  {idx < menuItems.length - 1 && (
                    <div className="h-[2px] w-8 bg-slate-200 mx-2 shrink-0"></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Dynamic Warning Card */}
        {errorText && (
          <div className="bg-rose-55 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-sm flex items-start gap-3 shadow-inner">
            <Settings className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Action Notice:</strong> {errorText}
            </div>
          </div>
        )}

        {/* Global Loading Box Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="bg-slate-900 border border-slate-850 p-8 rounded-2xl max-w-sm w-full space-y-5 animate-pulse shadow-2xl">
              <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-lg tracking-wide">Synthesizing Walkthrough Plan</h3>
                <p className="text-xs text-indigo-300 font-mono font-bold tracking-wider uppercase">Gemini AI Model Running</p>
              </div>
              <div className="text-sm text-slate-400 italic bg-slate-950/40 p-3 rounded-xl border border-white/5">
                "{loadingText}"
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full animate-bar-width" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Active Stage Renderer */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
          {currentStep === 0 && (
            <Step1Upload
              onVideoLoaded={handleVideoLoaded}
              videoUrl={videoUrl}
              videoName={videoName}
              videoDuration={videoDuration}
              brief={brief}
              setBrief={setBrief}
              additionalContext={additionalContext}
              setAdditionalContext={setAdditionalContext}
              onNext={startAnalysis}
              codecError={codecError}
              setCodecError={setCodecError}
            />
          )}

          {currentStep === 1 && (
            <Step2Timeline
              steps={steps}
              setSteps={setSteps}
              videoDuration={videoDuration || 0}
              onNext={() => setCurrentStep(2)}
              onBack={() => setCurrentStep(0)}
            />
          )}

          {currentStep === 2 && (
            <Step3VoiceSelector
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step4VoiceOverGenerator
              steps={steps}
              setSteps={setSteps}
              selectedVoice={selectedVoice}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <Step5Export
              steps={steps}
              setSteps={setSteps}
              videoUrl={videoUrl}
              videoDuration={videoDuration}
              videoName={videoName}
              selectedVoice={selectedVoice}
              codecError={codecError}
              setCodecError={setCodecError}
              onReset={handleReset}
            />
          )}
        </div>

      </main>

      {/* Clean Footer constraints */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-500 font-medium">
        <div>Product Walkthrough & AI Video Narrator Playbook • Crafted with Google Generative AI Support</div>
      </footer>
    </div>
  );
}
