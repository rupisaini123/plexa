import { Tooltip } from 'react-tooltip';

export const TOOLTIP_ID = 'plexa-tooltip';

type TooltipPlace = 'top' | 'bottom' | 'left' | 'right';

export function tooltipProps(label: string, place?: TooltipPlace) {
  return {
    'data-tooltip-id': TOOLTIP_ID,
    'data-tooltip-content': label,
    ...(place ? { 'data-tooltip-place': place } : {}),
  } as const;
}

export function AppTooltip() {
  return (
    <Tooltip
      id={TOOLTIP_ID}
      delayShow={200}
      className="plexa-tooltip"
      classNameArrow="plexa-tooltip-arrow"
      arrowSize={6}
      offset={6}
      opacity={1}
    />
  );
}
