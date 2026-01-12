import { useRef, useEffect, useState, useCallback } from 'react';
import type { GearWheelConfig, Tooth } from '../../types';
import { Trash2, Plus } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface InteractiveCMPWheelProps {
  config: GearWheelConfig;
  size?: number; // Optional fixed size, otherwise responsive
  onToothUpdate?: (toothId: number, startAngle: number, endAngle: number) => void;
  onToothClick?: (toothId: number) => void;
  onToothRemove?: (toothId: number) => void;
  onToothAdd?: () => void;
  rotationAngle?: number;
  accentColor?: string;
}

type DragMode = 'none' | 'move' | 'resize-start' | 'resize-end';

interface DragState {
  mode: DragMode;
  toothId: number | null;
  initialAngle: number;
  initialToothStart: number;
  initialToothEnd: number;
}

export function InteractiveCMPWheel({
  config,
  size: fixedSize,
  onToothUpdate,
  onToothClick,
  onToothRemove,
  onToothAdd,
  rotationAngle = 0,
  accentColor = 'orange',
}: InteractiveCMPWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: fixedSize || 200, height: fixedSize || 200 });

  const [contextMenuToothId, setContextMenuToothId] = useState<number | null>(null);
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

  // Get accent colors based on prop
  const getAccentColors = () => {
    switch (accentColor) {
      case 'green':
        return { active: '#15803d', handle: '#22c55e', handleHover: '#4ade80' }; // green-700, green-500, green-400
      case 'orange':
      default:
        return { active: '#c2410c', handle: '#f97316', handleHover: '#fb923c' }; // orange-700, orange-500, orange-400
    }
  };

  const colors = getAccentColors();

  const getAngleFromPoint = useCallback((x: number, y: number): number => {
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;
    // Adjust for rotation
    angle = (angle - rotationAngle + 360) % 360;
    return angle;
  }, [rotationAngle]);

  const normalizeAngle = (angle: number): number => {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  };

  // For drawing handles inside the rotated context (no rotation needed)
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

  // For hit detection on screen coordinates (includes rotation)
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

  const isPointNearHandle = (px: number, py: number, hx: number, hy: number, threshold: number = 12): boolean => {
    const dist = Math.sqrt((px - hx) ** 2 + (py - hy) ** 2);
    return dist < threshold;
  };

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

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Adjust style width/height
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size / 200;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Save context state for rotation
    ctx.save();

    // Apply rotation around center
    ctx.translate(centerX, centerY);
    ctx.rotate((rotationAngle * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Draw outer ring (body of the gear)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 85 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#4b5563'; // gray-600
    ctx.fill();

    // Draw inner circle (hub)
    ctx.beginPath();
    ctx.arc(centerX, centerY, config.innerRadius * scale * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#374151'; // gray-700
    ctx.fill();

    // Draw center hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fill();

    // Draw teeth
    config.teeth.forEach((tooth) => {
      if (!tooth.enabled) return;

      const startRad = (tooth.startAngle - 90) * Math.PI / 180;
      const endRad = (tooth.endAngle - 90) * Math.PI / 180;

      ctx.beginPath();
      ctx.arc(centerX, centerY, config.outerRadius * scale, startRad, endRad);
      ctx.arc(centerX, centerY, config.innerRadius * scale, endRad, startRad, true);
      ctx.closePath();

      // Highlight hovered or dragged tooth with accent color
      const isActive = hoveredTooth === tooth.id || dragState.toothId === tooth.id;
      ctx.fillStyle = isActive ? colors.active : '#9ca3af'; // gray-400
      ctx.fill();
      ctx.strokeStyle = '#4b5563'; // gray-600
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Draw drag handles for active tooth
      if (isActive && tooth.enabled) {
        const handles = getHandlePositionsForDraw(tooth, scale, centerX, centerY);

        // Start handle (resize)
        ctx.beginPath();
        ctx.arc(handles.start.x, handles.start.y, 6 * scale, 0, Math.PI * 2);
        ctx.fillStyle = hoveredHandle === 'start' ? colors.handleHover : colors.handle;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // End handle (resize)
        ctx.beginPath();
        ctx.arc(handles.end.x, handles.end.y, 6 * scale, 0, Math.PI * 2);
        ctx.fillStyle = hoveredHandle === 'end' ? colors.handleHover : colors.handle;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Restore context before drawing non-rotating elements
    ctx.restore();

  }, [config, size, hoveredTooth, hoveredHandle, dragState, getHandlePositionsForDraw, rotationAngle, colors]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const scale = size / 200;
    const angle = getAngleFromPoint(x, y);

    // Check if clicking on a handle
    for (const tooth of config.teeth) {
      if (!tooth.enabled) continue;

      const handles = getHandlePositionsForHit(tooth, scale, size / 2, size / 2);
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (isPointNearHandle(px, py, handles.start.x, handles.start.y)) {
        setDragState({
          mode: 'resize-start',
          toothId: tooth.id,
          initialAngle: angle,
          initialToothStart: tooth.startAngle,
          initialToothEnd: tooth.endAngle,
        });
        return;
      }

      if (isPointNearHandle(px, py, handles.end.x, handles.end.y)) {
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
      if (!tooth.enabled) continue;

      if (isPointInTooth(angle, tooth)) {
        setDragState({
          mode: 'move',
          toothId: tooth.id,
          initialAngle: angle,
          initialToothStart: tooth.startAngle,
          initialToothEnd: tooth.endAngle,
        });
        setHoveredTooth(tooth.id);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const scale = size / 200;
    const angle = getAngleFromPoint(x, y);
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

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

    // Check hover state for handles
    let foundHandle: 'start' | 'end' | 'body' | null = null;
    let foundTooth: number | null = null;

    for (const tooth of config.teeth) {
      if (!tooth.enabled) continue;

      const handles = getHandlePositionsForHit(tooth, scale, size / 2, size / 2);

      if (isPointNearHandle(px, py, handles.start.x, handles.start.y)) {
        foundHandle = 'start';
        foundTooth = tooth.id;
        break;
      }

      if (isPointNearHandle(px, py, handles.end.x, handles.end.y)) {
        foundHandle = 'end';
        foundTooth = tooth.id;
        break;
      }

      if (isPointInTooth(angle, tooth)) {
        foundHandle = 'body';
        foundTooth = tooth.id;
      }
    }

    setHoveredHandle(foundHandle);
    setHoveredTooth(foundTooth);
  };

  const handleMouseUp = () => {
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
    if (dragState.mode !== 'none') {
      handleMouseUp();
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const angle = getAngleFromPoint(x, y);

    // Find which tooth was right-clicked
    for (const tooth of config.teeth) {
      if (!tooth.enabled) continue;
      if (isPointInTooth(angle, tooth)) {
        setContextMenuToothId(tooth.id);
        return;
      }
    }
    // No tooth was clicked
    setContextMenuToothId(null);
  };

  const handleRemoveTooth = () => {
    if (contextMenuToothId !== null && onToothRemove) {
      onToothRemove(contextMenuToothId);
      setContextMenuToothId(null);
    }
  };

  const getCursor = (): string => {
    if (dragState.mode !== 'none') return 'grabbing';
    if (hoveredHandle === 'start' || hoveredHandle === 'end') return 'ew-resize';
    if (hoveredHandle === 'body') return 'grab';
    return 'default';
  };

  const canRemove = config.teeth.length > 1 && contextMenuToothId !== null;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center min-h-[280px]">
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
            style={{ cursor: getCursor() }}
            role="img"
            aria-label="Interactive Camshaft Position Wheel"
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-40">
          <ContextMenuItem onClick={onToothAdd}>
            <Plus size={16} className="mr-2" />
            Add Tooth
          </ContextMenuItem>
          {contextMenuToothId !== null && (
            <ContextMenuItem
              disabled={!canRemove}
              onClick={handleRemoveTooth}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 size={16} className="mr-2" />
              Remove Tooth
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
