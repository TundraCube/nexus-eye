console.log("%c [Nexus-Eye] System Live v1.4.6 (The True Path) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

// GLOBAL STATE: Persists between scan intervals using File Path as the key
// This survives virtual scrolling and DOM recycling.
const FILE_STATE_MAP = new Map();

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

// Broad selectors to find the unique ID of the file we are currently scanning
const CONTAINER_SELECTORS = '.file, .blob-wrapper, section[aria-labelledby], [data-path], [data-file-path], .react-blob-view-container';

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

  // We process EVERY line on the page in order.
  // We determine the file context for each line dynamically.
  
  codeLines.forEach(line => {
    const text = line.innerText || line.textContent;
    if (!text) return;

    // 1. EXTRACT FILE ID (The Path)
    // We look for data-path, aria-labelledby, or any parent that identifies the file.
    const container = line.closest(CONTAINER_SELECTORS);
    const fileId = container?.getAttribute('data-path') || 
                   container?.getAttribute('data-file-path') || 
                   container?.getAttribute('aria-labelledby') || 
                   'global-context';

    // 2. INITIALIZE STATE for this specific file path
    if (!FILE_STATE_MAP.has(fileId)) {
        FILE_STATE_MAP.set(fileId, { inTemplate: false });
    }
    const state = FILE_STATE_MAP.get(fileId);

    // 3. INCEPTION GUARD
    if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

    // 4. TRIGGERS (Always run to keep the machine synced across scrolls)
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = state.inTemplate && (
        text.includes('@Component') || 
        text.includes('export class') || 
        (text.trim() === '`') || 
        (text.includes('`') && !text.includes('template:'))
    );
    
    // Logic Wall: Imports kill the template state immediately
    const isLogicWall = /^(import|export)\b/.test(text.trim());

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
