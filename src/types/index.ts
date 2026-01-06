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
