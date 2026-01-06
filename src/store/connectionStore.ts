import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { DeviceStatus, PortInfo, FullConfig } from "../types";

interface ConnectionState {
  // Connection state
  ports: PortInfo[];
  selectedPort: string | null;
  status: DeviceStatus;
  isConnecting: boolean;
  error: string | null;

  // Signal config
  loadedConfig: FullConfig | null;
  configJson: string;

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
}

const defaultStatus: DeviceStatus = {
  connected: false,
  port_name: null,
  running: false,
  rpm: 0,
  raw_response: "",
};

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  ports: [],
  selectedPort: null,
  status: defaultStatus,
  isConnecting: false,
  error: null,
  loadedConfig: null,
  configJson: "",

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
    try {
      await invoke("run_signal");
      await get().refreshStatus();
    } catch (e) {
      set({ error: `Run failed: ${e}` });
    }
  },

  stopSignal: async () => {
    try {
      await invoke("stop_signal");
      await get().refreshStatus();
    } catch (e) {
      set({ error: `Stop failed: ${e}` });
    }
  },

  increaseRpm: async () => {
    try {
      await invoke("increase_rpm");
      await get().refreshStatus();
    } catch (e) {
      set({ error: `Increase RPM failed: ${e}` });
    }
  },

  decreaseRpm: async () => {
    try {
      await invoke("decrease_rpm");
      await get().refreshStatus();
    } catch (e) {
      set({ error: `Decrease RPM failed: ${e}` });
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
    const { configJson } = get();
    if (!configJson.trim()) {
      set({ error: "No config to upload" });
      return;
    }

    try {
      await invoke("upload_config", { config: configJson });
      await get().refreshStatus();
      set({ error: null });
    } catch (e) {
      set({ error: `Upload failed: ${e}` });
    }
  },

  setConfigJson: (json) => {
    set({ configJson: json });
  },

  parseConfig: () => {
    const { configJson } = get();
    try {
      const parsed = JSON.parse(configJson) as FullConfig;
      set({ loadedConfig: parsed, error: null });
    } catch (e) {
      set({ error: `Invalid JSON: ${e}`, loadedConfig: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
