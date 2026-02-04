console.log("%c [Nexus-Eye] System Live v1.3.9 (The Isolated Engine) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

const FILE_SELECTORS = '.file, .blob-wrapper, [data-path], [data-file-path], section[aria-labelledby]';

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

  // We find all file containers on the page
  const containers = document.querySelectorAll(FILE_SELECTORS);
  
  containers.forEach(container => {
    // Each file has its own isolated template state
    let containerInTemplate = false;
    
    // Find all code lines within THIS specific file
    const codeLines = container.querySelectorAll(LINE_SELECTORS.join(', '));
    
    codeLines.forEach(line => {
      const text = line.innerText || line.textContent;
      if (!text) return;

      // INCEPTION GUARD
      if (text.includes('[Nexus-Eye]') || text.includes('§§§NEXUS')) return;

      // TRIGGERS
      const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
      const isEnd = containerInTemplate && (text.includes('@Component') || text.includes('export class') || (text.trim() === '`') || (text.includes('`') && !text.includes('template:')));

      if (isStart) containerInTemplate = true;

      // Only highlight if this file's state is currently "IN TEMPLATE"
      if (containerInTemplate && !line.dataset.nexusDone) {
          if (text.trim().startsWith('import ') || text.trim().startsWith('import {')) return;

          const highlighted = highlightEngine(text);
          if (highlighted) {
              line.innerHTML = highlighted;
              line.classList.add('nexus-line-v1', 'nexus-text-base');
              line.dataset.nexusDone = "true";
          }
      }

      if (isEnd) containerInTemplate = false;
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

const observer = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
        nexusScanner();
    }
});
observer.observe(document.body, { childList: true, subtree: true });
