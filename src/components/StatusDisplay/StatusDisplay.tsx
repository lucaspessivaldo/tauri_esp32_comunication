import { useConnectionStore } from "../../store/connectionStore";

export function StatusDisplay() {
  const { status, error, clearError } = useConnectionStore();

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold text-white mb-3">Device Status</h2>

      {error && (
        <div className="mb-3 p-3 bg-red-900/50 border border-red-700 rounded-md flex items-center justify-between">
          <span className="text-red-300 text-sm">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-200 text-lg"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${status.connected ? "bg-green-500" : "bg-red-500"
              }`}
          />
          <span className="text-gray-300">
            {status.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {status.connected && (
          <>
            <div className="text-gray-300">
              Port: <span className="text-white font-mono">{status.port_name}</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${status.running ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                  }`}
              />
              <span className="text-gray-300">
                {status.running ? "Running" : "Stopped"}
              </span>
            </div>

            <div className="text-gray-300">
              RPM: <span className="text-white font-bold text-xl">{status.rpm}</span>
            </div>
          </>
        )}
      </div>

      {status.raw_response && (
        <details className="mt-4">
          <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
            Raw Response
          </summary>
          <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-auto max-h-32">
            {status.raw_response}
          </pre>
        </details>
      )}
    </div>
  );
}
