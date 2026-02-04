console.log("%c [Nexus-Eye] System Live v1.3.3 (The Boundary Guard) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const VIEW_PROFILES = [
  { name: 'diff', selectors: ['.diff-text-inner', '.react-code-line-contents'] },
  { name: 'blob', selectors: ['.blob-code-inner', '.react-file-line-contents', '.react-code-text'] }
];

const highlightEngine = (text) => {
  const tokens = [];
  let processed = text;

  processed = processed.replace(/("[^"]*"|'[^']*')/g, (match) => {
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

  const allSelectors = VIEW_PROFILES.flatMap(p => p.selectors).join(', ');
  const codeLines = document.querySelectorAll(allSelectors);
  
  if (codeLines.length === 0) return;

  let inTemplateBlock = false;

  codeLines.forEach(line => {
    const text = line.innerText;
    
    // GUARD: Reset state if we hit a component boundary or export to prevent "bleeding"
    if (text.includes('@Component') || text.includes('export class')) {
      inTemplateBlock = false;
    }

    // Discovery: template block start
    if (text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'))) {
      inTemplateBlock = true;
      return; 
    }
    
    // Discovery: template block end (Look for standalone backtick)
    // We check for backtick and ENSURE we aren't just looking at the start line again
    if (inTemplateBlock && text.trim() === '`') {
        inTemplateBlock = false;
        return;
    }

    // Fallback: If it's a multi-line string ending, it might have content + backtick
    if (inTemplateBlock && text.includes('`') && !text.includes('template:')) {
        line.innerHTML = highlightEngine(text);
        line.classList.add('nexus-line-v1', 'nexus-text-base');
        line.dataset.nexusDone = "true";
        inTemplateBlock = false;
        return;
    }

    if (inTemplateBlock && !line.dataset.nexusDone) {
      line.innerHTML = highlightEngine(text);
      line.classList.add('nexus-line-v1', 'nexus-text-base');
      line.dataset.nexusDone = "true";
    }
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
