import type { DecodedBlobInfo, DeviceSignalConfig, FullConfig, SignalEdge } from "../types";

// Matches signal_generator/src/utils/configCodec.ts (device export section)

type Edge = {
  angleTenths: number;
  level: 0 | 1;
};

// Must match ESP32 firmware limits
const MAX_CKP_EDGES = 700;
const MAX_CMP_EDGES = 50;

function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xa001;
      else crc >>= 1;
    }
  }
  return crc;
}

function deriveKey(seed: number): Uint8Array {
  const key = new Uint8Array(16);
  let state = (seed ^ 0xdeadbeef) >>> 0;
  for (let i = 0; i < 16; i++) {
    // Use Math.imul for proper 32-bit multiplication (avoids JS float precision loss)
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    key[i] = (state >> 16) & 0xff;
  }
  return key;
}

export function encodeSignalBlob(edges: Edge[]): string {
  if (edges.length === 0) return "";

  const seed = Math.floor(Math.random() * 0xffffffff);

  const bufferSize = 4 + 2 + edges.length * 4 + 2;
  const buffer = new Uint8Array(bufferSize);

  // seed (LE)
  buffer[0] = seed & 0xff;
  buffer[1] = (seed >> 8) & 0xff;
  buffer[2] = (seed >> 16) & 0xff;
  buffer[3] = (seed >> 24) & 0xff;

  // count (LE)
  buffer[4] = edges.length & 0xff;
  buffer[5] = (edges.length >> 8) & 0xff;

  let offset = 6;
  for (const edge of edges) {
    buffer[offset] = edge.angleTenths & 0xff;
    buffer[offset + 1] = (edge.angleTenths >> 8) & 0xff;
    buffer[offset + 2] = edge.level & 0xff;
    buffer[offset + 3] = (edge.level >> 8) & 0xff;
    offset += 4;
  }

  const crcData = buffer.slice(4, offset);
  const crc = crc16(crcData);
  buffer[offset] = crc & 0xff;
  buffer[offset + 1] = (crc >> 8) & 0xff;

  const key = deriveKey(seed);
  for (let i = 4; i < bufferSize; i++) {
    const keyIdx = (i - 4) % 16;
    const rotation = (i - 4) & 0x0f;
    buffer[i] = ((buffer[i] + rotation) & 0xff) ^ key[keyIdx];
  }

  let binary = "";
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);

  return "SIG1" + btoa(binary);
}

function decodeSig1EdgeCount(blob: string): number {
  if (!blob.startsWith("SIG1")) throw new Error("Blob must start with SIG1");
  const b64 = blob.slice(4);

  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new Error("Invalid Base64 in SIG1 blob");
  }

  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i) & 0xff;

  if (buf.length < 8) throw new Error("SIG1 payload too short");

  const seed = (buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24)) >>> 0;
  const key = deriveKey(seed);

  // De-obfuscate entire payload (needed to validate CRC)
  for (let i = 4; i < buf.length; i++) {
    const keyIdx = (i - 4) % 16;
    const rotation = (i - 4) & 0x0f;
    buf[i] = (buf[i] ^ key[keyIdx]) & 0xff;
    buf[i] = (buf[i] - rotation) & 0xff;
  }

  const count = buf[4] | (buf[5] << 8);

  // CRC check (same as ESP32: CRC over count+edges, excluding seed and excluding CRC)
  const storedCrc = (buf[buf.length - 2] | (buf[buf.length - 1] << 8)) & 0xffff;
  const calcCrc = crc16(buf.slice(4, buf.length - 2));
  if (storedCrc !== calcCrc) {
    throw new Error("SIG1 CRC mismatch (corrupted blob)");
  }

  return count;
}

/**
 * Debug decode a SIG1 blob to show internal values
 * Used to diagnose CRC mismatch issues between Tauri app and ESP32
 */
export function debugDecodeSig1Blob(blob: string): DecodedBlobInfo | null {
  try {
    if (!blob || !blob.startsWith("SIG1")) return null;
    const b64 = blob.slice(4);

    let binary: string;
    try {
      binary = atob(b64);
    } catch {
      return null;
    }

    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i) & 0xff;

    if (buf.length < 8) return null;

    // Get raw bytes before de-obfuscation for debugging
    const rawBytesHex: string[] = [];
    for (let i = 0; i < Math.min(buf.length, 50); i++) {
      rawBytesHex.push(buf[i].toString(16).toUpperCase().padStart(2, "0"));
    }

    const seed = (buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24)) >>> 0;
    const key = deriveKey(seed);

    // Debug: log the derived key
    const keyHex = Array.from(key).map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
    console.log(`[debugDecodeSig1Blob] Seed: 0x${seed.toString(16).toUpperCase()}, Key: ${keyHex}`);

    // De-obfuscate entire payload
    for (let i = 4; i < buf.length; i++) {
      const keyIdx = (i - 4) % 16;
      const rotation = (i - 4) & 0x0f;
      buf[i] = (buf[i] ^ key[keyIdx]) & 0xff;
      buf[i] = (buf[i] - rotation) & 0xff;
    }

    const edgeCount = buf[4] | (buf[5] << 8);
    const storedCrc = (buf[buf.length - 2] | (buf[buf.length - 1] << 8)) & 0xffff;
    const calculatedCrc = crc16(buf.slice(4, buf.length - 2));

    // Extract ALL edges for full debugging
    const allEdges: Array<{ angle: number; level: number }> = [];
    const firstEdgesStr: string[] = [];
    let offset = 6;
    for (let i = 0; i < edgeCount; i++) {
      if (offset + 4 > buf.length - 2) break;
      const angleTenths = buf[offset] | (buf[offset + 1] << 8);
      const level = buf[offset + 2] | (buf[offset + 3] << 8);
      allEdges.push({ angle: angleTenths / 10, level });
      if (i < 5) {
        firstEdgesStr.push(`${angleTenths / 10}°:${level}`);
      }
      offset += 4;
    }

    return {
      seed: "0x" + seed.toString(16).toUpperCase().padStart(8, "0"),
      edgeCount,
      storedCrc: "0x" + storedCrc.toString(16).toUpperCase().padStart(4, "0"),
      calculatedCrc: "0x" + calculatedCrc.toString(16).toUpperCase().padStart(4, "0"),
      crcMatch: storedCrc === calculatedCrc,
      firstEdges: firstEdgesStr.join(", ") + (edgeCount > 5 ? "..." : ""),
      allEdges,
      rawBytes: rawBytesHex.join(" "),
    };
  } catch (e) {
    return null;
  }
}

export function isDeviceSignalConfig(obj: unknown): obj is DeviceSignalConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const c = obj as Record<string, unknown>;

  const ckp = c.CKP;
  const cmp1 = c.CMP1;
  const cmp2 = c.CMP2;

  return (
    typeof c.name === "string" &&
    typeof ckp === "string" &&
    ckp.startsWith("SIG1") &&
    (cmp1 === null || (typeof cmp1 === "string" && cmp1.startsWith("SIG1"))) &&
    (cmp2 === null || (typeof cmp2 === "string" && cmp2.startsWith("SIG1")))
  );
}

export function isLegacyFullConfig(obj: unknown): obj is FullConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const c = obj as Record<string, unknown>;
  if (typeof c.rpm !== "number" || typeof c.cycle !== "number") return false;
  if (typeof c.signals !== "object" || c.signals === null) return false;

  const signals = c.signals as Record<string, unknown>;
  const hasEdgesArray = (v: unknown): boolean => {
    if (typeof v !== "object" || v === null) return false;
    const vv = v as Record<string, unknown>;
    return Array.isArray(vv.edges);
  };

  return hasEdgesArray(signals.ckp) && hasEdgesArray(signals.cmp1) && hasEdgesArray(signals.cmp2);
}

function isProtectedWheelExport(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.version === "number" &&
    typeof c.checksum === "string" &&
    typeof c.CKP === "string" &&
    typeof c.CMP1 === "string" &&
    typeof c.CMP2 === "string" &&
    !String(c.CKP).startsWith("SIG1")
  );
}

function angleToTenths(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  // Heuristic:
  // - if angle is in degrees (0..720), multiply by 10
  // - if angle already looks like tenths (0..7200), keep
  // - otherwise clamp into range
  if (Math.abs(angle) <= 720) return Math.round(angle * 10);
  if (Math.abs(angle) <= 7200) return Math.round(angle);
  return Math.round(Math.max(0, Math.min(angle, 7200)));
}

function edgesFromLegacyEdges(edges: SignalEdge[]): Edge[] {
  const mapped: Edge[] = edges
    .filter((e) => typeof e.angle === "number" && typeof e.level === "number")
    .map((e) => ({
      angleTenths: angleToTenths(e.angle),
      level: (e.level ? 1 : 0) as 0 | 1,
    }));

  mapped.sort((a, b) => a.angleTenths - b.angleTenths);
  return mapped;
}

export function legacyToDeviceSignalConfig(full: FullConfig): DeviceSignalConfig {
  const ckpEdges = edgesFromLegacyEdges(full.signals.ckp.edges);
  const cmp1Edges = edgesFromLegacyEdges(full.signals.cmp1.edges);
  const cmp2Edges = edgesFromLegacyEdges(full.signals.cmp2.edges);

  return {
    name: `Imported ${Math.round(full.rpm)}RPM`,
    CKP: encodeSignalBlob(ckpEdges),
    CMP1: cmp1Edges.length > 0 ? encodeSignalBlob(cmp1Edges) : null,
    CMP2: cmp2Edges.length > 0 ? encodeSignalBlob(cmp2Edges) : null,
  };
}

export function prepareConfigForUpload(rawJson: string): {
  kind: "device" | "legacy";
  device: DeviceSignalConfig;
  jsonToSend: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e}`);
  }

  if (isProtectedWheelExport(parsed)) {
    throw new Error(
      "This looks like the protected wheel export (version/checksum). In Signal Generator, use the 'Copy Device Config' / 'Device export' JSON (it must contain SIG1 blobs)."
    );
  }

  let device: DeviceSignalConfig;
  let kind: "device" | "legacy";

  if (isDeviceSignalConfig(parsed)) {
    device = parsed;
    kind = "device";
  } else if (isLegacyFullConfig(parsed)) {
    device = legacyToDeviceSignalConfig(parsed);
    kind = "legacy";
  } else {
    throw new Error(
      "Unsupported config format. Paste the device JSON with fields {name, CKP, CMP1, CMP2} (SIG1...), or the legacy edge JSON {rpm, cycle, signals:{...edges}}."
    );
  }

  if (!device.CKP || !device.CKP.startsWith("SIG1")) {
    throw new Error("Invalid CKP: must be a SIG1 blob and not empty");
  }

  // Preflight edge-count vs firmware limits
  const ckpCount = decodeSig1EdgeCount(device.CKP);
  if (ckpCount > MAX_CKP_EDGES) {
    throw new Error(`CKP has ${ckpCount} edges, but ESP32 firmware limit is ${MAX_CKP_EDGES}. Reduce tooth count/edges or increase MAX_CKP_EDGES in firmware.`);
  }
  if (device.CMP1) {
    const cmp1Count = decodeSig1EdgeCount(device.CMP1);
    if (cmp1Count > MAX_CMP_EDGES) {
      throw new Error(`CMP1 has ${cmp1Count} edges, but ESP32 firmware limit is ${MAX_CMP_EDGES}.`);
    }
  }
  if (device.CMP2) {
    const cmp2Count = decodeSig1EdgeCount(device.CMP2);
    if (cmp2Count > MAX_CMP_EDGES) {
      throw new Error(`CMP2 has ${cmp2Count} edges, but ESP32 firmware limit is ${MAX_CMP_EDGES}.`);
    }
  }

  const jsonToSend = JSON.stringify(device);

  // ESP32 buffer is 4096; allow some headroom for newline and safety
  if (jsonToSend.length > 3900) {
    throw new Error(
      `Config too large for ESP32 buffer (${jsonToSend.length} bytes). Try reducing edges/teeth or use a smaller config.`
    );
  }

  return { kind, device, jsonToSend };
}
