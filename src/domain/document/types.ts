import type { z } from 'zod';
import type {
  baseSchema,
  carcassSchema,
  clothesRailProfileSchema,
  columnSchema,
  constructionSettingsSchema,
  designDocumentSchema,
  drawerSchema,
  frontSchema,
  handleProfileSchema,
  hardwareProfilesSchema,
  hingeProfileSchema,
  interiorSchema,
  materialGroupSchema,
  materialSchema,
  screwSpecSchema,
  sectionSchema,
  shelfPinProfileSchema,
  sizeSpecSchema,
  slideProfileSchema,
} from './schema';

export type SizeSpec = z.infer<typeof sizeSpecSchema>;
export type Base = z.infer<typeof baseSchema>;
export type MaterialGroup = z.infer<typeof materialGroupSchema>;
export type Carcass = z.infer<typeof carcassSchema>;
export type Interior = z.infer<typeof interiorSchema>;
export type Drawer = z.infer<typeof drawerSchema>;
export type Front = z.infer<typeof frontSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Material = z.infer<typeof materialSchema>;
export type ScrewSpec = z.infer<typeof screwSpecSchema>;
export type HingeProfile = z.infer<typeof hingeProfileSchema>;
export type SlideProfile = z.infer<typeof slideProfileSchema>;
export type ShelfPinProfile = z.infer<typeof shelfPinProfileSchema>;
export type HandleProfile = z.infer<typeof handleProfileSchema>;
export type ClothesRailProfile = z.infer<typeof clothesRailProfileSchema>;
export type HardwareProfiles = z.infer<typeof hardwareProfilesSchema>;
export type ConstructionSettings = z.infer<typeof constructionSettingsSchema>;
export type DesignDocument = z.infer<typeof designDocumentSchema>;
