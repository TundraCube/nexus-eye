console.log("%c [Nexus-Eye] System Live v1.3.1 (Deep Vision Engine) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

// 1. VIEW PROFILES: Definitive selectors for GitHub's evolving DOM
const VIEW_PROFILES = [
  { name: 'diff', selectors: ['.diff-text-inner', '.react-code-line-contents'] },
  { name: 'blob', selectors: ['.blob-code-inner', '.react-file-line-contents', '.blob-code-content'] }
];

const highlightEngine = (text) => {
  const tokens = [];
  let processed = text;

  // PASS 1: Strings (Raw capture)
  processed = processed.replace(/("[^"]*"|'[^']*')/g, (match) => {
    const tokenId = `§§§NEXUS_${tokens.length}§§§`;
    tokens.push(`<span class="nexus-val">${match}</span>`);
    return tokenId;
  });

  // PASS 2: Escape structural HTML characters
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

  const allSelectors = VIEW_PROFILES.flatMap(p => p.selectors).join(', ');
  const codeLines = document.querySelectorAll(allSelectors);
  
  if (codeLines.length === 0) return;

  let inTemplateBlock = false;

  codeLines.forEach(line => {
    // If GitHub already highlighted this with spans, we need the raw text.
    // .innerText usually gives clean text even with nested spans.
    const text = line.innerText;
    
    // State machine triggers (Fuzzy match to handle split lines)
    if (text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'))) {
      inTemplateBlock = true;
      return; 
    }
    
    // End check: Backtick not accompanied by template: or ${
    if (inTemplateBlock && text.includes('`') && !text.includes('template:') && !text.includes('${')) {
      if (!line.dataset.nexusDone) {
        line.innerHTML = highlightEngine(text);
        line.classList.add('nexus-line-v1', 'nexus-text-base');
        line.dataset.nexusDone = "true";
      }
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

// Lifecycle
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
document.addEventListener('pjax:end', nexusScanner); // Legacy GitHub support
