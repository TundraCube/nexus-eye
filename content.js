console.log("%c [Nexus-Eye] System Live v1.5.2 (Deep Isolation) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;
const FILE_STATE_MAP = new Map();

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

// Ultra-broad selectors for identifying the parent "File" unit
const CONTAINER_SELECTORS = [
  'section[aria-labelledby]', // 2026 Improved View
  '.file',                      // Classic PR View
  '.js-file',
  '.blob-wrapper', 
  '.react-blob-view-container',
  '.js-file-contents',
  '[data-details-container-group="file"]'
];

const highlightEngine = (text) => {
  if (!text) return '';
  const tokens = [];
  let processed = text;

  processed = processed.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (match) => {
    const tokenId = `§§§NEXUS_${tokens.length}§§§`;
    tokens.push(`<span class="nexus-val">${match}</span>`);
    return tokenId;
  });

  processed = processed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const patterns = [
    { regex: /(&lt;\/?[a-zA-Z0-9-]+)/g, class: 'nexus-tag' },
    { regex: /(\/\s*&gt;|&gt;)(?!--&gt;)/g, class: 'nexus-tag' },
    { regex: /(&lt;!--.*?--&gt;)/g, class: 'nexus-comment' },
    { regex: /(@)(if|else if|else|defer|placeholder|loading|error|switch|case|default|for|empty)\b/g, class: 'nexus-control' },
    { regex: /((?<=@if|@for|@switch|@defer|@loading|@placeholder|@error)\s*)(\()/g, class: 'nexus-control' },
    { regex: /(\)\s*\{)/g, class: 'nexus-control' },
    { regex: /([\{\}])/g, class: 'nexus-control' },
    { regex: /\b(as|let|track|of)\b/g, class: 'nexus-control' },
    { regex: /((?:\[\(?|(?<!\w)\()[a-zA-Z0-9.-]+(?:\)?\]|\))(?==))/g, class: 'nexus-binding' },
    { regex: /\b([a-zA-Z0-9.-]+)=/g, class: 'nexus-attr' },
    { regex: /(\{\{.*?\}\})/g, class: 'nexus-signal' },
    { regex: /\b(inject|signal|computed|effect|toSignal|input|output|resource)\b/g, class: 'nexus-signal' }
  ];

  patterns.forEach((p) => {
    processed = processed.replace(p.regex, (match) => {
      const tokenId = `§§§NEXUS_${tokens.length}§§§`;
      tokens.push(`<span class="${p.class}">${match}</span>`);
      return tokenId;
    });
  });

  let finalHtml = processed;
  tokens.forEach((tokenHtml, i) => {
    const tokenId = `§§§NEXUS_${i}§§§`;
    finalHtml = finalHtml.split(tokenId).join(tokenHtml);
  });

  return finalHtml;
};

const nexusScanner = () => {
  if (!isEnabled) return;

  const allLines = document.querySelectorAll(LINE_SELECTORS.join(', '));
  if (allLines.length === 0) return;

  allLines.forEach(line => {
    // 1. IMPROVED FILE ID DISCOVERY
    const container = line.closest(CONTAINER_SELECTORS.join(', '));
    
    // If no container found, we might be in a view where the line is a direct child of a list.
    // We try to find any unique ancestor.
    const fileId = container?.getAttribute('data-file-path') || 
                   container?.getAttribute('data-path') || 
                   container?.getAttribute('aria-labelledby') || 
                   container?.id || 
                   'global-fallback';

    if (!FILE_STATE_MAP.has(fileId)) {
      FILE_STATE_MAP.set(fileId, { inTemplate: false });
    }
    const state = FILE_STATE_MAP.get(fileId);

    const text = line.innerText || line.textContent;
    if (!text) return;

    // 2. DETECTION
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = state.inTemplate && (
        text.includes('@Component') || 
        text.includes('export class') || 
        (text.trim() === '`') || 
        (text.includes('`') && !text.includes('template:'))
    );
    const isLogicWall = /^(import|export|const|let|var)\b/.test(text.trim());

    // 3. DIAGNOSTICS (If it still says 'global-fallback', we have a selector issue)
    if (isStart || isEnd || isLogicWall) {
        console.log(`[Nexus-Eye] State Transition in ${fileId}: isStart=${isStart}, isEnd=${isEnd}, isLogicWall=${isLogicWall}`);
    }

    // 4. STATE MACHINE
    if (isStart) state.inTemplate = true;
    if (isLogicWall) state.inTemplate = false;

    // 5. ACTION
    if (state.inTemplate && !line.dataset.nexusDone) {
        if (isLogicWall) return;

        const highlighted = highlightEngine(text);
        if (highlighted) {
            line.innerHTML = highlighted;
            line.classList.add('nexus-line-v1', 'nexus-text-base');
            line.dataset.nexusDone = "true";
        }
    }

    if (isEnd) state.inTemplate = false;
  });
};

chrome.storage.local.get(["enabled"], (result) => {
  isEnabled = result.enabled !== false;
  if (isEnabled) nexusScanner();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "toggle") {
    isEnabled = message.enabled;
    if (!isEnabled) location.reload(); else nexusScanner();
  }
});

setInterval(nexusScanner, 1000);
document.addEventListener('turbo:render', nexusScanner);

const observer = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
        nexusScanner();
    }
});
observer.observe(document.body, { childList: true, subtree: true });
