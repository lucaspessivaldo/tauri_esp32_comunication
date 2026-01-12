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
    <div className="bg-card border border-border rounded-lg p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">Signal Library</h2>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs"
        >
          {showImport ? 'Cancel' : '+ Import'}
        </button>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-destructive/20 border border-destructive rounded text-destructive text-xs">
          {error}
        </div>
      )}

      {showImport && (
        <div className="mb-2 p-2 bg-muted rounded">
          <p className="text-xs text-muted-foreground mb-1">
            Paste JSON from Signal Generator:
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"name": "...", "CKP": "SIG1...", ...}'
            className="w-full h-16 p-1.5 bg-background border border-border text-foreground rounded font-mono text-xs resize-none"
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim() || loading}
            className="mt-1.5 px-3 py-1 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded text-xs"
          >
            {loading ? 'Importing...' : 'Import Signal'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {loading && signals.length === 0 ? (
          <p className="text-muted-foreground text-xs">Loading...</p>
        ) : signals.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No signals saved. Import one from Signal Generator.
          </p>
        ) : (
          <div className="space-y-1.5">
            {signals.map((signal) => (
              <div
                key={signal.filename}
                className="flex items-center justify-between p-2 bg-muted rounded gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium truncate">{signal.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {signal.has_ckp && <span className="text-green-400">CKP </span>}
                    {signal.has_cmp1 && <span className="text-orange-400">CMP1 </span>}
                    {signal.has_cmp2 && <span className="text-purple-400">CMP2</span>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleUpload(signal.filename)}
                    disabled={!isConnected || uploadingSignal !== null}
                    className={`px-2 py-1 rounded text-xs ${isConnected
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                  >
                    {uploadingSignal === signal.filename ? '...' : 'Upload'}
                  </button>
                  <button
                    onClick={() => handleDelete(signal.filename)}
                    className="px-2 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={loadSignals}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
