import React, { useState } from "react";
import { WalkthroughStep, SpeedAction } from "../types";
import { Timer, Plus, Trash2, Scissors, Zap, Ban, RefreshCw, ChevronRight, Volume2, CheckCircle2 } from "lucide-react";

interface Step2TimelineProps {
  steps: WalkthroughStep[];
  setSteps: React.Dispatch<React.SetStateAction<WalkthroughStep[]>>;
  videoDuration: number;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2Timeline({
  steps,
  setSteps,
  videoDuration,
  onNext,
  onBack,
}: Step2TimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateStepField = (id: string, field: keyof WalkthroughStep, value: any) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id === id) {
          return { ...step, [field]: value };
        }
        return step;
      })
    );
  };

  const handleActionChange = (id: string, action: SpeedAction) => {
    updateStepField(id, "action", action);
  };

  const handleAddStep = () => {
    const lastEndTime = steps.length > 0 ? steps[steps.length - 1].endTime : 0;
    const nextStart = Math.min(lastEndTime, videoDuration);
    const nextEnd = Math.min(nextStart + 5, videoDuration);
    
    const newStep: WalkthroughStep = {
      id: crypto.randomUUID(),
      title: `New Walkthrough Step ${steps.length + 1}`,
      startTime: nextStart,
      endTime: nextEnd,
      action: "normal",
      script: "In this step, we show a nice feature...",
    };
    setSteps([...steps, newStep]);
    setEditingId(newStep.id);
  };

  const handleDeleteStep = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // Compute calculated speeds runtime
  const calculateAdjustedTimes = () => {
    let rawCumulativeOriginal = 0;
    let adjustedDuration = 0;
    
    const processed = steps.map((step) => {
      const origDiff = step.endTime - step.startTime;
      let adjDiff = origDiff;
      
      if (step.action === "speed_up_2x") {
        adjDiff = origDiff / 2;
      } else if (step.action === "speed_up_4x") {
        adjDiff = origDiff / 4;
      } else if (step.action === "skip") {
        adjDiff = 0;
      }

      const originalStart = step.startTime;
      const originalEnd = step.endTime;
      const adjustedStart = adjustedDuration;
      const adjustedEnd = adjustedDuration + adjDiff;

      adjustedDuration += adjDiff;

      return {
        ...step,
        origDiff,
        adjDiff,
        adjustedStart,
        adjustedEnd,
      };
    });

    return {
      processedSteps: processed,
      totalAdjusted: adjustedDuration,
    };
  };

  const { processedSteps, totalAdjusted } = calculateAdjustedTimes();

  // Validate that segments do not cross borders
  const handleValidateTime = (id: string, start: number, end: number) => {
    let s = Math.max(0, Math.min(start, videoDuration));
    let e = Math.max(s + 1, Math.min(end, videoDuration));
    
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id === id) {
          return { ...step, startTime: s, endTime: e };
        }
        return step;
      })
    );
  };

  const getActionColor = (action: SpeedAction) => {
    switch (action) {
      case "normal":
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
      case "speed_up_2x":
        return "bg-amber-50 border-amber-200 text-amber-700";
      case "speed_up_4x":
        return "bg-orange-50 border-orange-200 text-orange-800";
      case "skip":
        return "bg-rose-50 border-rose-100 text-rose-700";
    }
  };

  const getActionBadge = (action: SpeedAction) => {
    switch (action) {
      case "normal":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Normal Speed</span>;
      case "speed_up_2x":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">2x Hyper-Lapse</span>;
      case "speed_up_4x":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">4x Quick-Skip</span>;
      case "skip":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Clipped / Skips</span>;
    }
  };

  return (
    <div id="step-2-container" className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 mb-2">
            <Timer className="w-5 h-5 text-indigo-500" />
            Step 2: Walkthrough Timeline & Speed Capabilities
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            Gemini broke down the walkthrough. Here you decide which steps should be sped up (to bypass loading/typing states) or entirely skipped, keeping narrative content punchy!
          </p>
        </div>
        <div className="flex flex-col text-right bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 min-w-[150px]">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Estimated Playtime</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-0.5">
            {formatTime(totalAdjusted)}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 line-through">
            Original: {formatTime(videoDuration)}
          </span>
        </div>
      </div>

      {/* Visual Timeline Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Visual Playback Sequence</h3>
        <div className="w-full h-8 rounded-lg bg-slate-200 border border-slate-300 flex overflow-hidden">
          {processedSteps.length === 0 ? (
            <div className="w-full flex items-center justify-center text-xs text-slate-400">
              No timeline segments created yet.
            </div>
          ) : (
            processedSteps.map((step, idx) => {
              const origLen = step.endTime - step.startTime;
              const ratio = (origLen / videoDuration) * 100;
              let bg = "bg-emerald-400";
              if (step.action === "speed_up_2x") bg = "bg-amber-400";
              if (step.action === "speed_up_4x") bg = "bg-orange-400";
              if (step.action === "skip") bg = "bg-rose-400 opacity-40";

              return (
                <div
                  key={step.id}
                  style={{ width: `${ratio}%` }}
                  title={`${step.title} (${formatTime(step.startTime)} - ${formatTime(step.endTime)}) [${step.action}]`}
                  className={`${bg} h-full border-r border-white/20 relative group cursor-pointer`}
                  onClick={() => setEditingId(step.id)}
                >
                  <span className="absolute left-1 bottom-1 text-[9px] font-mono text-slate-900 font-bold opacity-0 group-hover:opacity-100 bg-white/90 px-1 py-0.5 rounded truncate max-w-full">
                    {step.title}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-4 justify-center items-center mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400 rounded"></span>Normal (1x)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-400 rounded"></span>Speed 2x</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-orange-400 rounded"></span>Speed 4x</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-300 rounded"></span>Skip (0x)</span>
        </div>
      </div>

      {/* Editing step cards */}
      <div id="timeline-edit-list" className="space-y-4">
        {processedSteps.map((step, idx) => {
          const isEditing = editingId === step.id;
          const bgClass = getActionColor(step.action);

          return (
            <div
              key={step.id}
              className={`border rounded-xl transition-all ${
                isEditing ? "border-indigo-500 ring-2 ring-indigo-500/10 shadow-md" : "border-slate-200"
              } bg-white`}
            >
              <div 
                className={`p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer`}
                onClick={() => setEditingId(isEditing ? null : step.id)}
              >
                {/* Index & Title */}
                <div className="flex items-start gap-3 w-full md:w-auto">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-800 text-base">{step.title}</h4>
                      {getActionBadge(step.action)}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Video Timestamp range: <span className="font-semibold text-slate-700">{formatTime(step.startTime)}</span> to <span className="font-semibold text-slate-700">{formatTime(step.endTime)}</span> ({step.endTime - step.startTime} seconds)
                    </div>
                  </div>
                </div>

                {/* Right actions list */}
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(isEditing ? null : step.id);
                    }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                      isEditing
                        ? "bg-slate-100 border-slate-300 text-slate-700"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    }`}
                  >
                    {isEditing ? "Collapse Edit" : "Configure Step"}
                  </button>
                  <button
                    type="button"
                    title="Delete step"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-slate-200"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Collapsible Editor Box */}
              {isEditing && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-4 rounded-b-xl animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Title */}
                    <div className="md:col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Step Headline</label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStepField(step.id, "title", e.target.value)}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    {/* Timeline slider bounds */}
                    <div className="md:col-span-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Start Time (sec)</label>
                        <input
                          type="number"
                          min={0}
                          max={step.endTime - 1}
                          value={step.startTime}
                          onChange={(e) => handleValidateTime(step.id, Number(e.target.value), step.endTime)}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">End Time (sec)</label>
                        <input
                          type="number"
                          min={step.startTime + 1}
                          max={videoDuration}
                          value={step.endTime}
                          onChange={(e) => handleValidateTime(step.id, step.startTime, Number(e.target.value))}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono bg-white"
                        />
                      </div>
                    </div>

                    {/* Segment Action Option */}
                    <div className="md:col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Speed Playback Setting</label>
                      <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                        {(["normal", "speed_up_2x", "speed_up_4x", "skip"] as SpeedAction[]).map((act) => {
                          const isActive = step.action === act;
                          let actLabel = "";
                          if (act === "normal") actLabel = "Normal";
                          if (act === "speed_up_2x") actLabel = "2x";
                          if (act === "speed_up_4x") actLabel = "4x";
                          if (act === "skip") actLabel = "Skip";

                          return (
                            <button
                              key={act}
                              type="button"
                              onClick={() => handleActionChange(step.id, act)}
                              className={`text-[11px] font-bold py-1.5 px-1 rounded-md text-center border transition-all ${
                                isActive
                                  ? "bg-white border-slate-300 text-slate-800 shadow-sm"
                                  : "border-transparent text-slate-500 hover:text-slate-700"
                              }`}
                            >
                              {actLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* script narration script */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" />
                        Narration Script (What the voiceover says)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Fits best: ~{Math.round((step.endTime - step.startTime) * 2.5)} words
                      </span>
                    </div>
                    {step.action === "skip" ? (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 border border-amber-100 rounded-lg">
                        This section is skipped/clipped. The script is omitted during playback narration.
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        value={step.script}
                        onChange={(e) => updateStepField(step.id, "script", e.target.value)}
                        placeholder="Write narration lines to speak..."
                        className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white shadow-inner"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-slate-100">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer"
          >
            Back to Upload
          </button>
          <button
            type="button"
            onClick={handleAddStep}
            className="px-4 py-2 border border-dashed border-indigo-300 rounded-xl text-indigo-700 text-sm font-semibold hover:bg-indigo-50/50 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Segment
          </button>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={steps.length === 0}
          className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow flex items-center gap-1 transition-all ${
            steps.length > 0
              ? "bg-slate-900 hover:bg-indigo-600 cursor-pointer active:scale-95"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          Proceed to Voice Selection
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
