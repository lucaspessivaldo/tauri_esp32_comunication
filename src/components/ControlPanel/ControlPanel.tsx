import { useRef, useCallback } from "react";
import { useConnectionStore } from "../../store/connectionStore";

export function ControlPanel() {
  const {
    status,
    isCommandBusy,
    runSignal,
    stopSignal,
    increaseRpm,
    decreaseRpm,
    saveToNvs,
    resetDefaults,
    refreshStatus,
  } = useConnectionStore();

  const isDisabled = !status.connected;

  // Debounce timers for RPM buttons
  const lastRpmClickRef = useRef<number>(0);
  const DEBOUNCE_MS = 150;

  const debouncedIncreaseRpm = useCallback(() => {
    const now = Date.now();
    if (now - lastRpmClickRef.current < DEBOUNCE_MS) return;
    lastRpmClickRef.current = now;
    increaseRpm();
  }, [increaseRpm]);

  const debouncedDecreaseRpm = useCallback(() => {
    const now = Date.now();
    if (now - lastRpmClickRef.current < DEBOUNCE_MS) return;
    lastRpmClickRef.current = now;
    decreaseRpm();
  }, [decreaseRpm]);

  return (
    <div className="p-3 bg-card border border-border rounded-lg h-full flex flex-col">
      <h2 className="text-sm font-semibold text-foreground mb-2">Controls</h2>

      {/* RPM Display and Controls */}
      <div className="mb-4 flex-1">
        <div className="text-center mb-2">
          <span className="text-muted-foreground text-xs">Current RPM</span>
          <div className="text-4xl font-bold text-foreground font-mono">
            {status.rpm || "---"}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={debouncedDecreaseRpm}
            disabled={isDisabled || isCommandBusy}
            className="w-10 h-10 text-xl bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>

          <div className="text-muted-foreground text-xs">
            {isCommandBusy ? "..." : "±100 RPM"}
          </div>

          <button
            onClick={debouncedIncreaseRpm}
            disabled={isDisabled || isCommandBusy}
            className="w-10 h-10 text-xl bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        <div className="mt-1 text-center text-muted-foreground text-[10px]">
          Range: 100 - 5000 RPM
        </div>
      </div>

      {/* Run/Stop Controls */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={runSignal}
          disabled={isDisabled || status.running}
          className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span>▶</span> RUN
        </button>

        <button
          onClick={stopSignal}
          disabled={isDisabled || !status.running}
          className="flex-1 py-2 bg-destructive hover:bg-destructive/90 rounded-lg text-destructive-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span>⏹</span> STOP
        </button>
      </div>

      {/* Additional Controls */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={refreshStatus}
          disabled={isDisabled}
          className="py-1.5 px-2 bg-muted hover:bg-muted/80 border border-border rounded-md text-foreground text-xs transition-colors disabled:opacity-50"
        >
          🔄 Refresh
        </button>

        <button
          onClick={saveToNvs}
          disabled={isDisabled}
          className="py-1.5 px-2 bg-purple-600 hover:bg-purple-500 rounded-md text-white text-xs transition-colors disabled:opacity-50"
          title="Save current config to ESP32 flash memory"
        >
          💾 Save NVS
        </button>

        <button
          onClick={resetDefaults}
          disabled={isDisabled}
          className="py-1.5 px-2 bg-orange-600 hover:bg-orange-500 rounded-md text-white text-xs transition-colors disabled:opacity-50"
          title="Reset to factory defaults"
        >
          🔧 Reset
        </button>
      </div>
    </div>
  );
}
