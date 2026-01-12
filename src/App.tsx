import { useEffect, useState } from "react";
import { PortSelector } from "./components/PortSelector";
import { StatusDisplay } from "./components/StatusDisplay";
import { ControlPanel } from "./components/ControlPanel";
import { SignalLibrary } from "./components/SignalLibrary";
import { ConfigUploader } from "./components/ConfigUploader";
import { SignalEditor } from "./components/SignalEditor";
import { useConnectionStore } from "./store/connectionStore";
import type { DeviceStatus } from "./types";
import { Cpu, Waves } from "lucide-react";

type Tab = 'device' | 'editor';

function App() {
  const { status, refreshStatus } = useConnectionStore();
  const [activeTab, setActiveTab] = useState<Tab>('device');

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Tab Bar */}
      <nav className="bg-card border-b border-border">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('device')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'device'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              <Cpu className="w-4 h-4" />
              Device Control
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'editor'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              <Waves className="w-4 h-4" />
              Signal Editor
            </button>
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      {activeTab === 'device' ? (
        <DeviceControlTab status={status} refreshStatus={refreshStatus} />
      ) : (
        <SignalEditor />
      )}
    </div>
  );
}

interface DeviceControlTabProps {
  status: DeviceStatus;
  refreshStatus: () => void;
}

function DeviceControlTab({ status, refreshStatus }: DeviceControlTabProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-3 shrink-0">
        <h1 className="text-xl font-bold text-center">
          🔌 ESP32 CKP/CMP Signal Injector
        </h1>
        <p className="text-muted-foreground text-center text-xs mt-0.5">
          Control and configure your signal generator
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4">
        <div className="h-full flex flex-col gap-4">
          {/* Top Row - Port Selector */}
          <div className="shrink-0">
            <PortSelector />
          </div>

          {/* Main Grid - Status, Controls, Signal Library */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
            {/* Left Column - Status Display */}
            <div className="lg:col-span-3 flex flex-col">
              <StatusDisplay />
            </div>

            {/* Middle Column - Controls */}
            <div className="lg:col-span-4 flex flex-col">
              <ControlPanel />
            </div>

            {/* Right Column - Signal Library */}
            <div className="lg:col-span-5 flex flex-col">
              <SignalLibrary
                isConnected={status.connected}
                onStatusChange={refreshStatus}
              />
            </div>
          </div>

          {/* Bottom Row - Config Uploader */}
          <div className="shrink-0">
            <ConfigUploader />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 bg-card border-t border-border px-6 py-1.5">
        <p className="text-muted-foreground text-xs text-center">
          Autodiag Signal Injector Controller • v0.1.0
        </p>
      </footer>
    </div>
  );
}

export default App;
