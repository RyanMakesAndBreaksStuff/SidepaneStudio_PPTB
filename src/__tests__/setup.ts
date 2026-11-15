(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does not implement scrollIntoView; ConfigurePanel calls it when the sentence strip jumps to a section.
Element.prototype.scrollIntoView = function scrollIntoView() {};
