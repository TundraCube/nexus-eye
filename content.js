console.log("%c [Nexus-Eye] System Live v1.3.0 (Omni-View Engine) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

// 1. VIEW PROFILES: Define how to find code lines in different GitHub views
const VIEW_PROFILES = [
  { name: 'diff', selectors: ['.diff-text-inner', '.react-code-line-contents'] },
  { name: 'blob', selectors: ['.blob-code-inner', '.react-file-line-contents'] }
];

// 2. HIGHLIGHT ENGINE: Pure logic for transforming text to highlighted HTML
const highlightEngine = (text) => {
  const tokens = [];
  let processed = text;

  // PASS 1: Strings (Raw capture to avoid escaping conflicts)
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

// 3. SCANNER: The orchestrator that manages DOM traversal and state
const nexusScanner = () => {
  if (!isEnabled) return;

  // Flatten all selectors from all profiles for broad discovery
  const allSelectors = VIEW_PROFILES.flatMap(p => p.selectors).join(', ');
  const codeLines = document.querySelectorAll(allSelectors);
  
  let inTemplateBlock = false;

  codeLines.forEach(line => {
    const text = line.innerText;
    
    // State machine triggers
    if (text.includes('template: `')) {
      inTemplateBlock = true;
      return; 
    }
    
    if (inTemplateBlock && text.includes('`') && !text.includes('${')) {
      // Highlight the final line before closing
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

// 4. LIFECYCLE: Initialization and event listeners
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
