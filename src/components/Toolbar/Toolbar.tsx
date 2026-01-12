import { useRef } from 'react';
import { Download, Upload, Send, Save } from 'lucide-react';
import { useSignalStore } from '../../store/signalStore';
import { useConnectionStore } from '../../store/connectionStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadConfig = useSignalStore((state) => state.downloadConfig);
  const loadConfigFromFile = useSignalStore((state) => state.loadConfigFromFile);
  const getDeviceConfig = useSignalStore((state) => state.getDeviceConfig);

  // Connection store for direct device upload
  const { status, uploadConfig, saveSignal } = useConnectionStore();

  const handleExport = () => {
    try {
      downloadConfig();
      toast.success('Configuration exported successfully');
    } catch (error) {
      toast.error('Failed to export configuration');
    }
  };

  const handleSendToDevice = async () => {
    if (!status.connected) {
      toast.error('Not connected to device. Go to Device Control tab to connect.');
      return;
    }

    try {
      const deviceConfig = getDeviceConfig();
      await uploadConfig(deviceConfig);
      toast.success('Signal sent to device successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send to device');
    }
  };

  const handleSaveToLibrary = async () => {
    try {
      const deviceConfig = getDeviceConfig();
      await saveSignal(deviceConfig);
      toast.success('Signal saved to library!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save signal');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await loadConfigFromFile(file);
      toast.success('Configuration imported successfully');
    } catch (error) {
      console.error('Failed to import configuration:', error);
      toast.error(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : 'Failed to import configuration. Please check the file format.'
      );
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSendToDevice}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3"
            disabled={!status.connected}
          >
            <Send size={16} />
            <span className="hidden sm:inline ml-1.5">Send to Device</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {status.connected
            ? 'Upload signal config directly to ESP32'
            : 'Connect to device first (Device Control tab)'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSaveToLibrary}
            size="sm"
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-3"
          >
            <Save size={16} />
            <span className="hidden sm:inline ml-1.5">Save to Library</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save signal to local library</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleExport}
            size="sm"
            variant="outline"
            className="border-slate-300 hover:bg-slate-100 px-3"
          >
            <Download size={16} />
            <span className="hidden sm:inline ml-1.5">Export</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export configuration file</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleImportClick}
            size="sm"
            variant="outline"
            className="border-slate-300 hover:bg-slate-100 px-3"
          >
            <Upload size={16} />
            <span className="hidden sm:inline ml-1.5">Import</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import configuration</TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
