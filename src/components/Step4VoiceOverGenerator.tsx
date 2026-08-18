import React, { useState } from "react";
import { WalkthroughStep } from "../types";
import { Play, Pause, Volume2, Sparkles, Check, RefreshCw, AlertCircle, ListPlus, ChevronLeft, ChevronRight } from "lucide-react";

interface Step4VoiceOverGeneratorProps {
  steps: WalkthroughStep[];
  setSteps: React.Dispatch<React.SetStateAction<WalkthroughStep[]>>;
  selectedVoice: string;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4VoiceOverGenerator({
  steps,
  setSteps,
  selectedVoice,
  onNext,
  onBack,
}: Step4VoiceOverGeneratorProps) {
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

  const generateSingleVoiceover = async (stepId: string) => {
    // Locate the step
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;

    if (step.action === "skip") {
      // Skipped segments don't need voiceover
      return;
    }

    // Set loading state
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === stepId) {
          return { ...s, isGenerating: true, error: undefined };
        }
        return s;
      })
    );

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: step.script, voice: selectedVoice }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate text-to-speech audio.");
      }

      const { base64Audio } = await response.json();
      if (!base64Audio) {
        throw new Error("Empty audio response from GenAI engine.");
      }

      // Convert base64 to Blob URL for easy client playback
      const binaryStr = atob(base64Audio);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(blob);

      // Save to state
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === stepId) {
            return {
              ...s,
              audioUrl: audioUrl,
              base64Audio: base64Audio,
              voiceName: selectedVoice,
              isGenerating: false,
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      console.error(err);
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === stepId) {
            return { ...s, isGenerating: false, error: err.message || "Failed" };
          }
          return s;
        })
      );
    }
  };

  const generateAllVoiceovers = async () => {
    setIsGeneratingAll(true);
    setGlobalError(null);

    // Filter normal steps that need voiceovers and don't skip
    const stepsToGenerate = steps.filter((step) => step.action !== "skip");

    for (const step of stepsToGenerate) {
      await generateSingleVoiceover(step.id);
    }

    setIsGeneratingAll(false);
  };

  const handlePlayAudio = (stepId: string, url: string) => {
    // If currently playing, stop it
    if (activeAudio) {
      activeAudio.pause();
      if (currentlyPlayingId === stepId) {
        setCurrentlyPlayingId(null);
        setActiveAudio(null);
        return;
      }
    }

    setCurrentlyPlayingId(stepId);
    const audio = new Audio(url);
    setActiveAudio(audio);
    audio.play();

    audio.onended = () => {
      setCurrentlyPlayingId(null);
      setActiveAudio(null);
    };

    audio.onerror = () => {
      setCurrentlyPlayingId(null);
      setActiveAudio(null);
    };
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const generatedCount = steps.filter((s) => s.audioUrl || s.action === "skip").length;
  const isAllGenerated = generatedCount === steps.length;

  return (
    <div id="step-4-container" className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-500" />
              Step 4: Generate Walkthrough Voiceovers
            </h2>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2.5 py-0.5 font-mono font-bold tracking-wider uppercase rounded-full border border-indigo-200/50 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
              Google Gemini 3.1 TTS Engine
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Generate synthetic voice narrations using the selected voice profile: <strong className="text-indigo-600">{selectedVoice}</strong>. Trigger fully synced audio rendering sequentially or section-by-section.
          </p>
        </div>

        {/* Global Trigger */}
        <button
          type="button"
          disabled={isGeneratingAll || steps.length === 0}
          onClick={generateAllVoiceovers}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-md transition-all shrink-0 ${
            isGeneratingAll
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-indigo-650 hover:bg-indigo-600 text-white cursor-pointer active:scale-95"
          }`}
        >
          {isGeneratingAll ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              Rendering All Steps...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate All Sections
            </>
          )}
        </button>
      </div>

      {globalError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Generation dashboard progression banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center text-sm font-medium">
        <span className="text-slate-600">Walkthrough script production readiness:</span>
        <div className="flex items-center gap-3">
          <span className="text-slate-800 font-mono font-bold">
            {generatedCount} / {steps.length} segments ready
          </span>
          <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${(generatedCount / steps.length) * 100}%` }}
              className="bg-indigo-600 h-full transition-all"
            ></div>
          </div>
        </div>
      </div>

      {/* Main steps audio deck */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isSkip = step.action === "skip";
          const isReady = !!step.audioUrl;
          const isGenerating = !!step.isGenerating;

          return (
            <div
              key={step.id}
              className={`p-5 rounded-xl border bg-white ${
                isSkip
                  ? "bg-slate-50/50 border-slate-200/60 opacity-65"
                  : isReady
                  ? "border-emerald-200 shadow-sm"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                {/* Narrator Card info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">STEP {idx + 1}</span>
                    <h4 className="font-semibold text-slate-800 truncate text-base">{step.title}</h4>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full border border-slate-200">
                      {formatTime(step.startTime)} - {formatTime(step.endTime)}
                    </span>
                  </div>

                  {isSkip ? (
                    <p className="text-xs text-slate-500 italic">
                      This segment has been marked as "Skip". No audio narration is generated, and this section of the video will be fast-forwarded / cut during playback!
                    </p>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-sm text-slate-700 italic font-serif leading-relaxed">
                      "{step.script}"
                    </div>
                  )}

                  {step.error && (
                    <div className="text-xs text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{step.error}</span>
                    </div>
                  )}
                </div>

                {/* Audio Generation Controls */}
                {!isSkip && (
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    {isReady && (
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(step.id, step.audioUrl!)}
                        className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                          currentlyPlayingId === step.id
                            ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                        title={currentlyPlayingId === step.id ? "Stop Speech" : "Listen to Audio Segment"}
                      >
                        {currentlyPlayingId === step.id ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isGenerating || isGeneratingAll}
                      onClick={() => generateSingleVoiceover(step.id)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all ${
                        isReady
                          ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Synthesizing...
                        </>
                      ) : isReady ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                          Re-Generate
                        </>
                      ) : (
                        "Generate Voice"
                      )}
                    </button>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer"
        >
          Back to Voices
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-semibold shadow flex items-center gap-1 transition-all cursor-pointer active:scale-95 text-center"
        >
          {isAllGenerated ? "Continue to Export" : "Preview Breakdown Anyway"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
