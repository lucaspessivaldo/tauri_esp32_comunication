import { useCallback, useRef, useEffect } from 'react';
import type { Tooth } from '../../types';
import { ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ToothListEditorProps {
  teeth: Tooth[];
  highlightedToothId: number | null;
  onToothHover: (toothId: number | null) => void;
  onToothClick: (toothId: number) => void;
  onToothRemove?: (toothId: number) => void;
  onToothUpdate?: (toothId: number, startAngle: number, endAngle: number) => void;
  maxHeight?: string;
}

export function ToothListEditor({
  teeth,
  highlightedToothId,
  onToothHover,
  onToothClick,
  onToothRemove,
  onToothUpdate,
  maxHeight = '200px',
}: ToothListEditorProps) {
  const listRef = useRef<HTMLTableSectionElement>(null);
  const itemRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // Auto-scroll to highlighted tooth
  useEffect(() => {
    if (highlightedToothId !== null && listRef.current) {
      const itemEl = itemRefs.current.get(highlightedToothId);
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedToothId]);

  const formatAngle = (angle: number): string => {
    return `${angle.toFixed(1)}°`;
  };

  const handleAngleChange = useCallback((tooth: Tooth, field: 'start' | 'end', value: string) => {
    if (!onToothUpdate) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const normalizedValue = ((numValue % 360) + 360) % 360;

    if (field === 'start') {
      onToothUpdate(tooth.id, normalizedValue, tooth.endAngle);
    } else {
      onToothUpdate(tooth.id, tooth.startAngle, normalizedValue);
    }
  }, [onToothUpdate]);

  const canRemove = teeth.length > 1;

  return (
    <div className="flex flex-col rounded-md border bg-card">
      <ScrollArea style={{ height: maxHeight }}>
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead className="w-10 text-center h-8 text-xs">#</TableHead>
              <TableHead className="h-8 text-xs">Start</TableHead>
              <TableHead className="h-8 text-xs">End</TableHead>
              <TableHead className="w-20 text-center h-8 text-xs">Status</TableHead>
              {onToothRemove && <TableHead className="w-10 h-8"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody ref={listRef}>
            {teeth.map((tooth, index) => (
              <TableRow
                key={tooth.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(tooth.id, el);
                  else itemRefs.current.delete(tooth.id);
                }}
                className={cn(
                  'cursor-pointer bg-card',
                  highlightedToothId === tooth.id && 'bg-ckp/10',
                  !tooth.enabled && 'opacity-50'
                )}
                onMouseEnter={() => onToothHover(tooth.id)}
                onMouseLeave={() => onToothHover(null)}
                onClick={() => onToothClick(tooth.id)}
              >
                {/* Tooth number */}
                <TableCell className="text-center font-mono text-muted-foreground p-1 text-xs">
                  {index + 1}
                </TableCell>

                {/* Start angle */}
                <TableCell className="p-1">
                  {onToothUpdate ? (
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={360}
                      value={tooth.startAngle.toFixed(1)}
                      onChange={(e) => handleAngleChange(tooth, 'start', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 px-1 text-xs"
                      disabled={!tooth.enabled}
                    />
                  ) : (
                    <span className="text-xs">{formatAngle(tooth.startAngle)}</span>
                  )}
                </TableCell>

                {/* End angle */}
                <TableCell className="p-1">
                  {onToothUpdate ? (
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={360}
                      value={tooth.endAngle.toFixed(1)}
                      onChange={(e) => handleAngleChange(tooth, 'end', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 px-1 text-xs"
                      disabled={!tooth.enabled}
                    />
                  ) : (
                    <span className="text-xs">{formatAngle(tooth.endAngle)}</span>
                  )}
                </TableCell>

                {/* Enable/Disable toggle */}
                <TableCell className="text-center p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToothClick(tooth.id);
                    }}
                    className="h-6 gap-1 px-2"
                  >
                    {tooth.enabled ? (
                      <>
                        <ToggleRight size={14} className="text-green-600" />
                        <span className="text-green-600 text-xs">On</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={14} className="text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Off</span>
                      </>
                    )}
                  </Button>
                </TableCell>

                {/* Remove button */}
                {onToothRemove && (
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canRemove) onToothRemove(tooth.id);
                      }}
                      disabled={!canRemove}
                      className="h-6 w-6 hover:bg-destructive/10"
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="sticky bottom-0 bg-muted">
            <TableRow>
              <TableCell colSpan={onToothRemove ? 5 : 4} className="text-xs py-1.5">
                {teeth.length} teeth • {teeth.filter(t => t.enabled).length} enabled
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </ScrollArea>
    </div>
  );
}
