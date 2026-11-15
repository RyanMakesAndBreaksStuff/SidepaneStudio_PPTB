/**
 * Shared runtime constants for Side Pane Studio.
 */

/** Leaf file name of the shared runtime; used for the download and the deployed-name match. */
export const RUNTIME_FILE_NAME = 'sidepane.runtime.js';

/** Any publisher prefix is accepted: the deployed web resource name must end with this. */
export const RUNTIME_WEB_RESOURCE_SUFFIX = '/scripts/' + RUNTIME_FILE_NAME;

/** Recommended full web resource name, shown as display text only. */
export const RUNTIME_WEB_RESOURCE_NAME = 'spstudio_' + RUNTIME_WEB_RESOURCE_SUFFIX;
