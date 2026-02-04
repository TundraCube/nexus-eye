console.log("%c [Nexus-Eye] System Live v1.4.7 (The Atomic Scoper) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

// Targeted wrappers that uniquely identify a file in PR or Blob views
const FILE_CONTAINER_SELECTORS = [
  '.file', 
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

  // PASS 1: Strings
  processed = processed.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (match) => {
    const tokenId = `§§§NEXUS_${tokens.length}§§§`;
    tokens.push(`<span class="nexus-val">${match}</span>`);
    return tokenId;
  });

  // PASS 2: Escape
  processed = processed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // PASS 3: Patterns
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

  // PASS 4: Reassemble
  let finalHtml = processed;
  tokens.forEach((tokenHtml, i) => {
    const tokenId = `§§§NEXUS_${i}§§§`;
    finalHtml = finalHtml.split(tokenId).join(tokenHtml);
  });

  return finalHtml;
};

const nexusScanner = () => {
  if (!isEnabled) return;

  const codeLines = document.querySelectorAll(LINE_SELECTORS.join(', '));
  if (codeLines.length === 0) return;

  // These must be reset at the start of every scan pass!
  let currentFileInTemplate = false;
  let currentFileContainer = null;

  codeLines.forEach(line => {
    const text = line.innerText || line.textContent;
    if (!text) return;

    // 1. FILE CONTEXT GUARD
    // Find the nearest file container. If it's different from the last line's container,
    // we have crossed a file boundary and MUST reset the template state.
    const container = line.closest(FILE_CONTAINER_SELECTORS.join(', '));
    if (container !== currentFileContainer) {
        currentFileInTemplate = false;
        currentFileContainer = container;
    }

    // 2. LOGIC WALL GUARD
    // If we hit imports or exports, we are definitely NOT in a template block.
    const trimmed = text.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('import {') || trimmed.startsWith('export ')) {
        currentFileInTemplate = false;
        return; // Don't highlight imports
    }

    // 3. INCEPTION GUARD
    if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

    // 4. STATE TRIGGERS
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = currentFileInTemplate && (
        text.includes('@Component') || 
        text.includes('export class') || 
        (text.trim() === '`') || 
        (text.includes('`') && !text.includes('template:'))
    );

    if (isStart) currentFileInTemplate = true;

    // 5. ACTION (Only highlight if not already done)
    if (currentFileInTemplate && !line.dataset.nexusDone) {
        const highlighted = highlightEngine(text);
        if (highlighted) {
            line.innerHTML = highlighted;
            line.classList.add('nexus-line-v1', 'nexus-text-base');
            line.dataset.nexusDone = "true";
        }
    }

    // Process end transition
    if (isEnd) currentFileInTemplate = false;
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
