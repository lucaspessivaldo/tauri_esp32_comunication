import { create } from 'zustand';
import type { GearWheelConfig, SignalPoint, ExportedConfig, CKPMode, WaveformDisplayType } from '../types';
import { generateTeeth, generateCMPTeeth, generateCKPSignal, generateCMPSignal } from '../utils/signalMath';
import { encodeConfig, decodeConfig, validateExportedConfig, generateFilename, exportForDevice } from '../utils/configCodec';
import type { DeviceConfig } from '../utils/configCodec';

interface SignalStore {
  // Wheel configurations
  ckpConfig: GearWheelConfig;
  cmp1Config: GearWheelConfig;
  cmp2Config: GearWheelConfig;

  // CKP editing mode
  ckpMode: CKPMode;

  // Generated signals
  ckpSignal: SignalPoint[];
  cmp1Signal: SignalPoint[];
  cmp2Signal: SignalPoint[];

  // Animation state
  isRunning: boolean;
  rotationAngle: number; // CKP rotation angle (CMP is half)

  // Channel visibility
  showCKP: boolean;
  showCMP1: boolean;
  showCMP2: boolean;

  // Oscilloscope waveform display type (visual only, hardware always receives square)
  ckpWaveformDisplay: WaveformDisplayType;

  // Actions
  setCKPPreset: (totalTeeth: number, missingTeeth: number[], name: string) => void;
  setCMP1Preset: (segments: number) => void;
  setCMP2Preset: (segments: number) => void;
  toggleCKPTooth: (toothId: number) => void;
  toggleCMP1Tooth: (toothId: number) => void;
  toggleCMP2Tooth: (toothId: number) => void;
  addCMP1Tooth: () => void;
  addCMP2Tooth: () => void;
  removeCMP1Tooth: () => void;
  removeCMP2Tooth: () => void;
  removeSpecificCMP1Tooth: (toothId: number) => void;
  removeSpecificCMP2Tooth: (toothId: number) => void;
  updateCMP1Tooth: (toothId: number, startAngle: number, endAngle: number) => void;
  updateCMP2Tooth: (toothId: number, startAngle: number, endAngle: number) => void;
  regenerateSignals: () => void;

  // CKP custom mode actions
  setCKPMode: (mode: CKPMode) => void;
  setCKPCustom: (totalTeeth: number, gapRatio: number) => void;
  updateCKPTooth: (toothId: number, startAngle: number, endAngle: number) => void;
  addCKPTooth: () => void;
  removeCKPTooth: (toothId: number) => void;

  // Animation actions
  toggleRunning: () => void;
  setRotationAngle: (angle: number) => void;
  stepRotation: (deltaAngle: number) => void;

  // Channel visibility actions
  toggleCKPVisibility: () => void;
  toggleCMP1Visibility: () => void;
  toggleCMP2Visibility: () => void;

  // Waveform display actions
  setCKPWaveformDisplay: (type: WaveformDisplayType) => void;

  // Export/Import actions
  exportConfig: () => ExportedConfig;
  importConfig: (config: ExportedConfig) => void;
  downloadConfig: () => void;
  loadConfigFromFile: (file: File) => Promise<void>;
  copyDeviceConfigToClipboard: () => Promise<void>;
  getDeviceConfig: () => DeviceConfig;

}

const CKP_TOOTH_GAP_RATIO = 0.5;

const createDefaultCKP = (): GearWheelConfig => {
  const totalTeeth = 60;
  const missingTeeth = [59, 60];
  return {
    id: 'ckp',
    name: '60-2',
    totalTeeth,
    missingTeeth,
    teeth: generateTeeth(totalTeeth, missingTeeth, CKP_TOOTH_GAP_RATIO),
    innerRadius: 60,
    outerRadius: 80,
  };
};

const createDefaultCMP = (id: string, segments: number = 4): GearWheelConfig => ({
  id,
  name: `${segments}`,
  totalTeeth: segments,
  missingTeeth: [],
  teeth: generateCMPTeeth(segments),
  innerRadius: 50,
  outerRadius: 80,
});

export const useSignalStore = create<SignalStore>((set, get) => ({
  ckpConfig: createDefaultCKP(),
  cmp1Config: createDefaultCMP('cmp1', 4),
  cmp2Config: createDefaultCMP('cmp2', 4),

  // CKP editing mode
  ckpMode: 'preset' as CKPMode,

  ckpSignal: [],
  cmp1Signal: [],
  cmp2Signal: [],

  // Animation state
  isRunning: false,
  rotationAngle: 0,

  // Channel visibility
  showCKP: true,
  showCMP1: true,
  showCMP2: true,

  // Oscilloscope waveform display type (visual only)
  ckpWaveformDisplay: 'square' as WaveformDisplayType,

  setCKPPreset: (totalTeeth, missingTeeth, name) => {
    const newConfig: GearWheelConfig = {
      id: 'ckp',
      name,
      totalTeeth,
      missingTeeth,
      teeth: generateTeeth(totalTeeth, missingTeeth, CKP_TOOTH_GAP_RATIO),
      innerRadius: 60,
      outerRadius: 80,
    };
    set({ ckpConfig: newConfig, ckpMode: 'preset' });
    get().regenerateSignals();
  },

  setCMP1Preset: (segments) => {
    const newConfig: GearWheelConfig = {
      id: 'cmp1',
      name: `${segments}`,
      totalTeeth: segments,
      missingTeeth: [],
      teeth: generateCMPTeeth(segments),
      innerRadius: 50,
      outerRadius: 80,
    };
    set({ cmp1Config: newConfig });
    get().regenerateSignals();
  },

  setCMP2Preset: (segments) => {
    const newConfig: GearWheelConfig = {
      id: 'cmp2',
      name: `${segments}`,
      totalTeeth: segments,
      missingTeeth: [],
      teeth: generateCMPTeeth(segments),
      innerRadius: 50,
      outerRadius: 80,
    };
    set({ cmp2Config: newConfig });
    get().regenerateSignals();
  },

  toggleCKPTooth: (toothId) => {
    const { ckpConfig } = get();
    const newTeeth = ckpConfig.teeth.map(tooth =>
      tooth.id === toothId ? { ...tooth, enabled: !tooth.enabled } : tooth
    );
    set({
      ckpConfig: { ...ckpConfig, teeth: newTeeth }
    });
    get().regenerateSignals();
  },

  toggleCMP1Tooth: (toothId) => {
    const { cmp1Config } = get();
    const newTeeth = cmp1Config.teeth.map(tooth =>
      tooth.id === toothId ? { ...tooth, enabled: !tooth.enabled } : tooth
    );
    set({
      cmp1Config: { ...cmp1Config, teeth: newTeeth }
    });
    get().regenerateSignals();
  },

  toggleCMP2Tooth: (toothId) => {
    const { cmp2Config } = get();
    const newTeeth = cmp2Config.teeth.map(tooth =>
      tooth.id === toothId ? { ...tooth, enabled: !tooth.enabled } : tooth
    );
    set({
      cmp2Config: { ...cmp2Config, teeth: newTeeth }
    });
    get().regenerateSignals();
  },

  addCMP1Tooth: () => {
    const { cmp1Config } = get();
    const newSegments = cmp1Config.totalTeeth + 1;
    get().setCMP1Preset(newSegments);
  },

  addCMP2Tooth: () => {
    const { cmp2Config } = get();
    const newSegments = cmp2Config.totalTeeth + 1;
    get().setCMP2Preset(newSegments);
  },

  removeCMP1Tooth: () => {
    const { cmp1Config } = get();
    if (cmp1Config.totalTeeth > 1) {
      get().setCMP1Preset(cmp1Config.totalTeeth - 1);
    }
  },

  removeCMP2Tooth: () => {
    const { cmp2Config } = get();
    if (cmp2Config.totalTeeth > 1) {
      get().setCMP2Preset(cmp2Config.totalTeeth - 1);
    }
  },

  removeSpecificCMP1Tooth: (toothId) => {
    const { cmp1Config } = get();
    if (cmp1Config.teeth.length > 1) {
      const newTeeth = cmp1Config.teeth.filter(t => t.id !== toothId);
      set({
        cmp1Config: {
          ...cmp1Config,
          teeth: newTeeth,
          totalTeeth: newTeeth.length,
        }
      });
      get().regenerateSignals();
    }
  },

  removeSpecificCMP2Tooth: (toothId) => {
    const { cmp2Config } = get();
    if (cmp2Config.teeth.length > 1) {
      const newTeeth = cmp2Config.teeth.filter(t => t.id !== toothId);
      set({
        cmp2Config: {
          ...cmp2Config,
          teeth: newTeeth,
          totalTeeth: newTeeth.length,
        }
      });
      get().regenerateSignals();
    }
  },

  updateCMP1Tooth: (toothId, startAngle, endAngle) => {
    const { cmp1Config } = get();
    const newTeeth = cmp1Config.teeth.map(tooth =>
      tooth.id === toothId ? { ...tooth, startAngle, endAngle } : tooth
    );
    set({
      cmp1Config: { ...cmp1Config, teeth: newTeeth }
    });
    get().regenerateSignals();
  },

  updateCMP2Tooth: (toothId, startAngle, endAngle) => {
    const { cmp2Config } = get();
    const newTeeth = cmp2Config.teeth.map(tooth =>
      tooth.id === toothId ? { ...tooth, startAngle, endAngle } : tooth
    );
    set({
      cmp2Config: { ...cmp2Config, teeth: newTeeth }
    });
    get().regenerateSignals();
  },

  regenerateSignals: () => {
    const { ckpConfig, cmp1Config, cmp2Config } = get();

    const ckpSignal = generateCKPSignal(ckpConfig);
    const cmp1Signal = generateCMPSignal(cmp1Config, 1440, 0);
    const cmp2Signal = generateCMPSignal(cmp2Config, 1440, 0);

    set({
      ckpSignal,
      cmp1Signal,
      cmp2Signal,
    });
  },

  // Animation actions
  toggleRunning: () => {
    set((state) => ({ isRunning: !state.isRunning }));
  },

  setRotationAngle: (angle) => {
    set({ rotationAngle: ((angle % 720) + 720) % 720 });
  },

  stepRotation: (deltaAngle) => {
    set((state) => ({
      rotationAngle: ((state.rotationAngle + deltaAngle) % 720 + 720) % 720,
    }));
  },

  // Channel visibility actions
  toggleCKPVisibility: () => {
    set((state) => ({ showCKP: !state.showCKP }));
  },

  toggleCMP1Visibility: () => {
    set((state) => ({ showCMP1: !state.showCMP1 }));
  },

  toggleCMP2Visibility: () => {
    set((state) => ({ showCMP2: !state.showCMP2 }));
  },

  // Waveform display actions
  setCKPWaveformDisplay: (type) => {
    set({ ckpWaveformDisplay: type });
  },

  // CKP custom mode actions
  setCKPMode: (mode) => {
    set({ ckpMode: mode });
  },

  setCKPCustom: (totalTeeth, gapRatio) => {
    const teeth = generateTeeth(totalTeeth, [], gapRatio);
    const newConfig: GearWheelConfig = {
      id: 'ckp',
      name: 'Custom',
      totalTeeth,
      missingTeeth: [],
      teeth,
      innerRadius: 60,
      outerRadius: 80,
    };
    set({ ckpConfig: newConfig, ckpMode: 'custom' });
    get().regenerateSignals();
  },

  updateCKPTooth: (toothId, startAngle, endAngle) => {
    const { ckpConfig } = get();
    const newTeeth = ckpConfig.teeth.map(tooth =>
      tooth.id === toothId ? { ...tooth, startAngle, endAngle } : tooth
    );
    set({
      ckpConfig: { ...ckpConfig, teeth: newTeeth, name: 'Custom' },
      ckpMode: 'custom'
    });
    get().regenerateSignals();
  },

  addCKPTooth: () => {
    const { ckpConfig } = get();
    const teeth = ckpConfig.teeth;

    // Find the largest gap between teeth to add a new tooth
    let bestGapStart = 0;
    let bestGapSize = 0;

    if (teeth.length === 0) {
      bestGapStart = 0;
      bestGapSize = 360;
    } else {
      const sortedTeeth = [...teeth].sort((a, b) => a.startAngle - b.startAngle);

      for (let i = 0; i < sortedTeeth.length; i++) {
        const current = sortedTeeth[i];
        const next = sortedTeeth[(i + 1) % sortedTeeth.length];

        let gapStart = current.endAngle;
        let gapEnd = next.startAngle;
        if (gapEnd <= gapStart) gapEnd += 360;

        const gapSize = gapEnd - gapStart;
        if (gapSize > bestGapSize) {
          bestGapSize = gapSize;
          bestGapStart = gapStart % 360;
        }
      }
    }

    // Create new tooth in the middle of the largest gap
    const toothWidth = Math.min(bestGapSize * 0.5, 30);
    const newStartAngle = (bestGapStart + (bestGapSize - toothWidth) / 2) % 360;
    const newEndAngle = (newStartAngle + toothWidth) % 360;

    const maxId = teeth.reduce((max, t) => Math.max(max, t.id), 0);
    const newTooth = {
      id: maxId + 1,
      startAngle: newStartAngle,
      endAngle: newEndAngle,
      enabled: true,
    };

    set({
      ckpConfig: {
        ...ckpConfig,
        teeth: [...teeth, newTooth],
        totalTeeth: teeth.length + 1,
        name: 'Custom',
      },
      ckpMode: 'custom'
    });
    get().regenerateSignals();
  },

  removeCKPTooth: (toothId) => {
    const { ckpConfig } = get();
    if (ckpConfig.teeth.length > 1) {
      const newTeeth = ckpConfig.teeth.filter(t => t.id !== toothId);
      set({
        ckpConfig: {
          ...ckpConfig,
          teeth: newTeeth,
          totalTeeth: newTeeth.length,
          name: 'Custom',
        },
        ckpMode: 'custom'
      });
      get().regenerateSignals();
    }
  },

  // Export/Import actions
  exportConfig: () => {
    const { ckpConfig, cmp1Config, cmp2Config } = get();
    return encodeConfig(ckpConfig, cmp1Config, cmp2Config);
  },

  importConfig: (config) => {
    if (!validateExportedConfig(config)) {
      throw new Error('Invalid configuration format');
    }

    const { ckp, cmp1, cmp2 } = decodeConfig(config);
    set({
      ckpConfig: ckp,
      cmp1Config: cmp1,
      cmp2Config: cmp2,
      ckpMode: 'custom', // Imported configs are considered custom
    });
    get().regenerateSignals();
  },

  downloadConfig: () => {
    const { ckpConfig } = get();
    const config = get().exportConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = generateFilename(ckpConfig);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  loadConfigFromFile: async (file) => {
    const text = await file.text();
    const config = JSON.parse(text);
    get().importConfig(config);
  },

  getDeviceConfig: () => {
    const { ckpConfig, cmp1Config, cmp2Config } = get();
    return exportForDevice(ckpConfig.name, ckpConfig, cmp1Config, cmp2Config);
  },

  copyDeviceConfigToClipboard: async () => {
    const config = get().getDeviceConfig();
    const json = JSON.stringify(config, null, 2);
    await navigator.clipboard.writeText(json);
  },
}));

// Initialize signals
useSignalStore.getState().regenerateSignals();
