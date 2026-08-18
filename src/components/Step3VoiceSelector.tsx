import React, { useState } from "react";
import { PREBUILT_VOICES } from "../types";
import { Volume2, Play, Pause, ChevronRight, Sparkles, HelpCircle, AlertCircle, RefreshCw } from "lucide-react";

interface Step3VoiceSelectorProps {
  selectedVoice: string;
  setSelectedVoice: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3VoiceSelector({
  selectedVoice,
  setSelectedVoice,
  onNext,
  onBack,
}: Step3VoiceSelectorProps) {
  const [demoText, setDemoText] = useState("Hello! I am your AI voice companion. Let's create an incredible walkthrough of your product features.");
  const [isPlayingDemo, setIsPlayingDemo] = useState<string | null>(null); // Voice ID of active demo
  const [demoCache, setDemoCache] = useState<Record<string, string>>({}); // Voice ID -> Blob URL or base64 audio
  const [isLoadingDemo, setIsLoadingDemo] = useState<string | null>(null); // Voice ID currently creating TTS
  const [errorText, setErrorText] = useState<string | null>(null);

  const getPresetPhrase = (voiceId: string) => {
    switch (voiceId) {
      case "Kore":
        return "Hi there, I'm Kore. A high-clarity voice designed for standard corporate guides and concise developer tutorials.";
      case "Fenrir":
        return "Welcome. I'm Fenrir. A rich, authoritative tone, perfect for security products and engineering summaries.";
      case "Puck":
        return "Hey! Puck here, full of positive energy! Let's make an interactive software walkthrough that keeps viewers excited.";
      case "Charon":
        return "Greetings, I'm Charon. My steady and warm pacing ensures complex data dashboards look and sound accessible.";
      case "Zephyr":
        return "Hello. This is Zephyr. A sophisticated, precise speaker suited for analytics reporting and analytical briefs.";
      default:
        return "Ready to generate customized product voiceover narrations.";
    }
  };

  const handleTestVoice = async (voiceId: string) => {
    const textToSpeak = getPresetPhrase(voiceId);
    
    // Check if we already have it cached
    if (demoCache[voiceId]) {
      playCachedAudio(voiceId, demoCache[voiceId]);
      return;
    }

    setIsLoadingDemo(voiceId);
    setErrorText(null);

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak, voice: voiceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to call Gemini voice synthesis API.");
      }

      const { base64Audio } = await response.json();
      if (!base64Audio) {
        throw new Error("Missing audio payload from server.");
      }

      const binaryStr = atob(base64Audio);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(blob);

      setDemoCache((prev) => ({ ...prev, [voiceId]: audioUrl }));
      playCachedAudio(voiceId, audioUrl);
    } catch (err: any) {
      console.error(err);
      setErrorText(`Error: ${err.message || "Failed to generate demo clip."}`);
    } finally {
      setIsLoadingDemo(null);
    }
  };

  const playCachedAudio = (voiceId: string, url: string) => {
    setIsPlayingDemo(voiceId);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => {
      setIsPlayingDemo(null);
    };
    audio.onerror = () => {
      setIsPlayingDemo(null);
    };
  };

  return (
    <div id="step-3-container" className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-indigo-500" />
            Step 3: Select Voice Narration Actor
          </h2>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-1.5 px-3 py-1 font-mono font-bold tracking-wider uppercase rounded-full border border-indigo-200/50 flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            Google Gemini 3.1 TTS Engine
          </span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Choose an advanced neural voice persona generated natively via our integration with Google Gemini's Text-to-Speech API. Sample their voice live before locking in. All segment lines will be synthesized using this voice by default.
        </p>
      </div>

      {errorText && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Main Grid: Features a side panel voice choice + center live demo tester */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left 1/3 Side Panel: Voice Selector */}
        <div id="voice-choice-sidepanel" className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 pb-1">Available Voices</h3>
          
          <div className="space-y-2">
            {PREBUILT_VOICES.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              const isDemoing = isPlayingDemo === voice.id;
              const isLoading = isLoadingDemo === voice.id;

              return (
                <div
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-indigo-500/10"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm tracking-wide">{voice.name}</span>
                    {/* Demo Player trigger */}
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestVoice(voice.id);
                      }}
                      className={`p-1 rounded-lg transition-all ${
                        isSelected 
                          ? "hover:bg-slate-800 text-indigo-300" 
                          : "hover:bg-slate-100 text-indigo-600"
                      }`}
                      title="Listen to sample audio"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      ) : isDemoing ? (
                        <Pause className="w-4 h-4 fill-current animate-pulse text-rose-400" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>
                  </div>
                  <p className={`text-xs mt-1 leading-snug ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                    {voice.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center/Right 2/3: Live Sandbox Tester */}
        <div className="md:col-span-2 space-y-6 flex flex-col justify-between">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Interactive Voice Sandbox
            </h3>
            
            <p className="text-xs text-slate-500">
              Select any actor on the left, check their custom script sample below, or trigger the synthesis test button to listen to Google Gemini's highly-articulate neural text-to-speech feedback.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">
                  Selected System Presenter: <span className="text-indigo-600 font-bold">{selectedVoice}</span>
                </span>
                {isPlayingDemo === selectedVoice && (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                    Currently Playing
                  </span>
                )}
              </div>
              
              <div className="text-sm font-medium text-slate-800 italic bg-white p-3 border border-slate-100 rounded-lg leading-relaxed shadow-sm">
                "{getPresetPhrase(selectedVoice)}"
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isLoadingDemo !== null}
                  onClick={() => handleTestVoice(selectedVoice)}
                  className={`w-full py-2 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
                    isLoadingDemo === selectedVoice
                      ? "bg-slate-100 text-slate-400 cursor-wait"
                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-98"
                  }`}
                >
                  {isLoadingDemo === selectedVoice ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Contacting Neural Voice Engine...
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      Listen To {selectedVoice}'s Demo Phrase
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60 text-xs text-indigo-800 leading-relaxed">
              <strong>Interactive Walkthrough Sync:</strong> Once selected, this actor will read your timeline playbook. You can adjust sections manually in Step 4 or synthesize all step lines in one go!
            </div>
          </div>

          {/* Nav Controls */}
          <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Back to Timeline
            </button>

            <button
              type="button"
              onClick={onNext}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-semibold shadow flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            >
              Continue to Generate Voiceover
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
