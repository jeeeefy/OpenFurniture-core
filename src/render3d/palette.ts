import type { PartRole } from '@/domain';

export const BACKGROUND = 0xf4f1ec;
export const EDGE_COLOUR = 0x5a4632;
export const SELECTED_EDGE_COLOUR = 0x1d4ed8;
export const SELECTED_TINT = 0x9cc3ff;
export const HOVER_TINT = 0xffe7a3;
export const ENVELOPE_COLOUR = 0xb42318;
export const RAIL_COLOUR = 0x8a8f96;
/** Step images (T-023): new parts amber, assembled parts light grey; distinguishable in greyscale print. */
export const STEP_NEW = 0xf59e0b;
export const STEP_ASSEMBLED = 0xd4d4d4;

const ROLE_COLOURS: Record<PartRole, number> = {
  'side-left': 0xdcc199,
  'side-right': 0xdcc199,
  top: 0xdcc199,
  bottom: 0xdcc199,
  divider: 0xd6b98e,
  'fixed-shelf': 0xe2c8a0,
  'adjustable-shelf': 0xe8d3b0,
  back: 0xcfc8bc,
  'plinth-side': 0xa98a63,
  'plinth-front': 0xa98a63,
  'plinth-back': 0xa98a63,
  door: 0xefdcb8,
  'drawer-front': 0xefdcb8,
  'drawer-side': 0xcdb187,
  'drawer-inner-front': 0xcdb187,
  'drawer-inner-back': 0xcdb187,
  'drawer-bottom': 0xc4a87c,
};

export function roleColour(role: PartRole): number {
  return ROLE_COLOURS[role];
}

export const FRONT_ROLES: ReadonlySet<PartRole> = new Set(['door', 'drawer-front']);
