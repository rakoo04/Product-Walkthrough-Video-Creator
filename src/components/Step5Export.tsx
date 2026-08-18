import React, { useRef, useState, useEffect } from "react";
import { WalkthroughStep, PREBUILT_VOICES, SpeedAction } from "../types";
import { Play, Pause, Download, Volume2, Video, FileText, Code, CheckCircle, RotateCcw, AlertCircle, Info, Sparkles, Cpu, Sliders, RefreshCw, Check } from "lucide-react";

interface Step5ExportProps {
  steps: WalkthroughStep[];
  setSteps: React.Dispatch<React.SetStateAction<WalkthroughStep[]>>;
  videoUrl?: string;
  videoDuration?: number;
  videoName?: string;
  selectedVoice: string;
  codecError: boolean;
  setCodecError: (val: boolean) => void;
  onReset: () => void;
}

export default function Step5Export({
  steps,
  setSteps,
  videoUrl,
  videoDuration = 0,
  videoName = "Walkthrough",
  selectedVoice,
  codecError,
  setCodecError,
  onReset,
}: Step5ExportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
  const [videoTime, setVideoTime] = useState(0);
  const [activeVoiceover, setActiveVoiceover] = useState<HTMLAudioElement | null>(null);
  const [speakProgress, setSpeakProgress] = useState("");
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Keep track of the voiceover we played at each step to avoid duplicate triggers
  const lastPlayedStepIdRef = useRef<string | null>(null);

  const [selectedEditStepId, setSelectedEditStepId] = useState<string>(steps[0]?.id || "");
  const [isGeneratingStepId, setIsGeneratingStepId] = useState<string | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  useEffect(() => {
    if (steps.length > 0 && !selectedEditStepId) {
      setSelectedEditStepId(steps[0].id);
    }
  }, [steps, selectedEditStepId]);

  const handleUpdateStep = (stepId: string, updatedFields: Partial<WalkthroughStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...updatedFields } : s))
    );
    lastPlayedStepIdRef.current = null;
  };

  const handleSynthesizeStep = async (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;

    setIsGeneratingStepId(stepId);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (activeVoiceover) {
      activeVoiceover.pause();
    }
    setSynthesisError(null);

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: step.script,
          voice: step.voiceName || selectedVoice,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate text-to-speech audio.");
      }

      const { base64Audio } = await response.json();
      if (!base64Audio) {
        throw new Error("Empty audio response received.");
      }

      const binaryStr = atob(base64Audio);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(blob);

      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === stepId) {
            return {
              ...s,
              audioUrl: audioUrl,
              base64Audio: base64Audio,
              voiceName: s.voiceName || selectedVoice,
            };
          }
          return s;
        })
      );
      lastPlayedStepIdRef.current = null;
    } catch (err: any) {
      console.error(err);
      setSynthesisError(err.message || "Failed to generate TTS audio.");
    } finally {
      setIsGeneratingStepId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (activeVoiceover) {
        activeVoiceover.pause();
      }
    };
  }, [activeVoiceover]);

  // Consolidated synchronizer logic for playhead changes
  const syncPlaybackState = (time: number) => {
    setVideoTime(time);

    // Locate active segment index
    const idx = steps.findIndex((step) => time >= step.startTime && time < step.endTime);
    
    if (idx !== -1) {
      setCurrentStepIdx(idx);
      const activeStep = steps[idx];

      // Handle Skip action
      if (activeStep.action === "skip") {
        setSpeakProgress("Skipping skipped segment...");
        const targetTime = activeStep.endTime;
        if (codecError || !videoRef.current) {
          setVideoTime(targetTime);
        } else {
          videoRef.current.currentTime = targetTime;
        }
        return targetTime;
      }

      // Handle Speed Rate adjustments
      let playbackRateVal = 1.0;
      if (activeStep.action === "speed_up_2x") {
        playbackRateVal = 2.0;
      } else if (activeStep.action === "speed_up_4x") {
        playbackRateVal = 4.0;
      }

      if (!codecError && videoRef.current) {
        videoRef.current.playbackRate = playbackRateVal;
      }

      // Handle Voiceover Triggering
      if (activeStep.audioUrl && lastPlayedStepIdRef.current !== activeStep.id) {
        lastPlayedStepIdRef.current = activeStep.id;

        // Stop existing playing voiceover
        if (activeVoiceover) {
          activeVoiceover.pause();
        }

        const voiceoverAudio = new Audio(activeStep.audioUrl);
        setActiveVoiceover(voiceoverAudio);
        setSpeakProgress(`Speaking: "${activeStep.script.substring(0, 45)}..."`);

        // Dim video volume to let voiceover take precedence
        if (!codecError && videoRef.current) {
          videoRef.current.volume = 0.15;
        }

        voiceoverAudio.play().catch(e => console.log("Audio failed to auto play:", e));

        voiceoverAudio.onended = () => {
          if (!codecError && videoRef.current) {
            videoRef.current.volume = 1.0;
          }
          setSpeakProgress("");
        };
      }
    } else {
      setCurrentStepIdx(-1);
      if (!codecError && videoRef.current) {
        videoRef.current.playbackRate = 1.0;
      }
    }
    return time;
  };

  // Synchronized Playback Tracker Engine for Native video tag
  const handleTimeUpdate = () => {
    if (codecError || !videoRef.current) return;
    syncPlaybackState(videoRef.current.currentTime);
  };

  // Simulated clock tick loop if browser cannot play the video source natively
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && codecError) {
      interval = setInterval(() => {
        setVideoTime((prevTime) => {
          let time = prevTime;
          
          // Determine rate of progress for simulated clock based on step actions
          let rate = 1.0;
          const activeStep = steps.find((step) => time >= step.startTime && time < step.endTime);
          if (activeStep) {
            if (activeStep.action === "skip") {
              time = activeStep.endTime;
            } else if (activeStep.action === "speed_up_2x") {
              rate = 2.0;
            } else if (activeStep.action === "speed_up_4x") {
              rate = 4.0;
            }
          }
          
          let nextTime = time + 0.1 * rate;
          if (nextTime >= videoDuration) {
            nextTime = videoDuration;
            setIsPlaying(false);
            if (activeVoiceover) {
              activeVoiceover.pause();
            }
            setSpeakProgress("");
          }
          
          syncPlaybackState(nextTime);
          return nextTime;
        });
      }, 100);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, codecError, videoDuration, steps, activeVoiceover]);

  const handleTogglePlay = () => {
    if (codecError) {
      if (isPlaying) {
        if (activeVoiceover) {
          activeVoiceover.pause();
        }
        setIsPlaying(false);
      } else {
        if (videoTime >= videoDuration) {
          setVideoTime(0);
        }
        lastPlayedStepIdRef.current = null;
        setIsPlaying(true);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      if (activeVoiceover) {
        activeVoiceover.pause();
      }
      setIsPlaying(false);
    } else {
      lastPlayedStepIdRef.current = null;
      video.play().catch(e => {
        console.warn("Video failed to play natively, falling back to simulation:", e);
        setCodecError(true);
        setIsPlaying(true);
      });
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    if (codecError) {
      setVideoTime(0);
      lastPlayedStepIdRef.current = null;
      if (activeVoiceover) {
        activeVoiceover.pause();
        setActiveVoiceover(null);
      }
      setSpeakProgress("");
      setIsPlaying(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    lastPlayedStepIdRef.current = null;
    if (activeVoiceover) {
      activeVoiceover.pause();
      setActiveVoiceover(null);
    }
    setSpeakProgress("");
    video.play().catch(() => {
      setCodecError(true);
      setIsPlaying(true);
    });
    setIsPlaying(true);
  };

  // EXPORT UTILITIES

  // 1. Export WebVTT Subtitle captions
  const handleExportWebVTT = () => {
    let vttText = "WEBVTT\n\n";
    
    steps.forEach((step, idx) => {
      if (step.action === "skip") return;

      const formatVTTTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        const pad = (num: number, size: number) => {
          let s = num.toString();
          while (s.length < size) s = "0" + s;
          return s;
        };

        return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
      };

      const start = formatVTTTime(step.startTime);
      const end = formatVTTTime(step.endTime);

      vttText += `${idx + 1}\n${start} --> ${end}\n${step.script}\n\n`;
    });

    const blob = new Blob([vttText], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoName.split(".")[0] || "walkthrough"}_subtitles.vtt`;
    a.click();
    
    setExportSuccess("Successfully downloaded WebVTT subtitles.");
    setTimeout(() => setExportSuccess(null), 4000);
  };

  // 2. Export manifest config JSON
  const handleExportJSON = () => {
    const backupData = {
      productWalkthrough: {
        videoSource: videoName,
        duration: videoDuration,
        voiceActor: selectedVoice,
        exportDate: new Date().toISOString(),
        timeline: steps.map((s) => ({
          title: s.title,
          startTime: s.startTime,
          endTime: s.endTime,
          action: s.action,
          script: s.script,
          voiceActor: s.voiceName || selectedVoice,
        })),
      },
    };

    const str = JSON.stringify(backupData, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoName.split(".")[0] || "walkthrough"}_config.json`;
    a.click();

    setExportSuccess("Walkthrough JSON Playbook downloaded.");
    setTimeout(() => setExportSuccess(null), 4000);
  };

  const hasVoiceovers = steps.some((s) => s.audioUrl);

  return (
    <div id="step-5-container" className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <CheckCircle className="text-emerald-500 w-5 h-5" />
          Step 5: Review & Export Playbook
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Watch your walkthrough video synced with the custom-generated neural voices. Test the timeline clips and speed alterations, then download the script guidelines and WebVTT subtitles.
        </p>
      </div>

      {exportSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2 shadow-inner">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Main Director Console */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Playback Box (Left 2/3) */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative flex flex-col justify-between shadow-xl ring-1 ring-slate-850">
            
            {/* The actual matching HTML5 video player */}
            {videoUrl ? (
              <>
                {!codecError ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onClick={handleTogglePlay}
                    className="w-full h-full object-contain absolute inset-0 cursor-pointer"
                    onError={() => {
                      setCodecError(true);
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none z-0">
                    {/* Pulsing dashboard abstract graphical visualizer */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <div className="p-3 bg-indigo-500/15 rounded-2xl ring-1 ring-indigo-500/30">
                        <Cpu className={`w-8 h-8 text-indigo-400 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }} />
                      </div>
                      <div className="h-8 w-[1px] bg-slate-800"></div>
                      <div className="flex items-center gap-1.5 h-8">
                        {/* simulated standard frequency spectrum */}
                        {[...Array(12)].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-1.5 bg-indigo-500 rounded-full transition-all"
                            style={{ 
                              height: isPlaying ? `${Math.floor(Math.random() * 24) + 8}px` : "6px",
                              animation: isPlaying ? `pulsate 0.8s ease-in-out infinite alternate` : "none",
                              animationDelay: `${i * 0.07}s`
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 max-w-md px-4">
                      <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-mono font-bold tracking-widest px-2.5 py-1 rounded-full uppercase border border-indigo-500/15">
                        Simulator Mode Active
                      </span>
                      <h4 className="font-bold text-slate-100 text-sm tracking-tight pt-1">
                        Walkthrough Timeline Sandbox Player
                      </h4>
                      <p className="text-xs text-slate-400 leading-normal">
                        Excellent! Your walkthrough script timeline ({videoName}) runs via our high-fidelity simulator.
                      </p>
                      <p className="text-[11px] text-indigo-300 font-medium">
                        All timed voice narrations, timeline highlights, speed adjustments, and skip states remain 100% reviewable and downloadable.
                      </p>
                    </div>

                    {/* Animation Styles */}
                    <style>{`
                      @keyframes pulsate {
                        0% { height: 6px; }
                        100% { height: 32px; }
                      }
                    `}</style>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <Video className="w-12 h-12 text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">No video loaded in project</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">Please go back to Step 1 and upload your walkthough screen recording.</p>
              </div>
            )}

            {/* Custom Overlay indicating active action */}
            {isPlaying && currentStepIdx !== -1 && (
              <div className="absolute top-4 left-4 bg-black/65 backdrop-blur-md text-white py-1.5 px-3 rounded-lg border border-white/10 text-xs font-mono font-bold flex items-center gap-1.5 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {steps[currentStepIdx].title}
                <span className="text-indigo-300 ml-1 bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                  {steps[currentStepIdx].action.toUpperCase()}
                </span>
              </div>
            )}

            {/* Speaking sub-caption overlay */}
            {speakProgress && (
              <div className="absolute bottom-24 left-4 right-4 bg-slate-950/85 backdrop-blur-md border border-indigo-500/30 text-indigo-100 font-serif text-sm px-4 py-2 text-center rounded-xl pointer-events-none shadow-lg animate-fade-in font-medium z-20">
                🎤 {speakProgress}
              </div>
            )}

            {/* Interactive Visual Timeline Scrubber Overlay */}
            <div className="absolute bottom-16 inset-x-4 z-20 flex flex-col gap-1 select-none">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono px-0.5">
                <span>0.0s</span>
                <span className="text-indigo-300 font-bold">Scrub Timeline</span>
                <span>{(videoDuration || 0).toFixed(1)}s</span>
              </div>
              
              {/* Color-coded segments behind the scrubber */}
              <div className="w-full h-1.5 rounded-full bg-slate-800/80 flex overflow-hidden relative border border-slate-900/50">
                {steps.map((step) => {
                  const origLen = step.endTime - step.startTime;
                  const ratio = ((origLen) / (videoDuration || 1)) * 100;
                  let bg = "bg-emerald-400";
                  if (step.action === "speed_up_2x") bg = "bg-amber-400";
                  if (step.action === "speed_up_4x") bg = "bg-orange-400";
                  if (step.action === "skip") bg = "bg-rose-500/40";

                  return (
                    <div
                      key={step.id}
                      style={{ width: `${ratio}%` }}
                      className={`${bg} h-full border-r border-slate-950/20`}
                    />
                  );
                })}
              </div>

              {/* Slider overlay input selector */}
              <input
                type="range"
                min={0}
                max={videoDuration || 1}
                step={0.1}
                value={videoTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVideoTime(val);
                  if (!codecError && videoRef.current) {
                    videoRef.current.currentTime = val;
                  }
                  syncPlaybackState(val);
                }}
                className="w-full h-2 accent-indigo-400 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                style={{ background: "transparent", appearance: "auto" }}
              />
            </div>

            {/* Media Controls bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-10 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="bg-white/95 hover:bg-white text-slate-900 hover:scale-105 active:scale-95 p-2 rounded-full transition-all"
                  title={isPlaying ? "Pause" : "Play Synced Overview"}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-all"
                  title="Replay from start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs font-mono text-slate-300 bg-black/40 border border-white/10 px-3 py-1 rounded-full shadow-inner">
                {videoTime.toFixed(1)}s / {(videoDuration || 0).toFixed(1)}s
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-3.5 bg-blue-50 border border-blue-150 rounded-xl text-xs text-blue-800 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <span>
              <strong>Smart Player Engine:</strong> Speed adjustment triggers and skip events are synchronized perfectly. Click steps on the right or drag the scrubber above to evaluate timing!
            </span>
          </div>

          {/* Timeline Sandbox & Customizer Editing Desk */}
          {steps.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-slate-800 text-sm md:text-base">
                    Timeline Playground & Voice Tuner
                  </h3>
                </div>
                <span className="text-[10px] bg-indigo-55 bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded-full border border-indigo-200">
                  Select segment below to live edit timings & voice
                </span>
              </div>

              {/* Step 1: Horizontal row of segment tabs */}
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {steps.map((step, idx) => {
                  const isSelected = selectedEditStepId === step.id;
                  
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        setSelectedEditStepId(step.id);
                        // Scrub video playhead instantly to segment beginning
                        const targetTime = step.startTime;
                        setVideoTime(targetTime);
                        if (!codecError && videoRef.current) {
                          videoRef.current.currentTime = targetTime;
                        }
                        syncPlaybackState(targetTime);
                      }}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border text-left transition-all shrink-0 flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-indigo-100"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                      }`}
                    >
                      <div className="flex justify-between items-center gap-4 w-full font-mono">
                        <span className="text-[10px]">Segment {idx + 1}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          isSelected ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-600"
                        }`}>
                          {step.startTime}s - {step.endTime}s
                        </span>
                      </div>
                      <span className="text-[10px] opacity-90 truncate max-w-[120px] font-bold">
                        {step.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Step 2: Config card for selected segment */}
              {(() => {
                const stepIdx = steps.findIndex((s) => s.id === selectedEditStepId);
                const activeEditStep = steps[stepIdx];
                if (!activeEditStep) return null;

                const stepDuration = activeEditStep.endTime - activeEditStep.startTime;
                const voiceActorMaxWordsCap = Math.max(8, Math.round(stepDuration * 2.5));
                const currentWordsCount = activeEditStep.script
                  ? activeEditStep.script.split(/\s+/).filter(Boolean).length
                  : 0;
                const isTooWordy = currentWordsCount > voiceActorMaxWordsCap;
                const isSkip = activeEditStep.action === "skip";

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
                    
                    {synthesisError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{synthesisError}</span>
                      </div>
                    )}

                    {/* Inline Title & Timestamps adjustments */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Segment Title
                        </label>
                        <input
                          type="text"
                          value={activeEditStep.title}
                          onChange={(e) => handleUpdateStep(activeEditStep.id, { title: e.target.value })}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs py-2 px-3 rounded-lg focus:outline-none placeholder-slate-400 font-medium"
                          placeholder="E.g. Login Screen Tour"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Start Second Tracking
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={videoDuration}
                          value={activeEditStep.startTime}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            handleUpdateStep(activeEditStep.id, { startTime: val });
                          }}
                          className="w-full bg-white border border-slate-200 text-slate-800 font-mono text-xs py-2 px-3 rounded-lg focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          End Second Tracking
                        </label>
                        <input
                          type="number"
                          min={activeEditStep.startTime + 1}
                          max={videoDuration}
                          value={activeEditStep.endTime}
                          onChange={(e) => {
                            const val = Math.min(videoDuration, Math.max(activeEditStep.startTime + 1, parseInt(e.target.value) || 0));
                            handleUpdateStep(activeEditStep.id, { endTime: val });
                          }}
                          className="w-full bg-white border border-slate-200 text-slate-800 font-mono text-xs py-2 px-3 rounded-lg focus:outline-none"
                        />
                      </div>

                    </div>

                    {/* Action speed selectors */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Playhead Action & Video Pacing Rate
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(["normal", "speed_up_2x", "speed_up_4x", "skip"] as SpeedAction[]).map((act) => {
                          let label = "🚀 Normal";
                          let bgClass = "hover:bg-emerald-50 text-slate-700 hover:border-emerald-300";
                          let selectedClass = "bg-emerald-600 border-emerald-600 text-white shadow-sm";
                          
                          if (act === "speed_up_2x") {
                            label = "⏩ Speed 2x";
                            bgClass = "hover:bg-amber-50 text-slate-700 hover:border-amber-300";
                            selectedClass = "bg-amber-500 border-amber-500 text-white shadow-sm";
                          }
                          if (act === "speed_up_4x") {
                            label = "⏩ Speed 4x";
                            bgClass = "hover:bg-orange-50 text-slate-700 hover:border-orange-300";
                            selectedClass = "bg-orange-500 border-orange-500 text-white shadow-sm";
                          }
                          if (act === "skip") {
                            label = "🚫 Skip Clip";
                            bgClass = "hover:bg-rose-50 text-slate-700 hover:border-rose-300";
                            selectedClass = "bg-rose-500 border-rose-500 text-white shadow-sm";
                          }

                          const isActiveAction = activeEditStep.action === act;

                          return (
                            <button
                              key={act}
                              type="button"
                              onClick={() => {
                                handleUpdateStep(activeEditStep.id, { action: act });
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                                isActiveAction ? selectedClass : `bg-white border-slate-200 ${bgClass}`
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Segment Specific Voice Actor selector */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-3">
                      <div className="md:col-span-1 space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Voice Presenter Actor
                        </label>
                        <select
                          value={activeEditStep.voiceName || selectedVoice}
                          onChange={(e) => {
                            handleUpdateStep(activeEditStep.id, { 
                              voiceName: e.target.value,
                              audioUrl: undefined // script needs re-render since actor has been updated
                            });
                          }}
                          className="w-full bg-white border border-slate-200 text-xs py-2 px-2.5 rounded-lg focus:outline-none font-semibold text-slate-700 font-sans"
                        >
                          {PREBUILT_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-555 text-slate-500 leading-tight">
                          {PREBUILT_VOICES.find((v) => v.id === (activeEditStep.voiceName || selectedVoice))?.description}
                        </p>
                      </div>

                      {/* Narration Script editor */}
                      <div className="md:col-span-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Narration Script Lines
                          </label>
                          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                            isTooWordy ? "bg-rose-100 text-rose-700 font-bold" : "bg-slate-200 text-slate-600"
                          }`}>
                            {currentWordsCount} words / Max {voiceActorMaxWordsCap} recommended ({stepDuration}s)
                          </span>
                        </div>

                        {isSkip ? (
                          <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-slate-400 text-center text-xs italic">
                            No narration can be spoken on a skipped segment!
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={activeEditStep.script}
                              onChange={(e) => {
                                handleUpdateStep(activeEditStep.id, { 
                                  script: e.target.value,
                                  audioUrl: undefined // Needs synthesis recalculation
                                });
                              }}
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-2.5 rounded-lg focus:outline-none placeholder-slate-400 font-serif shadow-inner"
                              placeholder="Type narrators dialogue speech..."
                            />
                            
                            {isTooWordy && (
                              <p className="text-[10px] text-rose-600 font-semibold leading-normal">
                                ⚠️ Words count exceeds optimal timeline flow timing speed guidelines on audio synthesis playback (approx 2.5 words/sec). Please shorten the paragraph or lengthen the segment timing above.
                              </p>
                            )}

                            {/* Render / Synthesize voiceover right in this exporter window */}
                            <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-xl">
                              <span className="text-[10px] font-medium text-slate-500">
                                {activeEditStep.audioUrl ? (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" /> Speech Audio Sync Active
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    Needs TTS synthesiser sync...
                                  </span>
                                )}
                              </span>

                              <button
                                type="button"
                                disabled={isGeneratingStepId !== null}
                                onClick={() => handleSynthesizeStep(activeEditStep.id)}
                                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                                  activeEditStep.audioUrl
                                    ? "bg-slate-105 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                                    : "bg-indigo-600 hover:bg-indigo-750 text-white shadow shadow-indigo-100 cursor-pointer"
                                }`}
                              >
                                {isGeneratingStepId === activeEditStep.id ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Synthesizing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {activeEditStep.audioUrl ? "Regenerate Audio" : "Synthesize Segment Speech"}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Sidebar Controls (Right 1/3) */}
        <div className="md:col-span-1 space-y-6 flex flex-col justify-between">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center justify-between">
              <span>Director Panel</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wide">
                Synced Engine
              </span>
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Compile your timeline playbook and associated high-fidelity synthetic voice assets into standardized files.
            </p>

            <button
               type="button"
               onClick={handleExportWebVTT}
               className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/20 text-slate-700 flex items-center gap-3 transition-colors text-xs font-semibold"
            >
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1">
                <span>Download Subtitles (.vtt)</span>
                <p className="text-[10px] text-slate-400 font-normal">Highly compatible with video players</p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/20 text-slate-700 flex items-center gap-3 transition-colors text-xs font-semibold"
            >
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Code className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1">
                <span>Export Walkthrough Playbook</span>
                <p className="text-[10px] text-slate-400 font-normal">Manifest schema including speeds & scripts</p>
              </div>
            </button>

            {/* Individual audios list in package download / Interactive Navigator */}
            <div className="space-y-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex justify-between">
                <span>Timeline Steps Navigator</span>
                <span className="text-indigo-500 font-mono font-normal">Click step to jump</span>
              </div>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {steps.map((s, idx) => {
                  const isActive = currentStepIdx === idx;
                  const isSkip = s.action === "skip";
                  const formatTimeHelper = (sec: number) => {
                    const m = Math.floor(sec / 60);
                    const sc = Math.floor(sec % 60);
                    return `${m}:${sc < 10 ? "0" : ""}${sc}`;
                  };

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        lastPlayedStepIdRef.current = null;
                        const targetTime = s.startTime;
                        setVideoTime(targetTime);
                        if (!codecError && videoRef.current) {
                          videoRef.current.currentTime = targetTime;
                        }
                        syncPlaybackState(targetTime);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer transition-colors ${
                        isActive
                          ? "bg-slate-900 border-indigo-500 text-white shadow-md scale-[1.01]"
                          : "bg-slate-50 hover:bg-slate-100 hover:border-slate-350 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] mb-1 font-mono">
                        <span className={`font-bold uppercase ${isActive ? "text-indigo-300" : "text-slate-400"}`}>
                          Segment {idx + 1}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          isActive ? "bg-indigo-500/25 text-indigo-200" : "bg-slate-200 text-slate-600"
                        }`}>
                          {formatTimeHelper(s.startTime)} - {formatTimeHelper(s.endTime)}
                        </span>
                      </div>
                      <h4 className={`text-xs font-bold leading-tight truncate ${isActive ? "text-indigo-200" : "text-slate-800"}`}>
                        {s.title}
                      </h4>
                      {!isSkip && s.script && (
                        <p className={`text-[10px] line-clamp-2 mt-1 italic leading-relaxed ${
                          isActive ? "text-slate-300" : "text-slate-500"
                        }`}>
                          "{s.script}"
                        </p>
                      )}
                      {isSkip && (
                        <span className="text-[9px] text-rose-500 font-semibold bg-rose-50 px-1.5 py-0.5 rounded mt-1 inline-block border border-rose-100">
                          Skipped Section
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 border border-slate-350 rounded-xl text-slate-650 text-sm font-semibold hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Start New Walkthrough
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
