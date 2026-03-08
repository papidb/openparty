type ContentScriptDefinition = {
  matches: string[];
  main: () => void;
};

declare function defineContentScript(definition: ContentScriptDefinition): unknown;

declare const chrome: {
  runtime: {
    sendMessage: (message: unknown) => void;
    onMessage: {
      addListener: (
        callback: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => void
      ) => void;
    };
  };
};
