import { InteractiveCMPWheel } from './InteractiveCMPWheel';
import { useSignalStore } from '../../store/signalStore';
import { Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CMPWheelProps {
  wheelNumber: 1 | 2;
}

export function CMPWheel({ wheelNumber }: CMPWheelProps) {
  const {
    cmp1Config,
    cmp2Config,
    toggleCMP1Tooth,
    toggleCMP2Tooth,
    addCMP1Tooth,
    addCMP2Tooth,
    removeCMP1Tooth,
    removeCMP2Tooth,
    removeSpecificCMP1Tooth,
    removeSpecificCMP2Tooth,
    updateCMP1Tooth,
    updateCMP2Tooth,
    rotationAngle,
  } = useSignalStore();

  const config = wheelNumber === 1 ? cmp1Config : cmp2Config;
  const toggleTooth = wheelNumber === 1 ? toggleCMP1Tooth : toggleCMP2Tooth;
  const addTooth = wheelNumber === 1 ? addCMP1Tooth : addCMP2Tooth;
  const removeTooth = wheelNumber === 1 ? removeCMP1Tooth : removeCMP2Tooth;
  const removeSpecificTooth = wheelNumber === 1 ? removeSpecificCMP1Tooth : removeSpecificCMP2Tooth;
  const updateTooth = wheelNumber === 1 ? updateCMP1Tooth : updateCMP2Tooth;

  // CMP rotates at half the speed of CKP
  const cmpRotationAngle = rotationAngle / 2;

  const colorVar = wheelNumber === 1 ? 'var(--color-cmp1)' : 'var(--color-cmp2)';
  const buttonVariant = wheelNumber === 1 ? 'cmp1' : 'cmp2';

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="p-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold" style={{ color: colorVar }}>
            CMP-{wheelNumber}
          </CardTitle>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={buttonVariant}
                  size="icon-sm"
                  onClick={removeTooth}
                  disabled={config.totalTeeth <= 1}
                >
                  <Minus size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove tooth</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={buttonVariant}
                  size="icon-sm"
                  onClick={addTooth}
                >
                  <Plus size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add tooth</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 pt-0 flex-1 min-h-0">
        <div className="flex items-center justify-center w-full h-full">
          <InteractiveCMPWheel
            config={config}
            onToothClick={toggleTooth}
            onToothUpdate={updateTooth}
            onToothRemove={removeSpecificTooth}
            onToothAdd={addTooth}
            rotationAngle={cmpRotationAngle}
            accentColor={wheelNumber === 1 ? 'orange' : 'green'}
          />
        </div>
      </CardContent>
    </Card>
  );
}

