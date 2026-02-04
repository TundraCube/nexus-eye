console.log("%c [Nexus-Eye] System Live v1.2.5 (The String Sentinel) ", "background: #1e293b; color: #34d399; font-weight: bold; border: 1px solid #34d399; padding: 2px 5px;");

let isEnabled = true;
let inTemplateBlock = false;

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

const highlightTemplates = () => {
  if (!isEnabled) return;

  const codeLines = document.querySelectorAll('.diff-text-inner, .react-code-line-contents');
  inTemplateBlock = false;

  codeLines.forEach(line => {
    const text = line.innerText;
    
    if (text.includes('template: `')) {
        inTemplateBlock = true;
        return; 
    }
    
    if (inTemplateBlock && text.includes('`') && !text.includes('${')) {
       processLine(line, text, true);
       inTemplateBlock = false;
       return; 
    }

    if (inTemplateBlock) {
      processLine(line, text, true);
    }
  });
};

const processLine = (line, text, isInsideTemplate) => {
  if (line.dataset.nexusDone) return;

  // 1. Capture ALL strings first on the RAW text (to avoid escaping confusion)
  const tokens = [];
  let processed = text;

  // Pattern A: Quoted Strings (Amber - Highest priority for templates)
  processed = processed.replace(/("[^"]*"|'[^']*')/g, (match) => {
      const tokenId = `§§§NEXUS_${tokens.length}§§§`;
      tokens.push(`<span class="nexus-val">${match}</span>`);
      return tokenId;
  });

  // 2. Escape the remaining structural characters
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 3. Match other structural elements
  const patterns = [];

  // B. COMMENTS
  patterns.push({ regex: /(&lt;!--.*?--&gt;)/g, class: 'nexus-comment' });

  // C. CONTROL FLOW
  patterns.push({ regex: /(@)(if|else if|else|defer|placeholder|loading|error|switch|case|default|for|empty)\b/g, class: 'nexus-control' });
  patterns.push({ regex: /((?<=@if|@for|@switch|@defer|@loading|@placeholder|@error)\s*)(\()/g, class: 'nexus-control' });
  patterns.push({ regex: /(\)\s*\{)/g, class: 'nexus-control' });
  patterns.push({ regex: /([\{\}])/g, class: 'nexus-control' });
  patterns.push({ regex: /\b(as|let|track|of)\b/g, class: 'nexus-control' });

  // D. TEMPLATE ELEMENTS
  patterns.push({ regex: /(&lt;\/?[a-zA-Z0-9-]+)/g, class: 'nexus-tag' });
  patterns.push({ regex: /(\/\s*&gt;|&gt;)(?!--&gt;)/g, class: 'nexus-tag' });
  patterns.push({ regex: /((?:\[\(?|(?<!\w)\()[a-zA-Z0-9.-]+(?:\)?\]|\))(?==))/g, class: 'nexus-binding' });
  patterns.push({ regex: /\b([a-zA-Z0-9.-]+)=/g, class: 'nexus-attr' });
  patterns.push({ regex: /(\{\{.*?\}\})/g, class: 'nexus-signal' });

  // E. LOGIC
  patterns.push({ regex: /\b(inject|signal|computed|effect|toSignal|input|output|resource)\b/g, class: 'nexus-signal' });

  patterns.forEach((p) => {
    processed = processed.replace(p.regex, (match) => {
      const tokenId = `§§§NEXUS_${tokens.length}§§§`;
      tokens.push(`<span class="${p.class}">${match}</span>`);
      return tokenId;
    });
  });

  // F. REASSEMBLE
  let finalHtml = processed;
  tokens.forEach((tokenHtml, i) => {
    const tokenId = `§§§NEXUS_${i}§§§`;
    finalHtml = finalHtml.split(tokenId).join(tokenHtml);
  });

  line.classList.add('nexus-text-base');
  line.innerHTML = finalHtml;
  line.classList.add('nexus-line-v1');
  line.dataset.nexusDone = "true";
};

setInterval(highlightTemplates, 1000);
document.addEventListener('turbo:render', highlightTemplates);
