export async function copyText(text: string): Promise<void> {
  const utils = window.toolboxAPI?.utils;
  if (utils?.copyToClipboard) {
    await utils.copyToClipboard(text);
    return;
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable.');
  }
  await navigator.clipboard.writeText(text);
}
