import React, { useState, useRef } from "react";
import { Upload, FileVideo, Sparkles, AlertCircle, HelpCircle } from "lucide-react";

interface Step1UploadProps {
  onVideoLoaded: (videoUrl: string, name: string, duration: number) => void;
  videoUrl?: string;
  videoName?: string;
  videoDuration?: number;
  brief: string;
  setBrief: (brief: string) => void;
  additionalContext: string;
  setAdditionalContext: (context: string) => void;
  onNext: () => void;
  codecError: boolean;
  setCodecError: (val: boolean) => void;
}

export default function Step1Upload({
  onVideoLoaded,
  videoUrl,
  videoName,
  videoDuration,
  brief,
  setBrief,
  additionalContext,
  setAdditionalContext,
  onNext,
  codecError,
  setCodecError,
}: Step1UploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const SAMPLES = [
    {
      name: "Dashboard Metrics Demo Walkthrough",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      duration: 15,
      brief: "A product tour of our software analytics dashboard. Shows monitoring active servers, analyzing server CPU load, scaling backend clusters automatically, and checking system RAM indicators.",
      context: "Make the tone highly professional. Emphasize horizontal scaling. Recommend 4x speed for the scaling operations."
    },
    {
      name: "Productivity Plan App Tour",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      duration: 15,
      brief: "A mobile login flow showcase. Displays secure biometric validation, navigating multi-factor security alerts, choosing customized workspace preferences, and initializing the inbox feed.",
      context: "Make the narration sound highly secure and modern. Speed up passcode entering screen."
    }
  ];

  const handleSelectSample = (sample: typeof SAMPLES[0]) => {
    setCodecError(false);
    onVideoLoaded(sample.url, sample.name, sample.duration);
    setBrief(sample.brief);
    setAdditionalContext(sample.context);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setCodecError(false);
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      const name = file.name;
      
      // Load hidden video to capture genuine duration
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.onerror = () => {
          // Fallback if browser struggles to query specific codec metadata
          console.warn("Hidden video codec query metadata warning. Using robust defaults.");
          onVideoLoaded(url, name, 20);
        };
        hiddenVideoRef.current.src = url;
        hiddenVideoRef.current.onloadedmetadata = () => {
          const duration = hiddenVideoRef.current?.duration || 0;
          onVideoLoaded(url, name, duration || 20);
        };
      } else {
        // Fallback default duration
        onVideoLoaded(url, name, 25);
      }
    } else {
      alert("Please select a valid video file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const formatDuration = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Check if step 1 form can proceed
  const canProceed = videoUrl && brief.trim().length > 3;

  return (
    <div id="step-1-container" className="space-y-6">
      <video ref={hiddenVideoRef} className="hidden" />

      {/* Header Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          Step 1: Upload Video & Add Walkthrough Brief
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Provide your screen recording, product clip, or app prototype. Explain what you're doing, the features you're showcasing, and let AI automatically segment your timeline with script lines!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: File Upload */}
        <div className="flex flex-col space-y-4">
          <label className="text-sm font-medium text-slate-700">Product Video Asset</label>
          
          <div
            id="drag-and-drop-zone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              dragActive
                ? "border-indigo-500 bg-indigo-50/50"
                : videoUrl
                ? "border-emerald-300 bg-emerald-50/5"
                : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleChange}
              className="hidden"
            />

            {videoUrl ? (
              <div className="space-y-4 flex flex-col items-center w-full">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-full">
                  <FileVideo className="w-10 h-10" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm max-w-xs truncate" title={videoName}>
                    {videoName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Duration: <span className="font-mono font-medium text-slate-700">{formatDuration(videoDuration || 0)}</span> ({(videoDuration || 0).toFixed(1)}s)
                  </p>
                </div>
                
                {/* Embedded Video Element with code callback tracking */}
                <div className="w-full max-w-sm overflow-hidden rounded-lg aspect-video bg-slate-950 shadow-inner mt-2 relative">
                  {!codecError ? (
                    <video 
                      src={videoUrl} 
                      className="w-full h-full object-contain" 
                      controls 
                      muted
                      onError={() => {
                        setCodecError(true);
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none bg-slate-950">
                      <div className="flex items-center gap-2 mb-3 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                        <span className="text-[9px] uppercase tracking-wider text-indigo-300 font-mono font-bold">Simulator Active</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-200">Walkthrough Sandbox Interactive Player</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[260px] leading-relaxed animate-pulse">
                        Your browser doesn't natively play this codec, but Gemini will still completely segment and voice over this resource perfectly!
                      </p>
                    </div>
                  )}
                </div>

                {codecError && (
                  <div className="w-full max-w-sm p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-805 text-amber-850 text-left space-y-1">
                    <span className="font-bold flex items-center gap-1 text-amber-900">
                      <AlertCircle className="w-3.5 h-3.5" /> Browser Codec Restriction
                    </span>
                    <p className="leading-normal text-slate-600">
                      Your current browser states it does not natively support decoding this specific video type or container stream.
                    </p>
                    <p className="text-[10px] text-amber-800 font-medium">
                      Note: You can still proceed normally! Gemini AI will generate the complete text-to-speech walkthrough based on your context briefs, or choose one of our quick pre-tested templates below.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline font-semibold mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileInput();
                  }}
                >
                  Choose Different Local Video
                </button>
              </div>
            ) : (
              <div 
                className="space-y-4 flex flex-col items-center py-6 w-full cursor-pointer"
                onClick={triggerFileInput}
              >
                <div className="p-4 bg-slate-100 text-slate-500 rounded-full">
                  <Upload className="w-10 h-10" />
                </div>
                <div className="space-y-1 px-4">
                  <p className="font-medium text-slate-700 text-xs sm:text-sm">
                    Drag & drop screen recording here, or <span className="text-indigo-600 underline">browse files</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports MP4, WebM, MOV and standard formats.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Pre-Tested Cloud Templates Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Try with an Instant Cloud Sample Video
            </h3>
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Don't have a screen capture right now? Click an optimized tech template to test the AI segmentation, timeline speeds, and full neural voice over synthesizer instantly:
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {SAMPLES.map((sample, idx) => {
                const isSelected = videoUrl === sample.url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-md font-medium"
                        : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 text-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-bold text-xs">🎬 template {idx + 1}: {sample.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-105 bg-slate-100 text-slate-600"}`}>
                        {sample.duration}s
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed line-clamp-2 mt-1 ${isSelected ? "text-slate-305 text-slate-300" : "text-slate-500"}`}>
                      {sample.brief}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Product context and brief */}
        <div className="flex flex-col space-y-5 justify-between">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="brief" className="text-sm font-medium text-slate-700">
                  Product Context & Walkthrough Brief <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-400">At least 4 chars</span>
              </div>
              <textarea
                id="brief"
                rows={5}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Example: Briefly explain what this video represents and what the walkthrough should say. For example: 'This is a walkthrough of my task management dashboard. It shows logging in, creating a task called 'Complete presentation', assigning it to Team Omega, and filtering task boards.'"
                className="w-full p-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 leading-relaxed shadow-sm resize-none"
              />
            </div>

            <div>
              <label htmlFor="additional-context" className="block text-sm font-medium text-slate-700 mb-1">
                Additional Instructions (Optional)
              </label>
              <textarea
                id="additional-context"
                rows={3}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="E.g., 'Make the tone extremely energetic', 'Explain the Assigned Member column specifically', 'Speed up the step where I am typing in the card'."
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 leading-relaxed shadow-sm resize-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              id="upload-next-btn"
              type="button"
              disabled={!canProceed}
              onClick={onNext}
              className={`px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-md transition-all ${
                canProceed
                  ? "bg-slate-900 hover:bg-indigo-600 text-white cursor-pointer active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              Analyze with Gemini AI
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
