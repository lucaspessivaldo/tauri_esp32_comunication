export interface PortInfo {
  name: string;
  port_type: string;
}

export interface DeviceStatus {
  connected: boolean;
  port_name: string | null;
  running: boolean;
  rpm: number;
  raw_response: string;
}

// Legacy edge format (for old config uploader)
export interface SignalEdge {
  angle: number;
  level: number;
}

export interface SignalConfig {
  edges: SignalEdge[];
}

export interface FullConfig {
  rpm: number;
  cycle: number;
  signals: {
    ckp: SignalConfig;
    cmp1: SignalConfig;
    cmp2: SignalConfig;
  };
}

// New device config format (from Signal Generator)
export interface DeviceSignalConfig {
  name: string;
  CKP: string;         // "SIG1..." encoded blob
  CMP1: string | null;
  CMP2: string | null;
}

// Signal info for listing (without full blob data)
export interface SignalInfo {
  name: string;
  filename: string;
  has_ckp: boolean;
  has_cmp1: boolean;
  has_cmp2: boolean;
}

