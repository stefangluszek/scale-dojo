import {
  SCALE_DEFINITIONS,
  type PitchClass,
  type ScaleId,
} from '../../domain/music/scales';
import { integerIn, isRecord } from './local';

export interface Settings {
  root: PitchClass;
  scaleId: ScaleId;
  tempo: number;
  view: 'zen' | 'full';
}

export const SETTINGS_KEY = 'scale-dojo.settings';
export const DEFAULT_SETTINGS: Settings = {
  root: 0,
  scaleId: 'major-pentatonic',
  tempo: 90,
  view: 'zen',
};

export function isScaleId(value: unknown): value is ScaleId {
  return SCALE_DEFINITIONS.some((scale) => scale.id === value);
}

export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    integerIn(value.root, 0, 11) &&
    isScaleId(value.scaleId) &&
    integerIn(value.tempo, 40, 240) &&
    (value.view === 'zen' || value.view === 'full')
  );
}
