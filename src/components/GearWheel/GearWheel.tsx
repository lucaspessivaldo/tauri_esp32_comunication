import { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import type { GearWheelConfig } from '../../types';

interface GearWheelProps {
  config: GearWheelConfig;
  size?: number; // Optional fixed size, otherwise responsive
  onToothClick?: (toothId: number) => void;
  showSensor?: boolean;
  isCKP?: boolean;
  rotationAngle?: number;
}

export function GearWheel({
  config,
  size: fixedSize,
  onToothClick,
  showSensor = true,
  isCKP = false,
  rotationAngle = 0
}: GearWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: fixedSize || 200, height: fixedSize || 200 });
  const [hoveredToothId, setHoveredToothId] = useState<number | null>(null);
  const [hoveredDisabledToothId, setHoveredDisabledToothId] = useState<number | null>(null);

  // Use refs to avoid stale closure issues with animation
  const rotationAngleRef = useRef(rotationAngle);
  rotationAngleRef.current = rotationAngle;

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
        // Keep it square, based on the smaller dimension to fit
        const size = Math.min(width, height || width);
        setDimensions({ width: size, height: size });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [fixedSize]);

  const size = dimensions.width;

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

    // Apply rotation around center (use mod 360 for visual rotation)
    const visualRotation = rotationAngle % 360;
    ctx.translate(centerX, centerY);
    ctx.rotate((visualRotation * Math.PI) / 180);
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

    // Draw mounting holes for CKP
    if (isCKP) {
      const holeRadius = 5 * scale;
      const holeDistance = 30 * scale;
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 90) * Math.PI / 180;
        const hx = centerX + Math.cos(angle) * holeDistance;
        const hy = centerY + Math.sin(angle) * holeDistance;
        ctx.beginPath();
        ctx.arc(hx, hy, holeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1f2937'; // gray-800
        ctx.fill();
      }
    }

    // Draw teeth (and ghost teeth for disabled slots on hover)
    config.teeth.forEach((tooth) => {
      const startRad = (tooth.startAngle - 90) * Math.PI / 180;
      const endRad = (tooth.endAngle - 90) * Math.PI / 180;

      // Draw ghost tooth for disabled teeth when hovered (CKP only)
      if (!tooth.enabled) {
        if (isCKP && hoveredDisabledToothId === tooth.id) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, config.outerRadius * scale, startRad, endRad);
          ctx.arc(centerX, centerY, config.innerRadius * scale, endRad, startRad, true);
          ctx.closePath();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // blue-500 with transparency
          ctx.fill();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        return;
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, config.outerRadius * scale, startRad, endRad);
      ctx.arc(centerX, centerY, config.innerRadius * scale, endRad, startRad, true);
      ctx.closePath();

      // Different color for CKP vs CMP teeth, with hover highlight
      if (hoveredToothId === tooth.id) {
        ctx.fillStyle = '#3b82f6'; // blue-500 (matches CKP signal color)
      } else if (isCKP) {
        ctx.fillStyle = '#6b7280'; // gray-500
      } else {
        ctx.fillStyle = '#9ca3af'; // gray-400
      }
      ctx.fill();
      ctx.strokeStyle = '#4b5563'; // gray-600
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    ctx.restore();

    // Draw sensor indicator line (only for non-CKP, CKP uses overlay icon)
    if (showSensor && !isCKP) {
      const sensorW = 20 * scale;
      const sensorH = 30 * scale;
      const sensorX = centerX - sensorW / 2;
      const sensorY = centerY - 95 * scale - sensorH; // Position above the wheel

      // Sensor body
      ctx.fillStyle = '#1f2937'; // gray-800
      ctx.fillRect(sensorX, sensorY, sensorW, sensorH);

      // Sensor tip
      ctx.fillStyle = '#374151'; // gray-700
      ctx.fillRect(sensorX + 5 * scale, sensorY + sensorH, sensorW - 10 * scale, 5 * scale);

      // Wire
      ctx.beginPath();
      ctx.moveTo(centerX, sensorY);
      ctx.lineTo(centerX, sensorY - 20 * scale);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    }
  }, [config, size, rotationAngle, showSensor, isCKP, hoveredToothId, hoveredDisabledToothId]);

  // Helper function to find tooth at given coordinates (for clicking - finds any tooth, enabled or not)
  const findToothAtPosition = useCallback((x: number, y: number, onlyEnabled: boolean = false): number | null => {
    const scale = size / 200;
    const centerX = size / 2;
    const centerY = size / 2;

    // Calculate angle from center
    let angle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;

    // Adjust for rotation - normalize the rotation angle first to handle large values
    const normalizedRotation = ((rotationAngleRef.current % 360) + 360) % 360;
    angle = ((angle - normalizedRotation) % 360 + 360) % 360;

    // Check distance from center
    const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

    // Check if position is within tooth ring
    if (dist >= config.innerRadius * scale && dist <= config.outerRadius * scale) {
      // Find which tooth
      const tooth = config.teeth.find(t => {
        if (onlyEnabled && !t.enabled) return false;
        let start = t.startAngle;
        let end = t.endAngle;

        // Handle wrap around
        if (start > end) {
          return angle >= start || angle <= end;
        }
        return angle >= start && angle <= end;
      });

      return tooth ? tooth.id : null;
    }
    return null;
  }, [size, config.innerRadius, config.outerRadius, config.teeth]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onToothClick) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // For clicking, find any tooth (enabled or disabled) to toggle it
    const toothId = findToothAtPosition(x, y, false);
    if (toothId !== null) {
      onToothClick(toothId);
    }
  }, [onToothClick, findToothAtPosition]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // For hover, highlight enabled teeth
    const enabledToothId = findToothAtPosition(x, y, true);
    setHoveredToothId(enabledToothId);

    // For CKP, also track disabled teeth to show ghost hover
    if (isCKP && !enabledToothId) {
      const anyToothId = findToothAtPosition(x, y, false);
      // Only set if it's a disabled tooth (not found in enabled search but found in any search)
      setHoveredDisabledToothId(anyToothId);
    } else {
      setHoveredDisabledToothId(null);
    }
  }, [findToothAtPosition, isCKP]);

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredToothId(null);
    setHoveredDisabledToothId(null);
  }, []);

  // Calculate sensor icon position based on canvas size
  const sensorIconSize = Math.max(24, size * 0.12);
  const sensorIconTop = (dimensions.height - size) / 2 - sensorIconSize * 0.3;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center min-h-[280px] relative">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        className="cursor-pointer"
        role="img"
        aria-label={isCKP ? "Crankshaft Position Wheel" : "Camshaft Position Wheel"}
      />
      {/* CKP sensor indicator arrow */}
      {showSensor && isCKP && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-blue-600 pointer-events-none"
          style={{ top: sensorIconTop }}
        >
          <ChevronDown size={sensorIconSize} strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
