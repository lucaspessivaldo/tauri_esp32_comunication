import { CKPWheel } from '../GearWheel/CKPWheel';
import { CMPWheel } from '../GearWheel/CMPWheel';
import { Oscilloscope } from '../Oscilloscope';
import { Toolbar } from '../Toolbar';
import { Toaster } from '../ui/sonner';

export function SignalEditor() {
  return (
    <div className="h-[calc(100vh-57px)] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header with Toolbar */}
      <header className="bg-card border-b border-border px-4 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h1 className="text-lg font-semibold text-foreground">
              Signal Editor
            </h1>
          </div>
          <Toolbar />
        </div>
      </header>

      {/* Main Content - Flex layout to fit screen */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
        {/* Gear Wheels Row - Compact */}
        <div className="grid grid-cols-3 gap-4 shrink-0" style={{ height: '45%', minHeight: '280px' }}>
          <CKPWheel />
          <CMPWheel wheelNumber={1} />
          <CMPWheel wheelNumber={2} />
        </div>

        {/* Oscilloscope Panel - Takes remaining space */}
        <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden min-h-[200px] p-4">
          <Oscilloscope />
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default SignalEditor;
