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
    <div className="p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold text-white mb-4">Controls</h2>

      {/* RPM Display and Controls */}
      <div className="mb-6">
        <div className="text-center mb-4">
          <span className="text-gray-400 text-sm">Current RPM</span>
          <div className="text-5xl font-bold text-white font-mono">
            {status.rpm || "---"}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={debouncedDecreaseRpm}
            disabled={isDisabled || isCommandBusy}
            className="w-14 h-14 text-2xl bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>

          <div className="text-gray-400 text-sm">
            {isCommandBusy ? "..." : "±100 RPM"}
          </div>

          <button
            onClick={debouncedIncreaseRpm}
            disabled={isDisabled || isCommandBusy}
            className="w-14 h-14 text-2xl bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        <div className="mt-2 text-center text-gray-500 text-xs">
          Range: 100 - 5000 RPM
        </div>
      </div>

      {/* Run/Stop Controls */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={runSignal}
          disabled={isDisabled || status.running}
          className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span>▶</span> RUN
        </button>

        <button
          onClick={stopSignal}
          disabled={isDisabled || !status.running}
          className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span>⏹</span> STOP
        </button>
      </div>

      {/* Additional Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={refreshStatus}
          disabled={isDisabled}
          className="py-2 px-3 bg-gray-600 hover:bg-gray-500 rounded-md text-white text-sm transition-colors disabled:opacity-50"
        >
          🔄 Refresh
        </button>

        <button
          onClick={saveToNvs}
          disabled={isDisabled}
          className="py-2 px-3 bg-purple-600 hover:bg-purple-500 rounded-md text-white text-sm transition-colors disabled:opacity-50"
          title="Save current config to ESP32 flash memory"
        >
          💾 Save NVS
        </button>

        <button
          onClick={resetDefaults}
          disabled={isDisabled}
          className="py-2 px-3 bg-orange-600 hover:bg-orange-500 rounded-md text-white text-sm transition-colors disabled:opacity-50"
          title="Reset to factory defaults"
        >
          🔧 Reset
        </button>
      </div>
    </div>
  );
}
