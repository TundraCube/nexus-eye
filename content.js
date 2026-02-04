console.log("%c [Nexus-Eye] System Live v1.4.3 (The Disciplined Sentinel) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

const FILE_CONTAINER_SELECTORS = '.file, .blob-wrapper, section[aria-labelledby], [data-path], [data-file-path], .react-blob-view-container, .js-file';

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

  // STATE VARIABLES - Fresh for every scan run to prevent leakage between intervals
  let inTemplateBlock = false;
  let lastFileContainer = null;

  codeLines.forEach(line => {
    const text = line.innerText || line.textContent;
    if (!text) return;

    // 1. FILE CONTEXT RESET
    const container = line.closest(FILE_CONTAINER_SELECTORS);
    if (container !== lastFileContainer) {
        inTemplateBlock = false; // Reset state for a new file
        lastFileContainer = container;
    }

    // 2. INCEPTION GUARD
    if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

    // 3. TRIGGERS
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = inTemplateBlock && (
        text.includes('@Component') || 
        text.includes('export class') || 
        (text.trim() === '`') || 
        (text.includes('`') && !text.includes('template:'))
    );

    if (isStart) inTemplateBlock = true;

    // 4. HEURISTIC FALLBACK: If we missed the start tag (virtual scroll), 
    // but the line looks EXACTLY like an Angular template, enable mode.
    // This allows the engine to "re-sync" as you scroll.
    const isTemplateLine = /\[[a-zA-Z0-9.-]+\]=|\([a-zA-Z0-9.-]+\)=|\{\{.*?\}\}/.test(text);
    if (!inTemplateBlock && isTemplateLine) {
        // Only trigger if we aren't in a clearly non-template file (noisy guard)
        const fileName = container?.querySelector('.js-path-name, [data-path], .react-blob-header-filename')?.innerText || '';
        if (fileName.endsWith('.ts') || fileName.endsWith('.html')) {
            inTemplateBlock = true;
        }
    }

    // 5. ACTION
    if (inTemplateBlock && !line.dataset.nexusDone) {
        // Avoid highlighting standard imports
        if (text.trim().startsWith('import ') || text.trim().startsWith('import {')) return;

        const highlighted = highlightEngine(text);
        if (highlighted) {
            line.innerHTML = highlighted;
            line.classList.add('nexus-line-v1', 'nexus-text-base');
            line.dataset.nexusDone = "true";
        }
    }

    if (isEnd) inTemplateBlock = false;
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
