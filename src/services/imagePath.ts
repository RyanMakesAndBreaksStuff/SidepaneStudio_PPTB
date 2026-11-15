const SAFE_RELATIVE_IMAGE_PATH = /^[A-Za-z0-9_\-./]+$/;

export function isSafeRelativeImagePath(value: string): boolean {
  if (!SAFE_RELATIVE_IMAGE_PATH.test(value) || value.includes(':') || value.startsWith('/')) return false;
  return !value.split('/').includes('..');
}

export function getSafePreviewImageSrc(imageSrc: string): string | null {
  const trimmed = imageSrc.trim();
  return isSafeRelativeImagePath(trimmed) && !trimmed.startsWith('//') ? trimmed : null;
}
