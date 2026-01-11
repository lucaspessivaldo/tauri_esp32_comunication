import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { DeviceSignalConfig, DeviceStatus, FullConfig, PortInfo, UploadDebugInfo, UploadResult } from "../types";
import { prepareConfigForUpload, debugDecodeSig1Blob } from "../utils/deviceCodec";

interface ConnectionState {
  // Connection state
  ports: PortInfo[];
  selectedPort: string | null;
  status: DeviceStatus;
  isConnecting: boolean;
  isCommandBusy: boolean;
  error: string | null;

  // Config (either legacy full config or device config)
  loadedConfig: FullConfig | DeviceSignalConfig | null;
  configJson: string;

  // Upload debug info
  lastUploadDebug: UploadDebugInfo | null;

  // Actions
  refreshPorts: () => Promise<void>;
  selectPort: (port: string | null) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  runSignal: () => Promise<void>;
  stopSignal: () => Promise<void>;
  increaseRpm: () => Promise<void>;
  decreaseRpm: () => Promise<void>;
  saveToNvs: () => Promise<void>;
  resetDefaults: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  uploadConfig: () => Promise<void>;
  setConfigJson: (json: string) => void;
  parseConfig: () => void;
  clearError: () => void;
  clearUploadDebug: () => void;
}

const defaultStatus: DeviceStatus = {
  connected: false,
  port_name: null,
  running: false,
  rpm: 0,
  raw_response: "",
};

function parseRpmFromResponse(response: string): number | null {
  const match = response.match(/RPM:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseRunningFromResponse(response: string): boolean | null {
  if (response.includes("RUN") || response.includes("Running")) return true;
  if (response.includes("STOP") || response.includes("Stopped")) return false;
  return null;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  ports: [],
  selectedPort: null,
  status: defaultStatus,
  isConnecting: false,
  isCommandBusy: false,
  error: null,

  loadedConfig: null,
  configJson: "",
  lastUploadDebug: null,

  refreshPorts: async () => {
    try {
      const ports = await invoke<PortInfo[]>("list_ports");
      set({ ports, error: null });
    } catch (e) {
      set({ error: `Failed to list ports: ${e}` });
    }
  },

  selectPort: (port) => {
    set({ selectedPort: port });
  },

  connect: async () => {
    const { selectedPort } = get();
    if (!selectedPort) {
      set({ error: "No port selected" });
      return;
    }

    set({ isConnecting: true, error: null });
    try {
      await invoke("connect", { port: selectedPort });
      await get().refreshStatus();
      set({ isConnecting: false });
    } catch (e) {
      set({ isConnecting: false, error: `Connection failed: ${e}` });
    }
  },

  disconnect: async () => {
    try {
      await invoke("disconnect");
      set({ status: defaultStatus, error: null });
    } catch (e) {
      set({ error: `Disconnect failed: ${e}` });
    }
  },

  runSignal: async () => {
    if (get().isCommandBusy) return;
    set({ isCommandBusy: true });
    try {
      const response = await invoke<string>("run_signal");
      const running = parseRunningFromResponse(response);
      set((state) => ({ status: { ...state.status, running: running ?? true } }));
    } catch (e) {
      set({ error: `Run failed: ${e}` });
    } finally {
      set({ isCommandBusy: false });
    }
  },

  stopSignal: async () => {
    if (get().isCommandBusy) return;
    set({ isCommandBusy: true });
    try {
      const response = await invoke<string>("stop_signal");
      const running = parseRunningFromResponse(response);
      set((state) => ({ status: { ...state.status, running: running ?? false } }));
    } catch (e) {
      set({ error: `Stop failed: ${e}` });
    } finally {
      set({ isCommandBusy: false });
    }
  },

  increaseRpm: async () => {
    if (get().isCommandBusy) return;
    set({ isCommandBusy: true });
    try {
      const response = await invoke<string>("increase_rpm");
      const rpm = parseRpmFromResponse(response);
      if (rpm !== null) set((state) => ({ status: { ...state.status, rpm } }));
    } catch (e) {
      set({ error: `Increase RPM failed: ${e}` });
    } finally {
      set({ isCommandBusy: false });
    }
  },

  decreaseRpm: async () => {
    if (get().isCommandBusy) return;
    set({ isCommandBusy: true });
    try {
      const response = await invoke<string>("decrease_rpm");
      const rpm = parseRpmFromResponse(response);
      if (rpm !== null) set((state) => ({ status: { ...state.status, rpm } }));
    } catch (e) {
      set({ error: `Decrease RPM failed: ${e}` });
    } finally {
      set({ isCommandBusy: false });
    }
  },

  saveToNvs: async () => {
    try {
      await invoke("save_to_nvs");
      set({ error: null });
    } catch (e) {
      set({ error: `Save to NVS failed: ${e}` });
    }
  },

  resetDefaults: async () => {
    try {
      await invoke("reset_defaults");
      await get().refreshStatus();
    } catch (e) {
      set({ error: `Reset defaults failed: ${e}` });
    }
  },

  refreshStatus: async () => {
    try {
      const status = await invoke<DeviceStatus>("get_status");
      set({ status, error: null });
    } catch (e) {
      set({ error: `Status refresh failed: ${e}` });
    }
  },

  uploadConfig: async () => {
    if (get().isCommandBusy) return;
    const { configJson } = get();
    if (!configJson.trim()) {
      set({ error: "No config to upload" });
      return;
    }

    set({ isCommandBusy: true, lastUploadDebug: null });

    // Prepare debug info
    let debugInfo: UploadDebugInfo = {
      timestamp: new Date(),
      configJson: configJson.substring(0, 2000), // Limit stored config preview
      signalName: "Unknown",
      ckpBlob: "",
      cmp1Blob: null,
      cmp2Blob: null,
      ckpLength: 0,
      cmp1Length: null,
      cmp2Length: null,
      totalBytes: 0,
      result: null,
      preparationError: null,
      ckpDecoded: null,
      cmp1Decoded: null,
      cmp2Decoded: null,
    };

    try {
      const { jsonToSend, device } = prepareConfigForUpload(configJson);

      // Extract info for debugging
      debugInfo.signalName = device.name;
      debugInfo.ckpBlob = device.CKP?.substring(0, 100) || "";
      debugInfo.cmp1Blob = device.CMP1?.substring(0, 100) || null;
      debugInfo.cmp2Blob = device.CMP2?.substring(0, 100) || null;
      debugInfo.ckpLength = device.CKP?.length || 0;
      debugInfo.cmp1Length = device.CMP1?.length || null;
      debugInfo.cmp2Length = device.CMP2?.length || null;
      debugInfo.totalBytes = jsonToSend.length;
      debugInfo.configJson = jsonToSend.substring(0, 2000); // Store the actual sent JSON

      // Decode blobs for debugging CRC issues
      debugInfo.ckpDecoded = debugDecodeSig1Blob(device.CKP);
      debugInfo.cmp1Decoded = device.CMP1 ? debugDecodeSig1Blob(device.CMP1) : null;
      debugInfo.cmp2Decoded = device.CMP2 ? debugDecodeSig1Blob(device.CMP2) : null;

      const result = await invoke<UploadResult>("upload_config", { config: jsonToSend });
      debugInfo.result = result;

      if (result.success) {
        await get().refreshStatus();
        set({ error: null, lastUploadDebug: debugInfo });
      } else {
        const errorMsg = result.error_message || "Upload failed (unknown reason)";
        set({
          error: `Upload failed: ${errorMsg}`,
          lastUploadDebug: debugInfo
        });
      }
    } catch (e) {
      // This catches preparation errors (invalid JSON, etc.) or invoke errors
      const errorStr = String(e);
      debugInfo.preparationError = errorStr;
      set({
        error: `Upload failed: ${errorStr}`,
        lastUploadDebug: debugInfo
      });
    } finally {
      set({ isCommandBusy: false });
    }
  },

  setConfigJson: (json) => {
    set({ configJson: json });
  },

  parseConfig: () => {
    const { configJson } = get();
    try {
      const { device } = prepareConfigForUpload(configJson);

      // Keep legacy in the preview UI when pasted
      let legacy: FullConfig | null = null;
      try {
        const maybeLegacy = JSON.parse(configJson) as unknown;
        if (
          typeof maybeLegacy === "object" &&
          maybeLegacy !== null &&
          "signals" in (maybeLegacy as Record<string, unknown>)
        ) {
          legacy = maybeLegacy as FullConfig;
        }
      } catch {
        legacy = null;
      }

      set({ loadedConfig: legacy ?? device, error: null });
    } catch (e) {
      set({ error: `Invalid JSON: ${e}`, loadedConfig: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearUploadDebug: () => {
    set({ lastUploadDebug: null });
  },
}));
