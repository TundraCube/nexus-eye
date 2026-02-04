console.log("%c [Nexus-Eye] System Live v1.5.0 (The Path Sentinel) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

const CONTAINER_SELECTORS = [
  '.file', 
  '.js-file',
  '.blob-wrapper', 
  'section[aria-labelledby]', 
  '[data-path]', 
  '[data-file-path]', 
  '.react-blob-view-container'
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
    { regex: /(&lt;!--.*?--&gt;)/g, class: 'nexus-comment' },
    { regex: /(@)(if|else if|else|defer|placeholder|loading|error|switch|case|default|for|empty)\b/g, class: 'nexus-control' },
    { regex: /((?<=@if|@for|@switch|@defer|@loading|@placeholder|@error)\s*)(\()/g, class: 'nexus-control' },
    { regex: /(\)\s*\{)/g, class: 'nexus-control' },
    { regex: /([\{\}])/g, class: 'nexus-control' },
    { regex: /\b(as|let|track|of)\b/g, class: 'nexus-control' },
    { regex: /(&lt;\/?[a-zA-Z0-9-]+)/g, class: 'nexus-tag' },
    { regex: /(\/\s*&gt;|&gt;)(?!--&gt;)/g, class: 'nexus-tag' },
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

  // 1. Path-Based Isolation: Key is the actual filename string
  const fileStates = new Map();

  allLines.forEach(line => {
    const text = line.innerText || line.textContent;
    if (!text) return;

    // 2. Identify the unique file ID for this line
    const container = line.closest(CONTAINER_SELECTORS.join(', '));
    // Try to find a unique string ID: data-path, aria-labelledby, or just a unique element ref
    const fileId = container?.getAttribute('data-file-path') || 
                   container?.getAttribute('data-path') || 
                   container?.getAttribute('aria-labelledby') || 
                   container || 
                   'global';

    if (!fileStates.has(fileId)) {
      fileStates.set(fileId, { inTemplate: false });
    }
    const state = fileStates.get(fileId);

    // 3. LOGIC BOUNDARY: Force reset on imports/exports
    const trimmed = text.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('import {') || trimmed.startsWith('export ')) {
        state.inTemplate = false;
        return;
    }

    // 4. INCEPTION GUARD
    if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

    // 5. TRIGGERS
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = state.inTemplate && (
        text.includes('@Component') || 
        text.includes('export class') || 
        (text.trim() === '`') || 
        (text.includes('`') && !text.includes('template:'))
    );

    if (isStart) state.inTemplate = true;

    // 6. ACTION
    if (state.inTemplate && !line.dataset.nexusDone) {
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
