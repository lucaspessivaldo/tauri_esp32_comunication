import { useConnectionStore } from "../../store/connectionStore";
import type { ChangeEvent } from "react";
import { isDeviceSignalConfig } from "../../utils/deviceCodec";

export function ConfigUploader() {
  const {
    status,
    configJson,
    loadedConfig,
    setConfigJson,
    parseConfig,
    uploadConfig,
  } = useConnectionStore();

  const handlePaste = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setConfigJson(e.target.value);
  };

  const handleValidate = () => {
    parseConfig();
  };

  const handleFileLoad = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        setConfigJson(text);
        parseConfig();
      }
    };
    input.click();
  };

  return (
    <div className="p-3 bg-card border border-border rounded-lg">
      <div className="flex items-start gap-4">
        {/* Left side - text area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Signal Configuration</h2>
            <p className="text-muted-foreground text-xs">
              Paste JSON from Signal Generator or load a file
            </p>
          </div>

          <textarea
            value={configJson}
            onChange={handlePaste}
            placeholder={`{\n  "name": "My Signal",\n  "CKP": "SIG1...",\n  "CMP1": null,\n  "CMP2": null\n}`}
            className="w-full h-24 px-2 py-1.5 bg-muted border border-border rounded-md text-foreground font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Right side - validation info and buttons */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          {loadedConfig ? (
            <div className="p-2 bg-green-900/30 border border-green-700 rounded-md">
              <div className="text-green-400 text-xs font-medium mb-1">✓ Config Valid</div>
              {isDeviceSignalConfig(loadedConfig) ? (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <div>Name: <span className="text-foreground">{loadedConfig.name}</span></div>
                  <div>Format: <span className="text-foreground">SIG1</span></div>
                  <div>CKP: <span className="text-foreground">{loadedConfig.CKP.length}b</span></div>
                  <div>CMP1: <span className="text-foreground">{loadedConfig.CMP1 ? loadedConfig.CMP1.length : 0}b</span></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <div>RPM: <span className="text-foreground">{loadedConfig.rpm}</span></div>
                  <div>Cycle: <span className="text-foreground">{loadedConfig.cycle}°</span></div>
                  <div>CKP: <span className="text-foreground">{loadedConfig.signals.ckp.edges.length} edges</span></div>
                  <div>Format: <span className="text-foreground">Legacy</span></div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground">
              No config loaded
            </div>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={handleFileLoad}
              className="flex-1 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-md text-foreground text-xs transition-colors"
            >
              📂 Load File
            </button>

            <button
              onClick={handleValidate}
              disabled={!configJson.trim()}
              className="flex-1 py-1.5 bg-primary hover:bg-primary/90 rounded-md text-primary-foreground text-xs transition-colors disabled:opacity-50"
            >
              ✓ Validate
            </button>
          </div>

          <button
            onClick={() => uploadConfig()}
            disabled={!status.connected || !configJson.trim()}
            className="w-full py-1.5 bg-green-600 hover:bg-green-500 rounded-md text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            ⬆ Upload to ESP32
          </button>
        </div>
      </div>
    </div>
  );
}
