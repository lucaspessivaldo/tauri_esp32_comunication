import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useSignalStore } from '../../store/signalStore';
import { generateInductiveSineSignal } from '../../utils/signalMath';
import { ZoomIn, ZoomOut, Eye, EyeOff, GripVertical, Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Activity, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Chart.js cannot parse CSS variables, so we define colors as hex values
const CHART_COLORS = {
  ckp: '#3b82f6',   // blue-500
  cmp1: '#f97316',  // orange-500
  cmp2: '#22c55e',  // green-500
};

export function Oscilloscope() {
  const {
    ckpSignal,
    cmp1Signal,
    cmp2Signal,
    showCKP,
    showCMP1,
    showCMP2,
    toggleCKPVisibility,
    toggleCMP1Visibility,
    toggleCMP2Visibility,
    rotationAngle,
    isRunning,
    toggleRunning,
    stepRotation,
    ckpWaveformDisplay,
    setCKPWaveformDisplay,
  } = useSignalStore();

  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewStart, setViewStart] = useState(0);

  // Cursor state for draggable vertical line
  const [cursorPosition, setCursorPosition] = useState(0); // percentage from left (0-100)
  const [isDragging, setIsDragging] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Calculate cursor pixel position with proper scaling
  const getCursorLeftPosition = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !chart.chartArea || !chart.canvas) return 0;

    // Get the CSS width of the canvas (display size)
    const canvas = chart.canvas;
    const cssWidth = canvas.clientWidth;
    const canvasWidth = canvas.width;

    // Calculate the scale factor between canvas coordinates and CSS pixels
    const scale = cssWidth / canvasWidth;

    const { left, right } = chart.chartArea;
    const chartWidth = right - left;

    // Convert chart area coordinates to CSS pixels
    const cssLeft = left * scale;
    const cssChartWidth = chartWidth * scale;

    return cssLeft + (cssChartWidth * cursorPosition) / 100;
  }, [cursorPosition]);

  // Throttle rotation updates to reduce flickering (update every 100ms when running)
  const [throttledRotation, setThrottledRotation] = useState(rotationAngle);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!isRunning) {
      // When not running, update immediately
      setThrottledRotation(rotationAngle);
    } else {
      // When running, throttle updates to 10fps for smooth display
      const now = Date.now();
      if (now - lastUpdateRef.current >= 100) {
        lastUpdateRef.current = now;
        setThrottledRotation(rotationAngle);
      }
    }
  }, [rotationAngle, isRunning]);

  // Calculate visible range based on zoom
  const visibleRange = 720 / zoomLevel;
  const viewEnd = Math.min(viewStart + visibleRange, 720);

  const filteredData = useMemo(() => {
    const signalLength = ckpSignal.length;

    if (signalLength === 0) {
      return { sampledCKP: [], sampledCMP1: [], sampledCMP2: [], sampledCKPSine: [] };
    }

    const steps = signalLength - 1;
    const degreesPerPoint = steps > 0 ? 720 / steps : 0;
    const shiftPoints = degreesPerPoint > 0 ? Math.round(throttledRotation / degreesPerPoint) : 0;

    const clampIndex = (value: number) => Math.max(0, Math.min(value, signalLength - 1));
    const startIndex = clampIndex(Math.floor((viewStart / 720) * steps));
    const endIndex = clampIndex(Math.ceil((viewEnd / 720) * steps));

    const getRotatedValue = (signal: typeof ckpSignal, index: number) => {
      const len = signal.length;
      if (!len) return 0;
      const sourceIndex = ((index - shiftPoints) % len + len) % len;
      return signal[sourceIndex]?.value ?? 0;
    };

    const sampledCKP: { angle: number; value: number }[] = [];
    const sampledCMP1: { angle: number; value: number }[] = [];
    const sampledCMP2: { angle: number; value: number }[] = [];

    // Walk every visible point so no narrow tooth transition is skipped
    for (let i = startIndex; i <= endIndex; i++) {
      sampledCKP.push({
        angle: ckpSignal[i].angle,
        value: getRotatedValue(ckpSignal, i),
      });

      if (cmp1Signal[i]) {
        sampledCMP1.push({
          angle: cmp1Signal[i].angle,
          value: getRotatedValue(cmp1Signal, i),
        });
      }

      if (cmp2Signal[i]) {
        sampledCMP2.push({
          angle: cmp2Signal[i].angle,
          value: getRotatedValue(cmp2Signal, i),
        });
      }
    }

    // Generate inductive sine signal for CKP if needed
    // Uses the full signal for proper edge detection, then samples the visible range
    let sampledCKPSine: { angle: number; value: number }[] = [];
    if (ckpWaveformDisplay === 'sine') {
      // Generate the full sine wave from the rotated square wave
      const rotatedCKP = ckpSignal.map((p, i) => ({
        angle: p.angle,
        value: getRotatedValue(ckpSignal, i),
      }));
      // Use smaller amplitude (5) to fit within the display area, with 1.5x for missing teeth
      const fullSineSignal = generateInductiveSineSignal(rotatedCKP, 5, 1.5, 2.5);

      // Sample only the visible range
      for (let i = startIndex; i <= endIndex; i++) {
        if (fullSineSignal[i]) {
          sampledCKPSine.push({
            angle: fullSineSignal[i].angle,
            value: fullSineSignal[i].value,
          });
        }
      }
    }

    return { sampledCKP, sampledCMP1, sampledCMP2, sampledCKPSine };
  }, [ckpSignal, cmp1Signal, cmp2Signal, viewStart, viewEnd, throttledRotation, ckpWaveformDisplay]);

  // Force re-render when chart updates to get correct cursor position
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    // Small delay to ensure chart is fully rendered
    const timer = setTimeout(() => forceUpdate(n => n + 1), 50);
    return () => clearTimeout(timer);
  }, [zoomLevel, viewStart, ckpSignal]);

  // Cursor drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !chartContainerRef.current || !chartRef.current) return;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const chart = chartRef.current;
    if (!chart.chartArea || !chart.canvas) return;

    // Get the CSS width of the canvas (display size)
    const canvas = chart.canvas;
    const cssWidth = canvas.clientWidth;
    const canvasWidth = canvas.width;
    const scale = cssWidth / canvasWidth;

    // Convert chart area to CSS pixels
    const cssChartLeft = chart.chartArea.left * scale;
    const cssChartWidth = (chart.chartArea.right - chart.chartArea.left) * scale;

    const x = e.clientX - rect.left - cssChartLeft;

    const percentage = Math.max(0, Math.min(100, (x / cssChartWidth) * 100));
    setCursorPosition(percentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const labels = filteredData.sampledCKP.map(p => p.angle.toFixed(0));

  const datasets = [];

  // CKP signal - supports both square wave (Hall/Digital) and sine wave (Inductive) display
  if (showCKP) {
    if (ckpWaveformDisplay === 'sine') {
      // Inductive sensor visualization - sine-like waveform centered around baseline
      // Offset by 5 to center the sine wave in the CKP display area
      datasets.push({
        label: 'CKP (Inductive)',
        data: filteredData.sampledCKPSine.map(p => ({ x: p.angle, y: p.value + 5 })),
        borderColor: CHART_COLORS.ckp,
        backgroundColor: CHART_COLORS.ckp,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3, // Smooth curve for sine wave appearance
        stepped: false,
      });
    } else {
      // Square wave (Hall/Digital sensor) visualization - stepped
      datasets.push({
        label: 'CKP',
        data: filteredData.sampledCKP.map(p => ({ x: p.angle, y: p.value })),
        borderColor: CHART_COLORS.ckp,
        backgroundColor: CHART_COLORS.ckp,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        stepped: true,
      });
    }
  }

  if (showCMP1) {
    datasets.push({
      label: 'CMP-1',
      data: filteredData.sampledCMP1.map(p => ({ x: p.angle, y: p.value + 20 })),
      borderColor: CHART_COLORS.cmp1,
      backgroundColor: CHART_COLORS.cmp1,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      stepped: true,
    });
  }

  if (showCMP2) {
    datasets.push({
      label: 'CMP-2',
      data: filteredData.sampledCMP2.map(p => ({ x: p.angle, y: p.value + 40 })),
      borderColor: CHART_COLORS.cmp2,
      backgroundColor: CHART_COLORS.cmp2,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      stepped: true,
    });
  }

  const data = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: viewStart,
        max: viewEnd,
        title: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 25,
          autoSkip: false,
          stepSize: (viewEnd - viewStart) / 12,
          color: '#374151', // gray-700
          font: {
            family: 'monospace',
            size: 10
          },
          callback: function (value: any) {
            return Math.round(value) + '°';
          }
        },
        grid: {
          color: 'rgba(55, 65, 81, 0.15)', // gray-700 with opacity
          borderColor: 'rgba(55, 65, 81, 0.15)',
          tickLength: 0,
        },
        border: {
          display: false,
        }
      },
      y: {
        min: -5,
        max: 65,
        ticks: {
          display: false,
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.3)',
          borderColor: 'rgba(156, 163, 175, 0.3)',
          tickLength: 0,
        },
        border: {
          display: false,
        }
      },
    },
  };

  const handleZoomIn = () => {
    if (zoomLevel < 4) {
      setZoomLevel(prev => prev * 2);
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 1) {
      setZoomLevel(prev => prev / 2);
      setViewStart(0);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with controls - fixed height */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        {/* Channel toggles */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCKPVisibility}
              className={`gap-1.5 rounded-r-none h-6 ${showCKP
                ? 'bg-ckp/10 text-ckp border border-ckp/30'
                : 'bg-muted text-muted-foreground border border-border opacity-60'
                }`}
            >
              {showCKP ? <Eye size={14} /> : <EyeOff size={14} />}
              CKP
            </Button>
            {/* Waveform type selector for CKP */}
            {showCKP && (
              <div className="flex items-center">
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCKPWaveformDisplay('square')}
                      className={`h-6 px-1.5 rounded-none border-y border-r ${ckpWaveformDisplay === 'square'
                        ? 'bg-ckp/20 text-ckp border-ckp/30'
                        : 'bg-muted text-muted-foreground border-border opacity-60 hover:opacity-100'
                        }`}
                    >
                      <Square size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Square Wave (Hall/Digital)</TooltipContent>
                </UITooltip>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCKPWaveformDisplay('sine')}
                      className={`h-6 px-1.5 rounded-l-none rounded-r-lg border-y border-r ${ckpWaveformDisplay === 'sine'
                        ? 'bg-ckp/20 text-ckp border-ckp/30'
                        : 'bg-muted text-muted-foreground border-border opacity-60 hover:opacity-100'
                        }`}
                    >
                      <Activity size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sine Wave (Inductive)</TooltipContent>
                </UITooltip>
              </div>
            )}
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCMP1Visibility}
              className={`gap-1.5 rounded-r-none h-6 ${showCMP1
                ? 'bg-cmp1/10 text-cmp1 border border-cmp1/30'
                : 'bg-muted text-muted-foreground border border-border opacity-60'
                }`}
            >
              {showCMP1 ? <Eye size={14} /> : <EyeOff size={14} />}
              CMP-1
            </Button>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCMP2Visibility}
              className={`gap-1.5 rounded-r-none h-6 ${showCMP2
                ? 'bg-cmp2/10 text-cmp2 border border-cmp2/30'
                : 'bg-muted text-muted-foreground border border-border opacity-60'
                }`}
            >
              {showCMP2 ? <Eye size={14} /> : <EyeOff size={14} />}
              CMP-2
            </Button>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
              >
                <ZoomOut size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </UITooltip>
          <span className="text-xs font-mono text-muted-foreground w-10 text-center bg-muted py-0.5 border rounded">{zoomLevel}x</span>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
              >
                <ZoomIn size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </UITooltip>
        </div>
      </div>

      {/* Chart - takes all remaining space */}
      <div className="flex-1 min-h-0 relative overflow-hidden" ref={chartContainerRef}>
        <Line ref={chartRef} data={data} options={options} />

        {/* Draggable cursor line */}
        {chartRef.current?.chartArea && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center cursor-ew-resize z-10"
            style={{
              left: `${getCursorLeftPosition()}px`,
              transform: 'translateX(-50%)',
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Cursor handle */}
            <div className="bg-destructive hover:bg-destructive/90 shadow-md p-1 select-none transition-colors rounded-sm">
              <GripVertical size={14} className="text-white/80" />
            </div>
            {/* Vertical line */}
            <div className="w-px flex-1 bg-destructive"></div>
            {/* Bottom indicator */}
            <div className="w-2 h-2 bg-destructive rotate-45 -mt-1"></div>
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-start justify-end gap-2 pt-3 mt-2 border-t overflow-hidden">
        <UITooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => stepRotation(-60)}
              disabled={isRunning}
              className="p-1.5! h-6!"
            >
              <ChevronsLeft size={24} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump back 60°</TooltipContent>
        </UITooltip>
        <UITooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => stepRotation(-10)}
              disabled={isRunning}
              className="p-1.5! h-6!"
            >
              <ChevronLeft size={24} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Step back 10°</TooltipContent>
        </UITooltip>
        <UITooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
              onClick={toggleRunning}
              className="p-1.5! h-6! bg-green-600 hover:bg-green-700 data-[running=true]:bg-destructive data-[running=true]:hover:bg-destructive/90"
              data-running={isRunning}
            >
              {isRunning ? <Pause size={24} /> : <Play size={24} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isRunning ? 'Pause' : 'Play'}</TooltipContent>
        </UITooltip>
        <UITooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => stepRotation(10)}
              disabled={isRunning}
              className="p-1.5! h-6!"
            >
              <ChevronRight size={24} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Step forward 10°</TooltipContent>
        </UITooltip>
        <UITooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => stepRotation(60)}
              disabled={isRunning}
              className="p-1.5! h-6!"
            >
              <ChevronsRight size={24} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump forward 60°</TooltipContent>
        </UITooltip>
      </div>
    </div>
  );
}
