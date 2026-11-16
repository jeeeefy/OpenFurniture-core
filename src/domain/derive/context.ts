import type { DesignDocument, Material, MaterialGroup } from '../document/types';
import type { Dimensions, ResolvedLayout } from './model';

export interface DeriveContext {
  doc: DesignDocument;
  dims: Dimensions;
  layout: ResolvedLayout;
  material: (group: MaterialGroup) => Material;
}
