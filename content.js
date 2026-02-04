console.log("%c [Nexus-Eye] System Live v1.3.6 (The Absolute Vision) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;
let lastFile = null;
let inTemplateBlock = false;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

const highlightEngine = (text) => {
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

  const codeLines = document.querySelectorAll(LINE_SELECTORS.join(', '));
  if (codeLines.length === 0) return;

  codeLines.forEach(line => {
    // 1. FILE CONTEXT GUARD: Detect if we've moved to a new file
    // GitHub uses these classes/attributes to separate files in PRs and Blobs
    const fileContainer = line.closest('.file, .blob-wrapper, [data-path], [data-file-path], section[aria-labelledby]');
    
    if (fileContainer !== lastFile) {
        inTemplateBlock = false; // RESET state for new file
        lastFile = fileContainer;
    }

    const text = line.innerText;

    // 2. INCEPTION GUARD
    if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

    // 3. STATE MACHINE TRIGGERS
    const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
    const isEnd = inTemplateBlock && (text.includes('@Component') || text.includes('export class') || (text.includes('`') && !text.includes('template:')));
    const isDefinitiveTemplate = /\[[a-zA-Z0-9.-]+\]=|\([a-zA-Z0-9.-]+\)=|\{\{.*?\}\}|@(if|for|else|switch)\b/.test(text);

    if (isStart) inTemplateBlock = true;

    if (!line.dataset.nexusDone && (inTemplateBlock || isDefinitiveTemplate)) {
      // Final noise guard
      if (text.trim().startsWith('import ') || text.trim().startsWith('import {')) return;

      line.innerHTML = highlightEngine(text);
      line.classList.add('nexus-line-v1', 'nexus-text-base');
      line.dataset.nexusDone = "true";
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
  // Only trigger if new nodes were added
  if (mutations.some(m => m.addedNodes.length > 0)) {
    nexusScanner();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
