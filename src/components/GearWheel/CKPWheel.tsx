import { useEffect, useRef, useState } from 'react';
import { GearWheel } from './GearWheel';
import { InteractiveCKPWheel } from './InteractiveCKPWheel';
import { ToothListEditor } from './ToothListEditor';
import { useSignalStore } from '../../store/signalStore';
import { CKP_PRESETS } from '../../types';
import { Plus, Minus, List, X, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ANIMATION_RPM = 10; // Fixed slow RPM for visualization

export function CKPWheel() {
  const {
    ckpConfig,
    ckpMode,
    setCKPPreset,
    setCKPMode,
    setCKPCustom,
    toggleCKPTooth,
    updateCKPTooth,
    addCKPTooth,
    removeCKPTooth,
    rotationAngle,
    stepRotation,
    isRunning,
  } = useSignalStore();

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [customTeethCount, setCustomTeethCount] = useState(12);
  const [gapRatio, setGapRatio] = useState(0.5);
  const [highlightedToothId, setHighlightedToothId] = useState<number | null>(null);
  const [showListEditor, setShowListEditor] = useState(false);

  // Auto-show list editor for high tooth counts in custom mode
  const shouldShowListHint = ckpMode === 'custom' && ckpConfig.teeth.length > 36;

  // Animation loop for continuous rotation
  useEffect(() => {
    if (isRunning) {
      const animate = (time: number) => {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = time;
        }

        const deltaTime = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        // Calculate rotation at fixed 10 RPM
        const degreesPerSecond = (ANIMATION_RPM / 60) * 360;
        const deltaAngle = degreesPerSecond * deltaTime;

        stepRotation(deltaAngle);
        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = 0;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, stepRotation]);

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setCKPMode('custom');
      setCKPCustom(customTeethCount, gapRatio);
    } else {
      const preset = CKP_PRESETS.find(p => p.name === value);
      if (preset) {
        setCKPPreset(preset.totalTeeth, preset.missingTeeth, preset.name);
      }
    }
  };

  const handleCreateCustom = () => {
    setCKPCustom(customTeethCount, gapRatio);
  };

  const selectValue = ckpMode === 'custom' ? 'custom' : ckpConfig.name;

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="p-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-ckp">CKP</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectValue} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CKP_PRESETS.map(preset => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>

            {ckpMode === 'custom' && (
              <>
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon-sm">
                          <Settings2 size={14} />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Custom settings</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-64">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Teeth Count</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setCustomTeethCount(Math.max(1, customTeethCount - 1))}
                          >
                            <Minus size={12} />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            value={customTeethCount}
                            onChange={(e) => setCustomTeethCount(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                            className="w-16 h-8 text-center text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setCustomTeethCount(Math.min(120, customTeethCount + 1))}
                          >
                            <Plus size={12} />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Gap Ratio: {(gapRatio * 100).toFixed(0)}%</Label>
                        <Slider
                          min={0.1}
                          max={0.9}
                          step={0.1}
                          value={[gapRatio]}
                          onValueChange={(value) => setGapRatio(value[0])}
                        />
                      </div>
                      <Button size="sm" className="w-full" onClick={handleCreateCustom}>
                        Apply
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showListEditor ? 'secondary' : 'outline'}
                      size="icon-sm"
                      onClick={() => setShowListEditor(!showListEditor)}
                    >
                      {showListEditor ? <X size={14} /> : <List size={14} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{showListEditor ? 'Hide tooth list' : 'Show tooth list'}</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
        {ckpMode === 'custom' && (
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{ckpConfig.teeth.length} teeth • Right-click to add/remove</span>
            {shouldShowListHint && !showListEditor && (
              <button
                onClick={() => setShowListEditor(true)}
                className="text-ckp hover:underline"
              >
                Use list editor →
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-2 pt-0 flex-1 min-h-0">
        {/* Main content area with wheel and optional list editor */}
        <div className={`flex h-full ${showListEditor && ckpMode === 'custom' ? 'flex-row gap-2' : 'items-center justify-center'} w-full`}>
          {/* Wheel display */}
          <div className={`flex items-center justify-center ${showListEditor && ckpMode === 'custom' ? 'flex-1' : 'w-full h-full'}`}>
            {ckpMode === 'custom' ? (
              <InteractiveCKPWheel
                config={ckpConfig}
                onToothUpdate={updateCKPTooth}
                onToothClick={toggleCKPTooth}
                onToothAdd={addCKPTooth}
                onToothRemove={removeCKPTooth}
                rotationAngle={rotationAngle}
                highlightedToothId={highlightedToothId}
                onToothHover={setHighlightedToothId}
              />
            ) : (
              <GearWheel
                config={ckpConfig}
                onToothClick={toggleCKPTooth}
                showSensor={true}
                isCKP={true}
                rotationAngle={rotationAngle}
              />
            )}
          </div>

          {/* List editor panel */}
          {showListEditor && ckpMode === 'custom' && (
            <div className="w-64 shrink-0">
              <ToothListEditor
                teeth={ckpConfig.teeth}
                highlightedToothId={highlightedToothId}
                onToothHover={setHighlightedToothId}
                onToothClick={toggleCKPTooth}
                onToothRemove={removeCKPTooth}
                onToothUpdate={updateCKPTooth}
                maxHeight="100%"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
