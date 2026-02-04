console.log("%c [Nexus-Eye] System Live v1.3.5 (Inception Guard) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

// 1. FILE CONTAINERS: Targeting the wrappers for individual files in GitHub views
const FILE_CONTAINERS = [
  '.js-file-contents', 
  '.blob-wrapper', 
  '[data-test-selector="file-container"]',
  '.react-blob-view-container'
];

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text'
];

const highlightEngine = (text) => {
  const tokens = [];
  let processed = text;

  // PASS 1: Strings (Using escaped backticks in regex to avoid self-highlighting)
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

  // FIRST: Find all file containers on the page
  const containers = document.querySelectorAll(FILE_CONTAINERS.join(', '));
  
  containers.forEach(container => {
    // RESET state for every new file container to prevent state leakage
    let inTemplateBlock = false;
    
    // Find all code lines within THIS container
    const codeLines = container.querySelectorAll(LINE_SELECTORS.join(', '));
    
    codeLines.forEach(line => {
      if (line.dataset.nexusDone) {
          // If we hit a line already done, we must still respect its state in the machine
          // for consistency, but we don't re-process it.
          const text = line.innerText;
          if (text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'))) inTemplateBlock = true;
          if (inTemplateBlock && (text.includes('@Component') || text.includes('export class') || (text.includes('`') && !text.includes('template:')))) inTemplateBlock = false;
          return;
      }

      const text = line.innerText;

      // GUARD: Inception Guard - Skip if this is our own code being viewed
      if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;
      
      // Discovery Triggers
      const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
      const isEnd = inTemplateBlock && (text.includes('@Component') || text.includes('export class') || (text.includes('`') && !text.includes('template:')));
      const isTemplatePattern = /\[[a-zA-Z0-9.-]+\]=|\([a-zA-Z0-9.-]+\)=|\{\{.*?\}\}|@(if|for|else|switch)\b/.test(text);

      if (isStart) inTemplateBlock = true;

      if (inTemplateBlock || isTemplatePattern) {
        if (text.trim().startsWith('import ') || text.trim().startsWith('import {')) return;

        line.innerHTML = highlightEngine(text);
        line.classList.add('nexus-line-v1', 'nexus-text-base');
        line.dataset.nexusDone = "true";
      }

      if (isEnd) inTemplateBlock = false;
    });
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

const observer = new MutationObserver(nexusScanner);
observer.observe(document.body, { childList: true, subtree: true });
