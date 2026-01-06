import { useConnectionStore } from "../../store/connectionStore";

export function ConfigUploader() {
  const {
    status,
    configJson,
    loadedConfig,
    setConfigJson,
    parseConfig,
    uploadConfig,
  } = useConnectionStore();

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    <div className="p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold text-white mb-3">Signal Configuration</h2>

      <p className="text-gray-400 text-sm mb-3">
        Paste the signal JSON from the Signal Generator web app, or load a config file.
      </p>

      <textarea
        value={configJson}
        onChange={handlePaste}
        placeholder={`{
  "rpm": 2500,
  "cycle": 720,
  "signals": {
    "ckp": { "edges": [...] },
    "cmp1": { "edges": [...] },
    "cmp2": { "edges": [...] }
  }
}`}
        className="w-full h-40 px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loadedConfig && (
        <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-md">
          <div className="text-green-400 text-sm font-medium mb-2">✓ Config Valid</div>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
            <div>RPM: <span className="text-white">{loadedConfig.rpm}</span></div>
            <div>Cycle: <span className="text-white">{loadedConfig.cycle}°</span></div>
            <div>CKP Edges: <span className="text-white">{loadedConfig.signals.ckp.edges.length}</span></div>
            <div>CMP1 Edges: <span className="text-white">{loadedConfig.signals.cmp1.edges.length}</span></div>
            <div>CMP2 Edges: <span className="text-white">{loadedConfig.signals.cmp2.edges.length}</span></div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleFileLoad}
          className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white text-sm transition-colors"
        >
          📂 Load File
        </button>

        <button
          onClick={handleValidate}
          disabled={!configJson.trim()}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white text-sm transition-colors disabled:opacity-50"
        >
          ✓ Validate
        </button>

        <button
          onClick={uploadConfig}
          disabled={!status.connected || !configJson.trim()}
          className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-md text-white text-sm transition-colors disabled:opacity-50"
        >
          ⬆ Upload to ESP32
        </button>
      </div>
    </div>
  );
}
