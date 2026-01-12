/**
 * Configuration Codec
 * Encodes/decodes wheel configurations to protected JSON format
 * Values are binary-encoded and Base64 wrapped to prevent easy manual editing
 */

import type { GearWheelConfig, Tooth, ExportedConfig } from '../types';

// CRC32 lookup table
const CRC32_TABLE: number[] = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

/**
 * Calculate CRC32 checksum of a string
 */
function crc32(str: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = CRC32_TABLE[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

/**
 * Encode a single tooth to binary (5 bytes)
 * - startAngle: 2 bytes (angle × 10, supports 0.1° precision)
 * - endAngle: 2 bytes (angle × 10)
 * - flags: 1 byte (bit 0 = enabled)
 */
function encodeTooth(tooth: Tooth): Uint8Array {
  const buffer = new Uint8Array(5);
  const startAngle = Math.round(tooth.startAngle * 10);
  const endAngle = Math.round(tooth.endAngle * 10);

  // Little-endian 16-bit values
  buffer[0] = startAngle & 0xff;
  buffer[1] = (startAngle >> 8) & 0xff;
  buffer[2] = endAngle & 0xff;
  buffer[3] = (endAngle >> 8) & 0xff;
  buffer[4] = tooth.enabled ? 1 : 0;

  return buffer;
}

/**
 * Decode a tooth from binary data
 */
function decodeTooth(buffer: Uint8Array, offset: number, id: number): Tooth {
  const startAngle = (buffer[offset] | (buffer[offset + 1] << 8)) / 10;
  const endAngle = (buffer[offset + 2] | (buffer[offset + 3] << 8)) / 10;
  const enabled = buffer[offset + 4] === 1;

  return { id, startAngle, endAngle, enabled };
}

/**
 * Encode a wheel configuration to Base64 string
 * Format:
 * - Header: 4 bytes (version, totalTeeth, missingCount, reserved)
 * - Missing teeth: N × 1 byte each
 * - Teeth data: M × 5 bytes each
 */
export function encodeWheel(config: GearWheelConfig): string {
  const missingCount = config.missingTeeth.length;
  const teethCount = config.teeth.length;
  const totalSize = 4 + missingCount + (teethCount * 5);

  const buffer = new Uint8Array(totalSize);
  let offset = 0;

  // Header
  buffer[offset++] = 1; // version
  buffer[offset++] = config.totalTeeth & 0xff;
  buffer[offset++] = missingCount;
  buffer[offset++] = 0; // reserved

  // Missing teeth indices
  for (const missing of config.missingTeeth) {
    buffer[offset++] = missing & 0xff;
  }

  // Teeth data
  for (const tooth of config.teeth) {
    const encoded = encodeTooth(tooth);
    buffer.set(encoded, offset);
    offset += 5;
  }

  // XOR obfuscation with key pattern
  const key = [0x5a, 0xa5, 0x3c, 0xc3];
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= key[i % key.length];
  }

  // Convert to Base64
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Decode a wheel configuration from Base64 string
 */
export function decodeWheel(encoded: string, id: string): GearWheelConfig {
  // Decode Base64
  const binary = atob(encoded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }

  // XOR de-obfuscation
  const key = [0x5a, 0xa5, 0x3c, 0xc3];
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= key[i % key.length];
  }

  let offset = 0;

  // Read header
  const version = buffer[offset++];
  if (version !== 1) {
    throw new Error(`Unsupported config version: ${version}`);
  }

  const totalTeeth = buffer[offset++];
  const missingCount = buffer[offset++];
  offset++; // skip reserved

  // Read missing teeth
  const missingTeeth: number[] = [];
  for (let i = 0; i < missingCount; i++) {
    missingTeeth.push(buffer[offset++]);
  }

  // Read teeth
  const teeth: Tooth[] = [];
  let toothId = 1;
  while (offset + 5 <= buffer.length) {
    teeth.push(decodeTooth(buffer, offset, toothId++));
    offset += 5;
  }

  return {
    id,
    name: missingTeeth.length > 0 ? `${totalTeeth}-${missingTeeth.length}` : `${teeth.length}`,
    totalTeeth,
    missingTeeth,
    teeth,
    innerRadius: id === 'ckp' ? 60 : 50,
    outerRadius: 80,
  };
}

/**
 * Export full configuration to protected JSON format
 */
export function encodeConfig(
  ckp: GearWheelConfig,
  cmp1: GearWheelConfig,
  cmp2: GearWheelConfig
): ExportedConfig {
  const encodedCKP = encodeWheel(ckp);
  const encodedCMP1 = encodeWheel(cmp1);
  const encodedCMP2 = encodeWheel(cmp2);

  // Calculate checksum over all encoded data
  const payload = `${encodedCKP}|${encodedCMP1}|${encodedCMP2}`;
  const checksum = crc32(payload);

  return {
    version: 1,
    CKP: encodedCKP,
    CMP1: encodedCMP1,
    CMP2: encodedCMP2,
    checksum,
  };
}

/**
 * Import configuration from protected JSON format
 */
export function decodeConfig(config: ExportedConfig): {
  ckp: GearWheelConfig;
  cmp1: GearWheelConfig;
  cmp2: GearWheelConfig;
} {
  // Validate version
  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}`);
  }

  // Validate checksum
  const payload = `${config.CKP}|${config.CMP1}|${config.CMP2}`;
  const expectedChecksum = crc32(payload);
  if (config.checksum !== expectedChecksum) {
    throw new Error('Invalid configuration: checksum mismatch');
  }

  // Decode each wheel
  const ckp = decodeWheel(config.CKP, 'ckp');
  const cmp1 = decodeWheel(config.CMP1, 'cmp1');
  const cmp2 = decodeWheel(config.CMP2, 'cmp2');

  return { ckp, cmp1, cmp2 };
}

/**
 * Validate an exported config object structure
 */
export function validateExportedConfig(obj: unknown): obj is ExportedConfig {
  if (typeof obj !== 'object' || obj === null) return false;

  const config = obj as Record<string, unknown>;

  return (
    typeof config.version === 'number' &&
    typeof config.CKP === 'string' &&
    typeof config.CMP1 === 'string' &&
    typeof config.CMP2 === 'string' &&
    typeof config.checksum === 'string'
  );
}

/**
 * Generate filename for export based on configuration
 */
export function generateFilename(ckp: GearWheelConfig): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const pattern = ckp.name.replace(/[^a-zA-Z0-9-]/g, '_');
  return `signal_config_${pattern}_${timestamp}.json`;
}

// ============================================================
// Tauri/ESP32 Device Export (Obfuscated Signal Format)
// ============================================================

interface Edge {
  angleTenths: number; // Angle × 10 for 0.1° precision (0-3600)
  level: 0 | 1;
}

/**
 * Convert teeth array to edge array (rising/falling transitions)
 * Each enabled tooth creates: rising edge at startAngle, falling edge at endAngle
 */
function teethToEdges(teeth: Tooth[]): Edge[] {
  const edges: Edge[] = [];

  for (const tooth of teeth) {
    if (!tooth.enabled) continue;

    // Rising edge at start of tooth
    edges.push({
      angleTenths: Math.round(tooth.startAngle * 10),
      level: 1,
    });

    // Falling edge at end of tooth
    edges.push({
      angleTenths: Math.round(tooth.endAngle * 10),
      level: 0,
    });
  }

  // Sort by angle
  edges.sort((a, b) => a.angleTenths - b.angleTenths);

  return edges;
}

/**
 * Configuration for device export (Tauri app)
 */
export interface DeviceConfig {
  name: string;
  CKP: string;       // "SIG1..." encoded blob
  CMP1: string | null;
  CMP2: string | null;
}

/**
 * CRC16 calculation (same algorithm as ESP32)
 */
function crc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

/**
 * Derive XOR key from seed (LCG algorithm matching ESP32)
 */
function deriveKey(seed: number): Uint8Array {
  const key = new Uint8Array(16);
  let state = (seed ^ 0xDEADBEEF) >>> 0;
  for (let i = 0; i < 16; i++) {
    // Use Math.imul for proper 32-bit multiplication (avoids JS float precision loss)
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    key[i] = (state >> 16) & 0xFF;
  }
  return key;
}

/**
 * Encode signal edges to obfuscated blob
 * Format: "SIG1" + Base64([SEED:4][EDGE_COUNT:2][EDGES:N*4][CRC16:2])
 * Each edge: [angle_tenths:2][level:2]
 */
export function encodeSignalBlob(edges: Edge[]): string {
  if (edges.length === 0) {
    return ''; // Return empty for no signal
  }

  // Generate random seed
  const seed = Math.floor(Math.random() * 0xFFFFFFFF);

  // Calculate buffer size: seed(4) + count(2) + edges(N*4) + crc(2)
  const bufferSize = 4 + 2 + (edges.length * 4) + 2;
  const buffer = new Uint8Array(bufferSize);

  // Write seed (little-endian, not obfuscated)
  buffer[0] = seed & 0xFF;
  buffer[1] = (seed >> 8) & 0xFF;
  buffer[2] = (seed >> 16) & 0xFF;
  buffer[3] = (seed >> 24) & 0xFF;

  // Write edge count (will be obfuscated)
  buffer[4] = edges.length & 0xFF;
  buffer[5] = (edges.length >> 8) & 0xFF;

  // Write edges (will be obfuscated)
  let offset = 6;
  for (const edge of edges) {
    buffer[offset] = edge.angleTenths & 0xFF;
    buffer[offset + 1] = (edge.angleTenths >> 8) & 0xFF;
    buffer[offset + 2] = edge.level & 0xFF;
    buffer[offset + 3] = (edge.level >> 8) & 0xFF;
    offset += 4;
  }

  // Calculate CRC16 over count + edges (before obfuscation)
  const crcData = buffer.slice(4, offset);
  const crc = crc16(crcData);
  buffer[offset] = crc & 0xFF;
  buffer[offset + 1] = (crc >> 8) & 0xFF;

  // Derive XOR key from seed
  const key = deriveKey(seed);

  // Obfuscate payload (skip seed bytes)
  for (let i = 4; i < bufferSize; i++) {
    const keyIdx = (i - 4) % 16;
    const rotation = (i - 4) & 0x0F;
    buffer[i] = ((buffer[i] + rotation) & 0xFF) ^ key[keyIdx];
  }

  // Convert to Base64
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  return 'SIG1' + btoa(binary);
}

/**
 * Export configuration for device (Tauri app compatible)
 * Returns JSON format ready for ESP32 consumption
 * 
 * IMPORTANT: Uses 720° engine cycle (4-stroke):
 * - CKP: Rotates twice per cycle (edges at 0-360° duplicated to 360-720°)
 * - CMP1/CMP2: Rotate once per cycle (0-360° mapped to 0-720°)
 */
export function exportForDevice(
  name: string,
  ckp: GearWheelConfig,
  cmp1: GearWheelConfig,
  cmp2: GearWheelConfig
): DeviceConfig {
  // CKP: Generate edges for 360°, then duplicate for second rotation (360-720°)
  const ckpEdges360 = teethToEdges(ckp.teeth);
  const ckpEdges: Edge[] = [
    ...ckpEdges360,
    ...ckpEdges360.map((e) => ({ angleTenths: e.angleTenths + 3600, level: e.level })),
  ];

  // CMP1/CMP2: Map their 360° definition to 720° (they rotate at half CKP speed)
  const cmp1Edges360 = teethToEdges(cmp1.teeth);
  const cmp1Edges = cmp1Edges360.map((e) => ({
    angleTenths: e.angleTenths * 2,
    level: e.level,
  }));

  const cmp2Edges360 = teethToEdges(cmp2.teeth);
  const cmp2Edges = cmp2Edges360.map((e) => ({
    angleTenths: e.angleTenths * 2,
    level: e.level,
  }));

  return {
    name: name || `${ckp.name} Signal`,
    CKP: encodeSignalBlob(ckpEdges),
    CMP1: cmp1Edges.length > 0 ? encodeSignalBlob(cmp1Edges) : null,
    CMP2: cmp2Edges.length > 0 ? encodeSignalBlob(cmp2Edges) : null,
  };
}

/**
 * Validate a device config object structure
 */
export function validateDeviceConfig(obj: unknown): obj is DeviceConfig {
  if (typeof obj !== 'object' || obj === null) return false;

  const config = obj as Record<string, unknown>;

  return (
    typeof config.name === 'string' &&
    typeof config.CKP === 'string' &&
    config.CKP.startsWith('SIG1') &&
    (config.CMP1 === null || (typeof config.CMP1 === 'string' && config.CMP1.startsWith('SIG1'))) &&
    (config.CMP2 === null || (typeof config.CMP2 === 'string' && config.CMP2.startsWith('SIG1')))
  );
}
