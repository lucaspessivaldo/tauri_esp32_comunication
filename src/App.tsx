import { useEffect } from "react";
import { PortSelector } from "./components/PortSelector";
import { StatusDisplay } from "./components/StatusDisplay";
import { ControlPanel } from "./components/ControlPanel";
import { SignalLibrary } from "./components/SignalLibrary";
import { ConfigUploader } from "./components/ConfigUploader";
import { useConnectionStore } from "./store/connectionStore";

function App() {
  const { status, refreshStatus } = useConnectionStore();

  // Auto-refresh status every 2 seconds when connected (but skip when busy with commands)
  useEffect(() => {
    if (!status.connected) return;

    const interval = setInterval(() => {
      // Skip refresh if a command is in progress to prevent serial contention
      if (!useConnectionStore.getState().isCommandBusy) {
        refreshStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status.connected, refreshStatus]);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-center">
          🔌 ESP32 CKP/CMP Signal Injector
        </h1>
        <p className="text-gray-400 text-center text-sm mt-1">
          Control and configure your signal generator
        </p>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Connection & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Port Selection */}
            <PortSelector />

            {/* Status and Controls - Side by Side */}
            <div className="grid md:grid-cols-2 gap-6">
              <StatusDisplay />
              <ControlPanel />
            </div>

            {/* Config Uploader with Debug Info */}
            <ConfigUploader />
          </div>

          {/* Right Column - Signal Library */}
          <div className="lg:col-span-1">
            <SignalLibrary
              isConnected={status.connected}
              onStatusChange={refreshStatus}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-6 py-2">
        <p className="text-gray-500 text-xs text-center">
          Autodiag Signal Injector Controller • v0.1.0
        </p>
      </footer>
    </div>
  );
}

export default App;
