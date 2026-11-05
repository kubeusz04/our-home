import type { Apartment } from "../model/types";
export const collaborationBridge: {
  guard?: (before: Apartment, after: Apartment) => boolean;
  undo?: () => void;
  redo?: () => void;
  begin?: (key: string) => boolean;
  end?: () => void;
  cursor?: (point: { x: number; z: number } | null) => void;
} = {};
