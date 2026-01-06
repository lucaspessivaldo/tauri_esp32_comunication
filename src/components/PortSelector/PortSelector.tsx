import { useEffect } from "react";
import { useConnectionStore } from "../../store/connectionStore";

export function PortSelector() {
  const {
    ports,
    selectedPort,
    status,
    isConnecting,
    refreshPorts,
    selectPort,
    connect,
    disconnect,
  } = useConnectionStore();

  useEffect(() => {
    refreshPorts();
  }, []);

  return (
    <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg">
      <label className="text-gray-300 font-medium">Port:</label>
      <select
        value={selectedPort || ""}
        onChange={(e) => selectPort(e.target.value || null)}
        disabled={status.connected || isConnecting}
        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="">Select a port...</option>
        {ports.map((port) => (
          <option key={port.name} value={port.name}>
            {port.name} - {port.port_type}
          </option>
        ))}
      </select>

      <button
        onClick={refreshPorts}
        disabled={status.connected || isConnecting}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white transition-colors disabled:opacity-50"
        title="Refresh ports"
      >
        🔄
      </button>

      {status.connected ? (
        <button
          onClick={disconnect}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md text-white font-medium transition-colors"
        >
          Disconnect
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={!selectedPort || isConnecting}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </button>
      )}
    </div>
  );
}
