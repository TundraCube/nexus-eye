console.log("%c [Nexus-Eye] System Live v1.4.9 (Grouped Engine) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const LINE_SELECTORS = [
  '.diff-text-inner', 
  '.react-code-line-contents',
  '.blob-code-inner',
  '.react-file-line-contents',
  '.react-code-text',
  '.blob-code-content'
];

const FILE_CONTAINER_SELECTORS = [
  '.file', 
  '.js-file',
  '.blob-wrapper', 
  'section[aria-labelledby]', 
  '[data-path]', 
  '[data-file-path]', 
  '.react-blob-view-container',
  '.js-file-contents'
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

  // 1. Get all code lines on the entire page
  const allLines = document.querySelectorAll(LINE_SELECTORS.join(', '));
  if (allLines.length === 0) return;

  // 2. Group lines by their file container
  const fileGroups = new Map();
  const containers = FILE_CONTAINER_SELECTORS.join(', ');

  allLines.forEach(line => {
    const container = line.closest(containers) || document.body;
    if (!fileGroups.has(container)) {
      fileGroups.set(container, []);
    }
    fileGroups.get(container).push(line);
  });

  // 3. Process each group independently with an ISOLATED state machine
  fileGroups.forEach((lines, container) => {
    let inTemplateBlock = false;

    lines.forEach(line => {
      const text = line.innerText || line.textContent;
      if (!text) return;

      // Noise Guard: Reset state if we see imports or exports at file level
      const trimmed = text.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('import {') || trimmed.startsWith('export ')) {
        inTemplateBlock = false;
        return;
      }

      // Triggers
      const isStart = text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'));
      const isEnd = inTemplateBlock && (
          text.includes('@Component') || 
          text.includes('export class') || 
          (text.trim() === '`') || 
          (text.includes('`') && !text.includes('template:'))
      );

      if (isStart) inTemplateBlock = true;

      // Action
      if (inTemplateBlock && !line.dataset.nexusDone) {
        const highlighted = highlightEngine(text);
        if (highlighted) {
            line.innerHTML = highlighted;
            line.classList.add('nexus-line-v1', 'nexus-text-base');
            line.dataset.nexusDone = "true";
        }
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

const observer = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
        nexusScanner();
    }
});
observer.observe(document.body, { childList: true, subtree: true });
