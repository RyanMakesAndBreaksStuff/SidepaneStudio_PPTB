const MIN_CONFIG_WIDTH = 300;
const MID_CONFIG_WIDTH = 1000;
const MAX_CONFIG_WIDTH = 1200;
const MIN_PREVIEW_WIDTH = 120;
const MID_PREVIEW_WIDTH = 270;
const MAX_PREVIEW_WIDTH = 300;

export function getPreviewPaneWidth(configWidth: number): number {
  const clamped = Math.min(MAX_CONFIG_WIDTH, Math.max(MIN_CONFIG_WIDTH, configWidth));
  if (clamped <= MID_CONFIG_WIDTH) {
    return Math.round(
      MIN_PREVIEW_WIDTH +
      ((clamped - MIN_CONFIG_WIDTH) / (MID_CONFIG_WIDTH - MIN_CONFIG_WIDTH)) *
        (MID_PREVIEW_WIDTH - MIN_PREVIEW_WIDTH)
    );
  }

  return Math.round(
    MID_PREVIEW_WIDTH +
    ((clamped - MID_CONFIG_WIDTH) / (MAX_CONFIG_WIDTH - MID_CONFIG_WIDTH)) *
      (MAX_PREVIEW_WIDTH - MID_PREVIEW_WIDTH)
  );
}

export function getSafePreviewImageSrc(imageSrc: string): string | null {
  const trimmed = imageSrc.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http:') ||
    lower.startsWith('https:') ||
    lower.startsWith('//') ||
    lower.startsWith('data:') ||
    lower.startsWith('javascript:')
  ) {
    return null;
  }

  return trimmed;
}
