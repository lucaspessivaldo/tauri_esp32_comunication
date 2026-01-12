import { useRef, useEffect, useState, useCallback } from 'react';
import type { GearWheelConfig, Tooth } from '../../types';
import { Trash2, Plus, ToggleLeft, ToggleRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface InteractiveCKPWheelProps {
  config: GearWheelConfig;
  size?: number;
  onToothUpdate?: (toothId: number, startAngle: number, endAngle: number) => void;
  onToothClick?: (toothId: number) => void;
  onToothRemove?: (toothId: number) => void;
  onToothAdd?: () => void;
  rotationAngle?: number;
  highlightedToothId?: number | null;
  onToothHover?: (toothId: number | null) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

type DragMode = 'none' | 'move' | 'resize-start' | 'resize-end';

interface DragState {
  mode: DragMode;
  toothId: number | null;
  initialAngle: number;
  initialToothStart: number;
  initialToothEnd: number;
}

export function InteractiveCKPWheel({
  config,
  size: fixedSize,
  onToothUpdate,
  onToothClick,
  onToothRemove,
  onToothAdd,
  rotationAngle = 0,
  highlightedToothId,
  onToothHover,
}: InteractiveCKPWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: fixedSize || 200, height: fixedSize || 200 });

  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  const [contextMenuToothId, setContextMenuToothId] = useState<number | null>(null);
  const [contextMenuTooth, setContextMenuTooth] = useState<Tooth | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    mode: 'none',
    toothId: null,
    initialAngle: 0,
    initialToothStart: 0,
    initialToothEnd: 0,
  });
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<'start' | 'end' | 'body' | null>(null);

  useEffect(() => {
    if (fixedSize) {
      setDimensions({ width: fixedSize, height: fixedSize });
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        const size = Math.min(width, height || width);
        setDimensions({ width: size, height: size });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [fixedSize]);

  const size = dimensions.width;

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = Math.max(MIN_ZOOM, prev - ZOOM_STEP);
      // Reset pan when zooming out to minimum
      if (newZoom === MIN_ZOOM) {
        setPanOffset({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));

    if (newZoom !== zoomLevel) {
      // Zoom toward cursor position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cursorX = e.clientX - rect.left - size / 2;
        const cursorY = e.clientY - rect.top - size / 2;

        const zoomFactor = newZoom / zoomLevel;
        const newPanX = cursorX - (cursorX - panOffset.x) * zoomFactor;
        const newPanY = cursorY - (cursorY - panOffset.y) * zoomFactor;

        if (newZoom === MIN_ZOOM) {
          setPanOffset({ x: 0, y: 0 });
        } else {
          setPanOffset({ x: newPanX, y: newPanY });
        }
      }
      setZoomLevel(newZoom);
    }
  }, [zoomLevel, size, panOffset]);

  // CKP uses blue accent color
  const colors = {
    active: '#1d4ed8', // blue-700
    handle: '#3b82f6', // blue-500
    handleHover: '#60a5fa', // blue-400
    tooth: '#9ca3af', // gray-400
    toothDisabled: '#4b5563', // gray-600
  };

  const getAngleFromPoint = useCallback((x: number, y: number): number => {
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;
    angle = (angle - rotationAngle + 360) % 360;
    return angle;
  }, [rotationAngle]);

  const normalizeAngle = (angle: number): number => {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  };

  const getHandlePositionsForDraw = useCallback((tooth: Tooth, scale: number, centerX: number, centerY: number) => {
    const handleRadius = (config.outerRadius - 5) * scale;
    const startRad = (tooth.startAngle - 90) * Math.PI / 180;
    const endRad = (tooth.endAngle - 90) * Math.PI / 180;
    const midRad = ((tooth.startAngle + tooth.endAngle) / 2 - 90) * Math.PI / 180;

    return {
      start: {
        x: centerX + Math.cos(startRad) * handleRadius,
        y: centerY + Math.sin(startRad) * handleRadius,
      },
      end: {
        x: centerX + Math.cos(endRad) * handleRadius,
        y: centerY + Math.sin(endRad) * handleRadius,
      },
      mid: {
        x: centerX + Math.cos(midRad) * handleRadius,
        y: centerY + Math.sin(midRad) * handleRadius,
      },
    };
  }, [config.outerRadius]);

  const getHandlePositionsForHit = useCallback((tooth: Tooth, scale: number, centerX: number, centerY: number) => {
    const handleRadius = (config.outerRadius - 5) * scale;
    const startRad = (tooth.startAngle + rotationAngle - 90) * Math.PI / 180;
    const endRad = (tooth.endAngle + rotationAngle - 90) * Math.PI / 180;
    const midRad = ((tooth.startAngle + tooth.endAngle) / 2 + rotationAngle - 90) * Math.PI / 180;

    return {
      start: {
        x: centerX + Math.cos(startRad) * handleRadius,
        y: centerY + Math.sin(startRad) * handleRadius,
      },
      end: {
        x: centerX + Math.cos(endRad) * handleRadius,
        y: centerY + Math.sin(endRad) * handleRadius,
      },
      mid: {
        x: centerX + Math.cos(midRad) * handleRadius,
        y: centerY + Math.sin(midRad) * handleRadius,
      },
    };
  }, [config.outerRadius, rotationAngle]);

  const isPointNearHandle = useCallback((px: number, py: number, hx: number, hy: number): boolean => {
    // Scale threshold inversely with zoom for better hit detection when zoomed
    const threshold = 10 / zoomLevel;
    const dist = Math.sqrt((px - hx) ** 2 + (py - hy) ** 2);
    return dist < threshold * zoomLevel; // Keep consistent screen-space threshold
  }, [zoomLevel]);

  const isPointInTooth = useCallback((angle: number, tooth: Tooth): boolean => {
    let start = tooth.startAngle;
    let end = tooth.endAngle;

    if (end < start) {
      return angle >= start || angle <= end;
    }
    return angle >= start && angle <= end;
  }, []);

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size / 200;

    ctx.clearRect(0, 0, size, size);

    // Save context for zoom and pan
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(panOffset.x / zoomLevel, panOffset.y / zoomLevel);
    ctx.translate(-centerX, -centerY);

    // Save context for rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotationAngle * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Draw outer ring (body)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 85 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#4b5563'; // gray-600
    ctx.fill();

    // Draw inner circle (hub)
    ctx.beginPath();
    ctx.arc(centerX, centerY, config.innerRadius * scale * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#374151'; // gray-700
    ctx.fill();

    // Draw center hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fill();

    // Draw teeth
    config.teeth.forEach((tooth) => {
      const startRad = (tooth.startAngle - 90) * Math.PI / 180;
      const endRad = (tooth.endAngle - 90) * Math.PI / 180;

      ctx.beginPath();
      ctx.arc(centerX, centerY, config.outerRadius * scale, startRad, endRad);
      ctx.arc(centerX, centerY, config.innerRadius * scale, endRad, startRad, true);
      ctx.closePath();

      const isActive = hoveredTooth === tooth.id || dragState.toothId === tooth.id || highlightedToothId === tooth.id;

      if (!tooth.enabled) {
        ctx.fillStyle = colors.toothDisabled;
      } else if (isActive) {
        ctx.fillStyle = colors.active;
      } else {
        ctx.fillStyle = colors.tooth;
      }

      ctx.fill();
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Draw drag handles for active tooth
      if (isActive && tooth.enabled) {
        const handles = getHandlePositionsForDraw(tooth, scale, centerX, centerY);

        // Start handle
        ctx.beginPath();
        ctx.arc(handles.start.x, handles.start.y, 5 * scale, 0, Math.PI * 2);
        ctx.fillStyle = hoveredHandle === 'start' ? colors.handleHover : colors.handle;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // End handle
        ctx.beginPath();
        ctx.arc(handles.end.x, handles.end.y, 5 * scale, 0, Math.PI * 2);
        ctx.fillStyle = hoveredHandle === 'end' ? colors.handleHover : colors.handle;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.restore(); // restore rotation
    ctx.restore(); // restore zoom/pan

  }, [config, size, hoveredTooth, hoveredHandle, dragState, getHandlePositionsForDraw, rotationAngle, colors, zoomLevel, panOffset, highlightedToothId]);

  // Transform screen coordinates to canvas coordinates (accounting for zoom/pan)
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const centerX = size / 2;
    const centerY = size / 2;

    // Reverse the zoom and pan transforms
    const canvasX = (screenX - centerX) / zoomLevel - panOffset.x / zoomLevel + centerX;
    const canvasY = (screenY - centerY) / zoomLevel - panOffset.y / zoomLevel + centerY;

    return { x: canvasX, y: canvasY };
  }, [size, zoomLevel, panOffset]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Handle middle mouse button for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = screenToCanvas(screenX, screenY);

    const x = canvasPos.x - size / 2;
    const y = canvasPos.y - size / 2;
    const scale = size / 200;
    const angle = getAngleFromPoint(x, y);

    // Check if clicking on a handle (use canvas coordinates for hit detection)
    for (const tooth of config.teeth) {
      if (!tooth.enabled) continue;

      const handles = getHandlePositionsForHit(tooth, scale, size / 2, size / 2);

      if (isPointNearHandle(canvasPos.x, canvasPos.y, handles.start.x, handles.start.y)) {
        setDragState({
          mode: 'resize-start',
          toothId: tooth.id,
          initialAngle: angle,
          initialToothStart: tooth.startAngle,
          initialToothEnd: tooth.endAngle,
        });
        return;
      }

      if (isPointNearHandle(canvasPos.x, canvasPos.y, handles.end.x, handles.end.y)) {
        setDragState({
          mode: 'resize-end',
          toothId: tooth.id,
          initialAngle: angle,
          initialToothStart: tooth.startAngle,
          initialToothEnd: tooth.endAngle,
        });
        return;
      }
    }

    // Check if clicking on a tooth body (for moving)
    for (const tooth of config.teeth) {
      if (isPointInTooth(angle, tooth)) {
        if (tooth.enabled) {
          setDragState({
            mode: 'move',
            toothId: tooth.id,
            initialAngle: angle,
            initialToothStart: tooth.startAngle,
            initialToothEnd: tooth.endAngle,
          });
        }
        setHoveredTooth(tooth.id);
        onToothHover?.(tooth.id);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Handle panning
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = screenToCanvas(screenX, screenY);

    const x = canvasPos.x - size / 2;
    const y = canvasPos.y - size / 2;
    const scale = size / 200;
    const angle = getAngleFromPoint(x, y);

    if (dragState.mode !== 'none' && dragState.toothId !== null) {
      const angleDelta = angle - dragState.initialAngle;
      const tooth = config.teeth.find(t => t.id === dragState.toothId);
      if (!tooth || !onToothUpdate) return;

      let newStart = dragState.initialToothStart;
      let newEnd = dragState.initialToothEnd;

      if (dragState.mode === 'move') {
        newStart = normalizeAngle(dragState.initialToothStart + angleDelta);
        newEnd = normalizeAngle(dragState.initialToothEnd + angleDelta);
      } else if (dragState.mode === 'resize-start') {
        newStart = normalizeAngle(dragState.initialToothStart + angleDelta);
      } else if (dragState.mode === 'resize-end') {
        newEnd = normalizeAngle(dragState.initialToothEnd + angleDelta);
      }

      onToothUpdate(dragState.toothId, newStart, newEnd);
      return;
    }

    // Check hover state
    let foundHandle: 'start' | 'end' | 'body' | null = null;
    let foundTooth: number | null = null;

    for (const tooth of config.teeth) {
      if (tooth.enabled) {
        const handles = getHandlePositionsForHit(tooth, scale, size / 2, size / 2);

        if (isPointNearHandle(canvasPos.x, canvasPos.y, handles.start.x, handles.start.y)) {
          foundHandle = 'start';
          foundTooth = tooth.id;
          break;
        }

        if (isPointNearHandle(canvasPos.x, canvasPos.y, handles.end.x, handles.end.y)) {
          foundHandle = 'end';
          foundTooth = tooth.id;
          break;
        }
      }

      if (isPointInTooth(angle, tooth)) {
        foundHandle = tooth.enabled ? 'body' : null;
        foundTooth = tooth.id;
      }
    }

    setHoveredHandle(foundHandle);
    setHoveredTooth(foundTooth);
    onToothHover?.(foundTooth);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (dragState.mode === 'none' && hoveredTooth !== null && onToothClick) {
      onToothClick(hoveredTooth);
    }
    setDragState({
      mode: 'none',
      toothId: null,
      initialAngle: 0,
      initialToothStart: 0,
      initialToothEnd: 0,
    });
  };

  const handleMouseLeave = () => {
    setHoveredTooth(null);
    setHoveredHandle(null);
    setIsPanning(false);
    onToothHover?.(null);
    if (dragState.mode !== 'none') {
      handleMouseUp();
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = screenToCanvas(screenX, screenY);

    const x = canvasPos.x - size / 2;
    const y = canvasPos.y - size / 2;
    const angle = getAngleFromPoint(x, y);

    for (const tooth of config.teeth) {
      if (isPointInTooth(angle, tooth)) {
        setContextMenuToothId(tooth.id);
        setContextMenuTooth(tooth);
        return;
      }
    }
    setContextMenuToothId(null);
    setContextMenuTooth(null);
  };

  const handleRemoveTooth = () => {
    if (contextMenuToothId !== null && onToothRemove) {
      onToothRemove(contextMenuToothId);
      setContextMenuToothId(null);
      setContextMenuTooth(null);
    }
  };

  const handleToggleTooth = () => {
    if (contextMenuToothId !== null && onToothClick) {
      onToothClick(contextMenuToothId);
      setContextMenuToothId(null);
      setContextMenuTooth(null);
    }
  };

  const getCursor = (): string => {
    if (isPanning) return 'grabbing';
    if (dragState.mode !== 'none') return 'grabbing';
    if (hoveredHandle === 'start' || hoveredHandle === 'end') return 'ew-resize';
    if (hoveredHandle === 'body') return 'grab';
    if (zoomLevel > 1) return 'grab';
    return 'default';
  };

  const canRemove = config.teeth.length > 1 && contextMenuToothId !== null;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center min-h-[280px] relative overflow-hidden">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
            style={{ cursor: getCursor() }}
            role="img"
            aria-label="Interactive Crankshaft Position Wheel"
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-40">
          <ContextMenuItem onClick={onToothAdd}>
            <Plus size={16} className="mr-2" />
            Add Tooth
          </ContextMenuItem>
          {contextMenuToothId !== null && (
            <>
              <ContextMenuItem onClick={handleToggleTooth}>
                {contextMenuTooth?.enabled ? <ToggleRight size={16} className="mr-2" /> : <ToggleLeft size={16} className="mr-2" />}
                {contextMenuTooth?.enabled ? 'Disable Tooth' : 'Enable Tooth'}
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!canRemove}
                onClick={handleRemoveTooth}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={16} className="mr-2" />
                Remove Tooth
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Zoom controls overlay */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 bg-background/90 rounded-md shadow-md p-1 border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomIn}
              disabled={zoomLevel >= MAX_ZOOM}
            >
              <ZoomIn size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom in (scroll wheel)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomReset}
              disabled={zoomLevel === 1}
              className="text-xs font-medium min-w-7"
            >
              {zoomLevel > 1 ? `${zoomLevel.toFixed(1)}x` : <Maximize2 size={16} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Reset zoom</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomOut}
              disabled={zoomLevel <= MIN_ZOOM}
            >
              <ZoomOut size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom out (scroll wheel)</TooltipContent>
        </Tooltip>
      </div>

      {/* Zoom hint when teeth are small */}
      {config.teeth.length > 36 && zoomLevel === 1 && (
        <div className="absolute top-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          Scroll to zoom • Alt+drag to pan
        </div>
      )}
    </div>
  );
}
