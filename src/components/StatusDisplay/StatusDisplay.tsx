import { useConnectionStore } from "../../store/connectionStore";
import type { DecodedBlobInfo, UploadDebugInfo } from "../../types";
import { useState } from "react";

// Generate a full copyable debug report
function generateDebugReport(debug: UploadDebugInfo): string {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("UPLOAD DEBUG REPORT");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Time: ${debug.timestamp.toISOString()}`);
  lines.push(`Signal Name: ${debug.signalName}`);
  lines.push(`Total Payload: ${debug.totalBytes} bytes`);
  lines.push("");

  if (debug.result) {
    lines.push("-".repeat(40));
    lines.push("UPLOAD RESULT:");
    lines.push("-".repeat(40));
    lines.push(`Success: ${debug.result.success}`);
    lines.push(`Bytes Sent: ${debug.result.bytes_sent}`);
    lines.push(`Chunks Sent: ${debug.result.chunks_sent}`);
    if (debug.result.error_message) {
      lines.push(`Error: ${debug.result.error_message}`);
    }
    lines.push("");
  }

  if (debug.preparationError) {
    lines.push(`Preparation Error: ${debug.preparationError}`);
    lines.push("");
  }

  // Tauri-side decoded info
  const addBlobInfo = (name: string, decoded: DecodedBlobInfo | null | undefined) => {
    if (!decoded) return;
    lines.push("-".repeat(40));
    lines.push(`TAURI APP - ${name} DECODE:`);
    lines.push("-".repeat(40));
    lines.push(`Seed: ${decoded.seed}`);
    lines.push(`Edge Count: ${decoded.edgeCount}`);
    lines.push(`Stored CRC: ${decoded.storedCrc}`);
    lines.push(`Calculated CRC: ${decoded.calculatedCrc}`);
    lines.push(`CRC Match: ${decoded.crcMatch ? "YES ✓" : "NO ✗"}`);
    lines.push(`Raw Bytes (first 50): ${decoded.rawBytes}`);
    lines.push("");
  };

  addBlobInfo("CKP", debug.ckpDecoded);
  addBlobInfo("CMP1", debug.cmp1Decoded);
  addBlobInfo("CMP2", debug.cmp2Decoded);

  // ESP32 raw response (contains debug output)
  if (debug.result?.raw_response) {
    lines.push("-".repeat(40));
    lines.push("ESP32 RAW RESPONSE:");
    lines.push("-".repeat(40));
    lines.push(debug.result.raw_response);
    lines.push("");
  }

  // Config JSON
  lines.push("-".repeat(40));
  lines.push("CONFIG JSON:");
  lines.push("-".repeat(40));
  lines.push(debug.configJson);
  lines.push("");

  lines.push("=".repeat(60));
  lines.push("END OF REPORT");
  lines.push("=".repeat(60));

  return lines.join("\n");
}

// Button to copy full debug report
function CopyDebugButton({ debug }: { debug: UploadDebugInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const report = generateDebugReport(debug);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2 py-1 rounded ${copied
        ? "bg-green-600 text-white"
        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
        }`}
    >
      {copied ? "✓ Copied!" : "📋 Copy Debug Report"}
    </button>
  );
}

// Component to render decoded blob info with all edges
function DecodedBlobPanel({ name, decoded, color }: { name: string; decoded: DecodedBlobInfo; color: string }) {
  return (
    <div className={`mt-2 p-3 rounded border ${decoded.crcMatch ? "bg-gray-900 border-gray-700" : "bg-red-900/30 border-red-600"}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-sm font-bold ${color}`}>
          {name} Signal {!decoded.crcMatch && <span className="text-red-400">(CRC MISMATCH!)</span>}
        </h4>
        <span className="text-xs text-gray-400">{decoded.edgeCount} edges</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div><span className="text-gray-500">Seed:</span> <span className="font-mono text-yellow-400">{decoded.seed}</span></div>
        <div><span className="text-gray-500">Edge Count:</span> <span className="text-white font-bold">{decoded.edgeCount}</span></div>
        <div>
          <span className="text-gray-500">Stored CRC:</span>{" "}
          <span className="font-mono text-cyan-400">{decoded.storedCrc}</span>
        </div>
        <div>
          <span className="text-gray-500">Calc CRC:</span>{" "}
          <span className={`font-mono ${decoded.crcMatch ? "text-green-400" : "text-red-400 font-bold"}`}>
            {decoded.calculatedCrc}
          </span>
          {decoded.crcMatch ? " ✓" : " ✗"}
        </div>
      </div>

      <div className="text-xs">
        <div className="text-gray-500 mb-1">Raw bytes (first 50):</div>
        <pre className="p-2 bg-black rounded text-gray-400 font-mono overflow-auto text-[10px]">
          {decoded.rawBytes}
        </pre>
      </div>

      <details className="mt-2">
        <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
          All Edges ({decoded.allEdges.length} total)
        </summary>
        <div className="mt-1 p-2 bg-black rounded max-h-48 overflow-auto">
          <table className="w-full text-[10px] font-mono">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left px-1">#</th>
                <th className="text-left px-1">Angle</th>
                <th className="text-left px-1">Level</th>
              </tr>
            </thead>
            <tbody>
              {decoded.allEdges.map((edge, i) => (
                <tr key={i} className={i % 2 === 0 ? "text-gray-300" : "text-gray-400"}>
                  <td className="px-1">{i + 1}</td>
                  <td className="px-1">{edge.angle.toFixed(1)}°</td>
                  <td className={`px-1 ${edge.level === 1 ? "text-green-400" : "text-red-400"}`}>
                    {edge.level === 1 ? "HIGH" : "LOW"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function StatusDisplay() {
  const { status, error, clearError, lastUploadDebug, clearUploadDebug } = useConnectionStore();

  return (
    <div className="p-3 bg-card border border-border rounded-lg h-full flex flex-col">
      <h2 className="text-sm font-semibold text-foreground mb-2">Device Status</h2>

      {error && (
        <div className="mb-2 p-2 bg-destructive/20 border border-destructive rounded-md flex items-start justify-between gap-2">
          <span className="text-destructive text-xs break-words flex-1">{error}</span>
          <button
            onClick={clearError}
            className="text-destructive hover:text-destructive/80 text-sm shrink-0"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${status.connected ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-muted-foreground text-sm">
            {status.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {status.connected && (
          <>
            <div className="text-muted-foreground text-xs">
              Port: <span className="text-foreground font-mono">{status.port_name}</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${status.running ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
              />
              <span className="text-muted-foreground text-sm">
                {status.running ? "Running" : "Stopped"}
              </span>
            </div>
          </>
        )}
      </div>

      {status.raw_response && (
        <details className="mt-2">
          <summary className="text-muted-foreground text-xs cursor-pointer hover:text-foreground">
            Raw Response
          </summary>
          <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-auto max-h-32">
            {status.raw_response}
          </pre>
        </details>
      )}

      {/* Upload Debug Panel - Collapsed by default */}
      {lastUploadDebug && (
        <details className="mt-4">
          <summary className={`text-sm cursor-pointer flex items-center justify-between ${lastUploadDebug.result?.success ? "text-green-400" : "text-orange-400"
            }`}>
            <span>📤 Last Upload {lastUploadDebug.result?.success ? "✓" : "✗"}</span>
            <button
              onClick={(e) => { e.preventDefault(); clearUploadDebug(); }}
              className="text-gray-400 hover:text-gray-200 text-sm ml-2"
            >
              ×
            </button>
          </summary>

          <div className={`mt-2 p-3 rounded-md border ${lastUploadDebug.result?.success
            ? "bg-green-900/30 border-green-700"
            : "bg-orange-900/30 border-orange-700"
            }`}>
            {/* Basic Info */}
            <div className="text-xs text-gray-300 space-y-1 mb-3">
              <div><span className="text-gray-500">Time:</span> {lastUploadDebug.timestamp.toLocaleTimeString()}</div>
              <div><span className="text-gray-500">Signal:</span> <span className="text-white font-mono font-bold">{lastUploadDebug.signalName}</span></div>
              <div><span className="text-gray-500">Payload:</span> {lastUploadDebug.totalBytes} bytes</div>
              {lastUploadDebug.result && (
                <div><span className="text-gray-500">Sent:</span> {lastUploadDebug.result.bytes_sent} bytes / {lastUploadDebug.result.chunks_sent} chunks</div>
              )}
            </div>

            <CopyDebugButton debug={lastUploadDebug} />

            {/* ESP32 Error */}
            {lastUploadDebug.result?.error_message && (
              <div className="mt-3 p-2 bg-red-900/50 rounded border border-red-600">
                <div className="font-semibold text-red-300 text-xs mb-1">⚠️ Error:</div>
                <div className="font-mono text-red-200 text-xs">{lastUploadDebug.result.error_message}</div>
              </div>
            )}

            {/* Decoded Signal Info */}
            <details className="mt-3">
              <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
                Signal Data Details
              </summary>
              <div className="mt-2">
                {lastUploadDebug.ckpDecoded && (
                  <DecodedBlobPanel name="CKP" decoded={lastUploadDebug.ckpDecoded} color="text-green-400" />
                )}
                {lastUploadDebug.cmp1Decoded && (
                  <DecodedBlobPanel name="CMP1" decoded={lastUploadDebug.cmp1Decoded} color="text-blue-400" />
                )}
                {lastUploadDebug.cmp2Decoded && (
                  <DecodedBlobPanel name="CMP2" decoded={lastUploadDebug.cmp2Decoded} color="text-purple-400" />
                )}
              </div>
            </details>
          </div>
        </details>
      )}
    </div>
  );
}
