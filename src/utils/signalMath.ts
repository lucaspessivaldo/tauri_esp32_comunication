import type { Tooth, SignalPoint, GearWheelConfig } from '../types';

// Generate teeth for a gear wheel
export function generateTeeth(
  totalTeeth: number,
  missingTeeth: number[] = [],
  gapRatio: number = 0.2
): Tooth[] {
  const teeth: Tooth[] = [];
  const toothAngle = 360 / totalTeeth;
  const clampedGapRatio = Math.min(Math.max(gapRatio, 0), 0.9);
  const gapAngle = toothAngle * clampedGapRatio;

  for (let i = 1; i <= totalTeeth; i++) {
    const startAngle = (i - 1) * toothAngle + gapAngle / 2;
    const endAngle = i * toothAngle - gapAngle / 2;

    teeth.push({
      id: i,
      startAngle,
      endAngle,
      enabled: !missingTeeth.includes(i),
    });
  }

  return teeth;
}

// Generate CMP teeth (wider segments)
export function generateCMPTeeth(segments: number): Tooth[] {
  const teeth: Tooth[] = [];
  const segmentAngle = 360 / segments;
  const gapAngle = segmentAngle * 0.1; // 10% gap

  for (let i = 0; i < segments; i++) {
    const startAngle = i * segmentAngle + gapAngle / 2;
    const endAngle = (i + 0.5) * segmentAngle - gapAngle / 2; // Half width

    teeth.push({
      id: i + 1,
      startAngle,
      endAngle,
      enabled: true,
    });
  }

  return teeth;
}

// Generate signal from gear wheel configuration
// For CKP: wheel rotates twice per 720° cycle (angle % 360)
// For CMP: wheel rotates once per 720° cycle (angle / 2 to map 720° to 360°)
export function generateSignal(
  config: GearWheelConfig,
  resolution: number = 720,
  amplitude: number = 100,
  offset: number = 0,
  isCMP: boolean = false // CMP rotates at half speed of CKP
): SignalPoint[] {
  const signal: SignalPoint[] = [];
  const step = 720 / resolution;

  for (let angle = 0; angle <= 720; angle += step) {
    // CKP: repeats every 360° (crankshaft does 2 rotations per cycle)
    // CMP: maps 720° to 360° (camshaft does 1 rotation per cycle)
    const normalizedAngle = isCMP ? (angle / 2) % 360 : angle % 360;
    let value = offset;

    // Check if any tooth covers this angle
    for (const tooth of config.teeth) {
      if (tooth.enabled) {
        let start = tooth.startAngle;
        let end = tooth.endAngle;

        // Handle wraparound
        if (end < start) {
          if (normalizedAngle >= start || normalizedAngle <= end) {
            value = amplitude + offset;
            break;
          }
        } else {
          if (normalizedAngle >= start && normalizedAngle <= end) {
            value = amplitude + offset;
            break;
          }
        }
      }
    }

    signal.push({ angle, value });
  }

  return signal;
}

// Generate CKP signal with proper 60-2 pattern visualization
// CKP wheel rotates twice per 720° engine cycle
// Use high resolution (1440 = 2 points per degree) to capture all teeth properly
export function generateCKPSignal(
  config: GearWheelConfig,
  resolution: number = 1440
): SignalPoint[] {
  return generateSignal(config, resolution, 15, 0, false);
}

// Generate CMP signal 
// CMP wheel rotates once per 720° engine cycle (half speed of CKP)
export function generateCMPSignal(
  config: GearWheelConfig,
  resolution: number = 1440,
  offset: number = 0
): SignalPoint[] {
  return generateSignal(config, resolution, 15, offset, true);
}

/**
 * Generate an inductive (sine-like) signal from a square wave signal.
 * Simulates how an inductive CKP sensor produces voltage from magnetic flux changes.
 * 
 * Physics:
 * - Inductive sensors generate voltage proportional to the rate of change of magnetic flux
 * - When a tooth approaches (leading edge): positive voltage spike
 * - When a tooth leaves (trailing edge): negative voltage spike
 * - During constant state (tooth or gap): voltage returns to zero baseline
 * 
 * Special handling for missing teeth:
 * - Missing teeth create longer gaps, resulting in larger amplitude spikes
 *   at the boundaries where the gap meets normal teeth
 * 
 * @param squareSignal - The original square wave signal
 * @param baseAmplitude - Base amplitude for normal teeth transitions
 * @param missingToothAmplitude - Amplitude multiplier for missing tooth gap transitions (default 1.5x)
 * @param transitionWidth - Width of the sine transition in degrees (default 3°)
 * @returns SignalPoint[] - The inductive sine-like signal centered around 0
 */
export function generateInductiveSineSignal(
  squareSignal: SignalPoint[],
  baseAmplitude: number = 15,
  missingToothAmplitude: number = 1.5,
  transitionWidth: number = 3
): SignalPoint[] {
  if (squareSignal.length < 2) return squareSignal;

  const sineSignal: SignalPoint[] = [];
  const halfWidth = transitionWidth / 2;

  // First pass: detect transitions (edges) in the square wave
  interface Edge {
    angle: number;
    type: 'rising' | 'falling';
    gapDuration: number; // duration of the preceding gap (for falling edges) or following gap (for rising edges)
  }
  const edges: Edge[] = [];

  for (let i = 1; i < squareSignal.length; i++) {
    const prev = squareSignal[i - 1];
    const curr = squareSignal[i];

    if (prev.value !== curr.value) {
      // Found an edge
      const isRising = curr.value > prev.value;
      const angle = curr.angle;

      edges.push({
        angle,
        type: isRising ? 'rising' : 'falling',
        gapDuration: 0, // will calculate below
      });
    }
  }

  // Calculate gap durations to detect missing teeth (larger gaps)
  // A missing tooth gap is typically longer than normal gaps
  for (let i = 0; i < edges.length; i++) {
    const currentEdge = edges[i];
    const nextEdge = edges[(i + 1) % edges.length];

    let gapDuration: number;
    if (nextEdge.angle > currentEdge.angle) {
      gapDuration = nextEdge.angle - currentEdge.angle;
    } else {
      gapDuration = (720 - currentEdge.angle) + nextEdge.angle;
    }

    currentEdge.gapDuration = gapDuration;
  }

  // Calculate average gap duration to detect missing teeth
  const avgGap = edges.length > 0
    ? edges.reduce((sum, e) => sum + e.gapDuration, 0) / edges.length
    : 6;
  const missingToothThreshold = avgGap * 1.5; // Gaps 1.5x larger than average indicate missing teeth

  // Generate sine signal with smooth transitions at edges
  for (const point of squareSignal) {
    const angle = point.angle;
    let value = 0; // Default to baseline (zero voltage when no flux change)

    // Check proximity to each edge
    for (const edge of edges) {
      // Calculate distance to this edge (handling wraparound)
      let distance = angle - edge.angle;
      if (distance > 360) distance -= 720;
      if (distance < -360) distance += 720;

      // Check if we're within the transition zone of this edge
      if (Math.abs(distance) <= halfWidth) {
        // Determine amplitude based on whether this is near a missing tooth gap
        const isMissingToothEdge = edge.gapDuration > missingToothThreshold;
        const amplitude = isMissingToothEdge
          ? baseAmplitude * missingToothAmplitude
          : baseAmplitude;

        // Generate sine wave transition
        // Normalized position in transition: -1 to 1
        const t = distance / halfWidth;

        // Sine wave shape: peaks at center of transition
        // Rising edge: positive spike (approaching tooth)
        // Falling edge: negative spike (leaving tooth)
        const sineValue = Math.cos(t * Math.PI / 2);

        if (edge.type === 'rising') {
          value += amplitude * sineValue;
        } else {
          value -= amplitude * sineValue;
        }
      }
    }

    sineSignal.push({ angle, value });
  }

  return sineSignal;
}
