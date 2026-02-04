console.log("%c [Nexus-Eye] System Live v1.2.6 (The Final Vision) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;

const highlightEngine = (text) => {
  const tokens = [];
  let processed = text;

  // PASS 1: Strings (Capture first)
  processed = processed.replace(/("[^"]*"|'[^']*')/g, (match) => {
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

const highlightTemplates = () => {
  if (!isEnabled) return;

  // Targeting the primary code line containers across GitHub views
  const selectors = [
    '.diff-text-inner', 
    '.react-code-line-contents',
    '.blob-code-inner',
    '.react-file-line-contents',
    '.react-code-text'
  ];
  
  const codeLines = document.querySelectorAll(selectors.join(', '));
  let inTemplateBlock = false;

  codeLines.forEach(line => {
    const text = line.innerText;
    
    // START TRIGGER
    if (text.includes('template:') && (text.includes('`') || text.includes("'") || text.includes('"'))) {
      inTemplateBlock = true;
      // Don't skip this line, highlight it too!
    }
    
    // END TRIGGER (Boundary Guard)
    if (inTemplateBlock && (text.includes('@Component') || text.includes('export class') || (text.includes('`') && !text.includes('template:')))) {
       // Highlight this final line before closing
       if (!line.dataset.nexusDone) {
          line.innerHTML = highlightEngine(text);
          line.classList.add('nexus-line-v1', 'nexus-text-base');
          line.dataset.nexusDone = "true";
       }
       inTemplateBlock = false;
       return;
    }

    // HEURISTIC FALLBACK: If we are in a virtual scroll and missed the start tag,
    // look for definitive Angular template patterns.
    const isDefinitiveTemplate = /\[[a-zA-Z0-9.-]+\]=|\([a-zA-Z0-9.-]+\)=|\{\{.*?\}\}|@(if|for|else|switch)\b/.test(text);

    if ((inTemplateBlock || isDefinitiveTemplate) && !line.dataset.nexusDone) {
      // Final guard: don't highlight imports or standard TS noise
      if (text.trim().startsWith('import ') || text.trim().startsWith('import {')) return;

      line.innerHTML = highlightEngine(text);
      line.classList.add('nexus-line-v1', 'nexus-text-base');
      line.dataset.nexusDone = "true";
    }
  });
};

chrome.storage.local.get(["enabled"], (result) => {
  isEnabled = result.enabled !== false;
  if (isEnabled) highlightTemplates();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "toggle") {
    isEnabled = message.enabled;
    if (!isEnabled) location.reload(); else highlightTemplates();
  }
});

setInterval(highlightTemplates, 1000);
document.addEventListener('turbo:render', highlightTemplates);

const observer = new MutationObserver(highlightTemplates);
observer.observe(document.body, { childList: true, subtree: true });
