console.log("%c [Nexus-Eye] System Live v1.3.8 (The Disciplined Engine) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;
let state_inTemplateBlock = false;
let state_currentFileContainer = null;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

const highlightEngine = (text) => {
  if (!text) return '';
  const tokens = [];
  let processed = text;

  // PASS 1: Strings (Capture first)
  processed = processed.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (match) => {
    const tokenId = `§§§NEXUS_${tokens.length}§§§`;
    tokens.push(`<span class="nexus-val">${match}</span>`);
    return tokenId;
  });

  // PASS 2: Escape structural HTML characters
  processed = processed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // PASS 3: Apply structural patterns
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

  // Critical: We must maintain the state globally across the loop to handle virtual scroll
  // but reset it correctly at boundaries.

  codeLines.forEach(line => {
    const text = line.innerText || line.textContent;
    if (!text) return;

    // 1. FILE CONTEXT RESET
    // We use a broader check to find the file header/boundary
    const fileContainer = line.closest('.file, .blob-wrapper, [data-path], [data-file-path], section[aria-labelledby]');
    if (fileContainer !== state_currentFileContainer) {
        state_inTemplateBlock = false; 
        state_currentFileContainer = fileContainer;
    }

    // 2. INCEPTION GUARD
    if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

    // 3. STATE MACHINE TRIGGERS (Must run for EVERY line, even if nexusDone)
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = state_inTemplateBlock && (text.includes('@Component') || text.includes('export class') || (text.trim() === '`') || (text.includes('`') && !text.includes('template:')));

    if (isStart) state_inTemplateBlock = true;

    // 4. ACTION: Only highlight if state is ACTIVE and line isn't already DONE
    if (state_inTemplateBlock && !line.dataset.nexusDone) {
        // Noise guard for imports
        if (text.trim().startsWith('import ') || text.trim().startsWith('import {')) return;

        const highlighted = highlightEngine(text);
        if (highlighted) {
            line.innerHTML = highlighted;
            line.classList.add('nexus-line-v1', 'nexus-text-base');
            line.dataset.nexusDone = "true";
        }
    }

    // Handle end of block
    if (isEnd) state_inTemplateBlock = false;
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
