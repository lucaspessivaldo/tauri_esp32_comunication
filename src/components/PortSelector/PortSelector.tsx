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
    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
      <label className="text-muted-foreground font-medium text-sm shrink-0">Port:</label>
      <select
        value={selectedPort || ""}
        onChange={(e) => selectPort(e.target.value || null)}
        disabled={status.connected || isConnecting}
        className="flex-1 px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
        className="p-1.5 bg-muted hover:bg-muted/80 border border-border rounded-md text-foreground transition-colors disabled:opacity-50"
        title="Refresh ports"
      >
        🔄
      </button>

      {status.connected ? (
        <button
          onClick={disconnect}
          className="px-4 py-1.5 bg-destructive hover:bg-destructive/90 rounded-md text-destructive-foreground font-medium text-sm transition-colors"
        >
          Disconnect
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={!selectedPort || isConnecting}
          className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-md text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </button>
      )}
    </div>
  );
}
