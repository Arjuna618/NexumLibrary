export interface PanelsData {
  tool: string;
  folds: Record<string, boolean>;
  values: Record<string, unknown>;
  scroll: Record<string, number>;
}
