(function() {
  'use strict';

  // ─── DOM refs ──────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const inputArea = $('inputArea');
  const outputArea = $('outputArea');
  const statusText = $('statusText');
  const statusIndicator = $('statusIndicator');
  const lineCount = $('lineCount');
  const charCount = $('charCount');
  const copyBtn = $('copyBtn');
  const clearBtn = $('clearBtn');
  const sampleBtn = $('sampleBtn');
  const minifyToggle = $('minifyToggle');
  const divider = $('divider');
  const dropOverlay = $('dropOverlay');
  const themeToggle = $('themeToggle');
  const settingsBtn = $('settingsBtn');
  const closeSettings = $('closeSettings');
  const settingsOverlay = $('settingsOverlay');
  const settingsPanel = $('settingsPanel');
  const upgradeBtn = $('upgradeBtn');
  const proBadge = $('proBadge');
  const tabSize = $('tabSize');
  const themeSelect = $('themeSelect');
  const showLineNumbers = $('showLineNumbers');
  const viewTabs = document.querySelectorAll('.view-tab');

  // ─── State ─────────────────────────────────────────────────
  let currentView = 'formatted';
  let isMinified = false;
  let currentJson = null;       // parsed JSON
  let currentRawInput = '';
  let isPro = false;
  let trialDaysLeft = 7;
  let installDate = null;

  // Track daily stats
  const today = new Date().toDateString();
  let dailyFormatCount = 0;

  // ─── Trial & License ───────────────────────────────────────
  function calcTrialDays(installed) {
    if (!installed) return 7;
    return Math.max(0, 7 - Math.floor((Date.now() - installed) / 86400000));
  }

  async function initLicense() {
    const result = await chrome.storage.sync.get(['proLicense', 'installDate', 'dailyFormats', 'lastDate']);
    
    if (!result.installDate) {
      installDate = Date.now();
      await chrome.storage.sync.set({ installDate });
      trialDaysLeft = 7;
    } else {
      installDate = result.installDate;
      trialDaysLeft = calcTrialDays(installDate);
    }

    isPro = result.proLicense === true;
    const inTrial = trialDaysLeft > 0 && !isPro;
    const proEnabled = isPro || inTrial;

    // Update badge
    if (isPro) {
      proBadge.textContent = 'Pro';
      proBadge.className = 'badge pro';
    } else if (inTrial) {
      proBadge.textContent = `Trial · ${trialDaysLeft}d`;
      proBadge.className = 'badge trial';
    } else {
      proBadge.textContent = 'Free';
      proBadge.className = 'badge';
    }

    // Upgrade button
    if (isPro) {
      upgradeBtn.textContent = 'Pro Active ✓';
      upgradeBtn.disabled = true;
    } else if (inTrial) {
      upgradeBtn.textContent = `Upgrade to Pro — $4.99/yr (${trialDaysLeft}d trial left)`;
    } else {
      upgradeBtn.textContent = 'Upgrade to Pro — $4.99/yr';
    }

    // Double-click to activate Pro (same pattern as Link Cleaner)
    upgradeBtn.addEventListener('dblclick', async () => {
      await chrome.storage.sync.set({ proLicense: true });
      initLicense();
    });
    upgradeBtn.addEventListener('click', () => {
      window.open('https://buy.stripe.com/6oU8wOdg65tQ104a8GbjW04', '_blank');
    });

    // Daily stats
    if (result.lastDate === today) {
      dailyFormatCount = result.dailyFormats || 0;
    } else {
      dailyFormatCount = 0;
      chrome.storage.sync.set({ dailyFormats: 0, lastDate: today });
    }
  }

  // ─── JSON Formatting ───────────────────────────────────────
  function formatJSON(input, spaces) {
    const trimmed = input.trim();
    if (!trimmed) { return { ok: false, error: null, data: null }; }
    try {
      const parsed = JSON.parse(trimmed);
      return { ok: true, error: null, data: parsed };
    } catch (e) {
      // Try to extract line number from error message
      const match = e.message.match(/position\s+(\d+)/i);
      let lineInfo = '';
      if (match) {
        const pos = parseInt(match[1]);
        const lines = trimmed.substring(0, pos).split('\n');
        lineInfo = ` (line ${lines.length})`;
      }
      return { ok: false, error: `Invalid JSON${lineInfo}: ${e.message}`, data: null };
    }
  }

  // ─── Syntax Highlighting ───────────────────────────────────
  function highlightJSON(obj, spaces) {
    const json = JSON.stringify(obj, null, spaces);
    return syntaxHighlight(json);
  }

  function syntaxHighlight(json) {
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"([^"]+)":/g, '<span class="hl-key">"$1"</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span class="hl-string">"$1"</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="hl-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="hl-bool">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="hl-null">$1</span>')
      .replace(/([\[\]{}])/g, '<span class="hl-bracket">$1</span>')
      .replace(/,(?!.*<\/span>)/g, '<span class="hl-comma">,</span>');
  }

  // ─── Tree View ─────────────────────────────────────────────
  function renderTree(obj, depth) {
    depth = depth || 0;
    
    if (obj === null) return '<span class="hl-null">null</span>';
    if (typeof obj === 'string') return `<span class="hl-string">"${escapeHtml(obj)}"</span>`;
    if (typeof obj === 'number') return `<span class="hl-number">${obj}</span>`;
    if (typeof obj === 'boolean') return `<span class="hl-bool">${obj}</span>`;
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '<span class="hl-bracket">[ ]</span>';
      let items = obj.map((v, i) => `<div class="tree-item">${renderTree(v, depth + 1)}</div>`).join('');
      return `<span class="tree-toggle" onclick="this.classList.toggle('collapsed');this.nextElementSibling.style.display=this.classList.contains('collapsed')?'none':''">&#9660;</span><span class="hl-bracket">[</span><span class="tree-children">${items}</span><span class="hl-bracket">]</span>`;
    }
    
    const keys = Object.keys(obj);
    if (keys.length === 0) return '<span class="hl-bracket">{ }</span>';
    let items = keys.map(k => 
      `<div class="tree-item"><span class="tree-key">"${escapeHtml(k)}"</span>: ${renderTree(obj[k], depth + 1)}</div>`
    ).join('');
    return `<span class="tree-toggle" onclick="this.classList.toggle('collapsed');var ch=this.nextElementSibling.nextElementSibling;ch.style.display=this.classList.contains('collapsed')?'none':''">&#9660;</span><span class="hl-bracket">{</span><span class="tree-children">${items}</span><span class="hl-bracket">}</span>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Render Output ─────────────────────────────────────────
  function renderOutput() {
    if (!currentJson) {
      outputArea.innerHTML = '<div class="placeholder">Paste JSON above to format</div>';
      return;
    }

    try {
      const spaces = isMinified ? 0 : parseInt(tabSize.value) || 2;

      if (currentView === 'raw') {
        outputArea.textContent = isMinified 
          ? JSON.stringify(currentJson)
          : JSON.stringify(currentJson, null, spaces);
        return;
      }

      if (currentView === 'tree') {
        const html = renderTree(currentJson);
        outputArea.innerHTML = html;
        return;
      }

      // Formatted view
      const highlighted = highlightJSON(currentJson, spaces);
      const lines = highlighted.split('\n');
      
      if (showLineNumbers.checked) {
        const numbered = lines.map((line, i) => {
          const num = String(i + 1).padStart(4, ' ');
          return `<span style="color:var(--text-dim);user-select:none;">${num}</span>  ${line}`;
        }).join('\n');
        outputArea.innerHTML = numbered;
      } else {
        outputArea.innerHTML = lines.join('\n');
      }
    } catch (e) {
      outputArea.innerHTML = `<div class="error-message">Render error: ${e.message}</div>`;
    }
  }

  // ─── Process Input ─────────────────────────────────────────
  function processInput() {
    const raw = inputArea.value;
    currentRawInput = raw;
    
    if (!raw.trim()) {
      currentJson = null;
      statusIndicator.className = 'status-indicator';
      statusText.textContent = 'Ready';
      lineCount.textContent = '';
      charCount.textContent = '';
      copyBtn.disabled = true;
      renderOutput();
      return;
    }

    const spaces = isMinified ? 0 : parseInt(tabSize.value) || 2;
    const result = formatJSON(raw, spaces);
    
    if (!result.ok) {
      currentJson = null;
      statusIndicator.className = 'status-indicator invalid';
      statusText.textContent = 'Invalid JSON';
      lineCount.textContent = '';
      charCount.textContent = `${raw.length} chars`;
      copyBtn.disabled = true;
      outputArea.innerHTML = `<div class="error-message">${result.error}</div>`;
      return;
    }

    currentJson = result.data;
    statusIndicator.className = 'status-indicator valid';
    
    const lines = raw.split('\n').length;
    const chars = raw.length;
    lineCount.textContent = `${lines} lines`;
    charCount.textContent = `${chars} chars`;
    statusText.textContent = 'Valid JSON';
    copyBtn.disabled = false;

    // Track format
    dailyFormatCount++;
    chrome.storage.sync.set({ dailyFormats: dailyFormatCount, lastDate: today });

    renderOutput();
  }

  // ─── Copy ──────────────────────────────────────────────────
  async function copyOutput() {
    try {
      const spaces = isMinified ? 0 : parseInt(tabSize.value) || 2;
      const text = isMinified 
        ? JSON.stringify(currentJson)
        : JSON.stringify(currentJson, null, spaces);
      await navigator.clipboard.writeText(text);
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1500);
    } catch (e) {
      // Fallback
      copyBtn.textContent = 'Failed';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    }
  }

  // ─── Theme ─────────────────────────────────────────────────
  function setTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('json-forge-theme', theme);
    themeSelect.value = theme;
  }

  // ─── Settings ──────────────────────────────────────────────
  function loadSettings() {
    const saved = localStorage.getItem('json-forge-settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        tabSize.value = s.tabSize || '4';
        showLineNumbers.checked = s.showLineNumbers !== false;
        setTheme(s.theme || 'dark');
      } catch(e) {}
    }
  }

  function saveSettings() {
    localStorage.setItem('json-forge-settings', JSON.stringify({
      tabSize: tabSize.value,
      showLineNumbers: showLineNumbers.checked,
      theme: themeSelect.value
    }));
  }

  // ─── Sample Data ───────────────────────────────────────────
  function loadSample() {
    inputArea.value = JSON.stringify({
      "name": "JSON Forge",
      "version": "1.0.0",
      "description": "A beautiful JSON formatter",
      "features": ["format", "validate", "highlight", "copy"],
      "metadata": {
        "author": "Startup Farm",
        "users": 0,
        "isPro": false,
        "rating": null
      }
    }, null, 2);
    processInput();
  }

  // ─── Drag & Drop ───────────────────────────────────────────
  const pane = document.querySelector('.input-pane');
  pane.addEventListener('dragover', (e) => { e.preventDefault(); pane.classList.add('dragging'); });
  pane.addEventListener('dragleave', () => { pane.classList.remove('dragging'); });
  pane.addEventListener('drop', (e) => {
    e.preventDefault();
    pane.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        inputArea.value = ev.target.result;
        processInput();
      };
      reader.readAsText(file);
    }
  });

  // ─── Divider (resize) ──────────────────────────────────────
  let isDragging = false;
  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = document.querySelector('.workspace').getBoundingClientRect();
    const pct = ((e.clientY - rect.top) / rect.height) * 100;
    document.querySelector('.input-pane').style.flex = `0 0 ${Math.max(20, Math.min(70, pct))}%`;
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
    }
  });

  // ─── Event Listeners ───────────────────────────────────────
  let debounceTimer;
  inputArea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processInput, 250);
  });

  inputArea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      processInput();
    }
  });

  copyBtn.addEventListener('click', copyOutput);
  clearBtn.addEventListener('click', () => {
    inputArea.value = '';
    processInput();
    inputArea.focus();
  });
  sampleBtn.addEventListener('click', loadSample);

  minifyToggle.addEventListener('click', () => {
    isMinified = !isMinified;
    minifyToggle.classList.toggle('active', isMinified);
    renderOutput();
  });

  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      renderOutput();
    });
  });

  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light');
    setTheme(isLight ? 'dark' : 'light');
    saveSettings();
    // Re-render to update colors
    if (currentJson) renderOutput();
  });

  settingsBtn.addEventListener('click', () => settingsOverlay.classList.add('open'));
  closeSettings.addEventListener('click', () => settingsOverlay.classList.remove('open'));
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
  });

  tabSize.addEventListener('change', () => { saveSettings(); processInput(); });
  themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); saveSettings(); if (currentJson) renderOutput(); });
  showLineNumbers.addEventListener('change', () => { saveSettings(); renderOutput(); });

  // ─── Init ──────────────────────────────────────────────────
  async function init() {
    await initLicense();
    loadSettings();
    loadSample(); // Pre-load with sample data so it's not empty on first open
  }

  init();
})();
