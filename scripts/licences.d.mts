export interface ProductionPackage {
  name: string;
  version: string;
  licence: string;
  dir: string;
}

export const ALLOWED_LICENCES: Set<string>;
export function isAllowedLicence(expression: string): boolean;
export function collectProductionPackages(root: string): { packages: ProductionPackage[]; missing: string[] };
export function licenceTexts(dir: string): { file: string; text: string }[];
export function licenceDocument(packages: readonly ProductionPackage[]): string;
