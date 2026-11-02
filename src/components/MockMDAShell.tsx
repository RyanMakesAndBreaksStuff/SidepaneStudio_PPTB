import * as React from 'react';
import { PaneConfig, TargetConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { NativeMdaFrame } from './NativeMdaFrame';
import { MockNativeForm } from './MockNativeForm';

export interface MockMDAShellProps {
  pane: PaneConfig;
  /** Pane configuration target — drives PaneOverlay. */
  target: TargetConfig;
  validation: ValidationResult;
}

/**
 * Mock preview: a static "Account" host form with the live PaneOverlay docked on the right.
 * The host form NEVER changes with config — it's just there to give the pane a believable home.
 * Only the PaneOverlay reflects live config (title/width/header/canClose/isSelected).
 */
export function MockMDAShell({ pane, target, validation }: MockMDAShellProps): React.ReactElement {
  return (
    <NativeMdaFrame
      pane={pane}
      paneTarget={target}
      validation={validation}
      variant={{ kind: 'mock' }}
    >
      <MockNativeForm />
    </NativeMdaFrame>
  );
}
