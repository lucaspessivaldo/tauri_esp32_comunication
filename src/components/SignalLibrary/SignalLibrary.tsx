import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SignalInfo, DeviceSignalConfig, UploadResult, UploadDebugInfo } from '../../types';
import { useConnectionStore } from '../../store/connectionStore';
import { debugDecodeSig1Blob } from '../../utils/deviceCodec';

interface SignalLibraryProps {
  isConnected: boolean;
  onStatusChange?: () => void;
}

export function SignalLibrary({ isConnected, onStatusChange }: SignalLibraryProps) {
  const [signals, setSignals] = useState<SignalInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [uploadingSignal, setUploadingSignal] = useState<string | null>(null);

  // Load signals on mount
  useEffect(() => {
    loadSignals();
  }, []);

  const loadSignals = async () => {
    try {
      setLoading(true);
      const result = await invoke<SignalInfo[]>('list_saved_signals');
      setSignals(result);
      setError(null);
    } catch (e) {
      setError(`Failed to load signals: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;

    try {
      setLoading(true);

      // Validate JSON
      const config = JSON.parse(importText) as DeviceSignalConfig;
      if (!config.name || !config.CKP) {
        throw new Error('Invalid config: missing name or CKP');
      }
      if (!config.CKP.startsWith('SIG1')) {
        throw new Error('Invalid CKP: must start with SIG1');
      }

      await invoke('import_signal', { json: importText });
      setImportText('');
      setShowImport(false);
      await loadSignals();
      setError(null);
    } catch (e) {
      setError(`Import failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('Delete this signal?')) return;

    try {
      await invoke('delete_saved_signal', { filename });
      await loadSignals();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  };

  const handleUpload = async (filename: string) => {
    if (!isConnected) {
      setError('Not connected to device');
      return;
    }

    // Find the signal info to get the name
    const signalInfo = signals.find(s => s.filename === filename);

    try {
      setUploadingSignal(filename);
      setError(null);

      // First load the signal to get debug info
      const config = await invoke<DeviceSignalConfig>('load_saved_signal', { filename });

      // Prepare debug info
      const debugInfo: UploadDebugInfo = {
        timestamp: new Date(),
        configJson: JSON.stringify(config).substring(0, 2000),
        signalName: config.name || signalInfo?.name || filename,
        ckpBlob: config.CKP?.substring(0, 100) || '',
        cmp1Blob: config.CMP1?.substring(0, 100) || null,
        cmp2Blob: config.CMP2?.substring(0, 100) || null,
        ckpLength: config.CKP?.length || 0,
        cmp1Length: config.CMP1?.length || null,
        cmp2Length: config.CMP2?.length || null,
        totalBytes: JSON.stringify(config).length,
        result: null,
        preparationError: null,
        ckpDecoded: debugDecodeSig1Blob(config.CKP),
        cmp1Decoded: config.CMP1 ? debugDecodeSig1Blob(config.CMP1) : null,
        cmp2Decoded: config.CMP2 ? debugDecodeSig1Blob(config.CMP2) : null,
      };

      // Now upload
      const result = await invoke<UploadResult>('upload_saved_signal', { filename });
      debugInfo.result = result;

      // Update the connection store with debug info
      useConnectionStore.setState({ lastUploadDebug: debugInfo });

      if (result.success) {
        setError(null);
        onStatusChange?.();
      } else {
        const errorMsg = result.error_message || 'Unknown error';
        setError(`Upload failed: ${errorMsg}`);
        useConnectionStore.setState({ error: `Upload failed: ${errorMsg}` });
      }
    } catch (e) {
      setError(`Upload failed: ${e}`);
      useConnectionStore.setState({ error: `Upload failed: ${e}` });
    } finally {
      setUploadingSignal(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Signal Library</h2>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
        >
          {showImport ? 'Cancel' : '+ Import'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {showImport && (
        <div className="mb-4 p-3 bg-gray-700 rounded">
          <p className="text-sm text-gray-300 mb-2">
            Paste JSON from Signal Generator:
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"name": "...", "CKP": "SIG1...", ...}'
            className="w-full h-24 p-2 bg-gray-900 text-white rounded font-mono text-xs resize-none"
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim() || loading}
            className="mt-2 px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm"
          >
            {loading ? 'Importing...' : 'Import Signal'}
          </button>
        </div>
      )}

      {loading && signals.length === 0 ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : signals.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No signals saved. Import one from Signal Generator.
        </p>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => (
            <div
              key={signal.filename}
              className="flex items-center justify-between p-3 bg-gray-700 rounded"
            >
              <div>
                <p className="text-white font-medium">{signal.name}</p>
                <p className="text-xs text-gray-400">
                  {signal.has_ckp && <span className="text-green-400">CKP </span>}
                  {signal.has_cmp1 && <span className="text-blue-400">CMP1 </span>}
                  {signal.has_cmp2 && <span className="text-purple-400">CMP2</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpload(signal.filename)}
                  disabled={!isConnected || uploadingSignal !== null}
                  className={`px-3 py-1 rounded text-sm ${isConnected
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {uploadingSignal === signal.filename ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  onClick={() => handleDelete(signal.filename)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={loadSignals}
        className="mt-4 text-sm text-gray-400 hover:text-white"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
