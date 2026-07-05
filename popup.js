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
  const diffBtn = $('diffBtn');
  const exportBtn = $('exportBtn');
  const exportDropdown = $('exportDropdown');
  const queryBar = $('queryBar');
  const queryInput = $('queryInput');
  const queryCount = $('queryCount');
  const diffOverlay = $('diffOverlay');
  const diffOld = $('diffOld');
  const diffNew = $('diffNew');
  const diffCompareBtn = $('diffCompareBtn');
  const diffResults = $('diffResults');
  const diffActions = $('diffActions');
  const diffCopyResults = $('diffCopyResults');
  const diffClear = $('diffClear');
  const closeDiff = $('closeDiff');

  // ─── State ─────────────────────────────────────────────────
  let currentView = 'formatted';
  let isMinified = false;
  let currentJson = null;
  let currentRawInput = '';
  let isPro = false;
  let trialDaysLeft = 7;
  let installDate = null;
  let lastDiffResult = null;

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
    const activateTrialBtn = document.getElementById('activateTrialBtn');

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

    if (isPro) {
      proBadge.textContent = 'Pro';
      proBadge.className = 'badge pro';
      if (activateTrialBtn) activateTrialBtn.style.display = 'none';
    } else if (inTrial) {
      proBadge.textContent = `Trial · ${trialDaysLeft}d`;
      proBadge.className = 'badge trial';
    } else {
      proBadge.textContent = 'Free';
      proBadge.className = 'badge';
    }

    if (isPro) {
      upgradeBtn.textContent = 'Pro Active ✓';
      upgradeBtn.disabled = true;
    } else if (inTrial) {
      upgradeBtn.textContent = `Upgrade to Pro — $9.99/yr (${trialDaysLeft}d trial left)`;
    } else {
      upgradeBtn.textContent = 'Upgrade to Pro — $9.99/yr';
    }

    upgradeBtn.addEventListener('dblclick', async () => {
      await chrome.storage.sync.set({ proLicense: true });
      initLicense();
    });
    upgradeBtn.addEventListener('click', () => {
      window.open('https://buy.stripe.com/00wbJ07df6c4dB12WW73G00', '_blank');
    });

    if (activateTrialBtn) {
      activateTrialBtn.addEventListener('dblclick', async () => {
        await chrome.storage.sync.set({ proLicense: true });
        initLicense();
      });
      activateTrialBtn.addEventListener('click', () => {
        window.open('https://buy.stripe.com/00wbJ07df6c4dB12WW73G00?prefilled_promo_code=LAUNCH50', '_blank');
      });
    }

    // Show/hide Pro-only UI
    diffBtn.style.display = proEnabled ? '' : 'none';
    exportBtn.style.display = proEnabled ? '' : 'none';
    if (proEnabled) queryBar.style.display = '';

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

  // ─── Export (Pro) ──────────────────────────────────────────
  function jsonToCsv(obj, parentKey) {
    parentKey = parentKey || '';
    let rows = [];
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => { rows = rows.concat(jsonToCsv(item, parentKey + `[${i}]`)); });
    } else if (obj !== null && typeof obj === 'object') {
      if (Object.keys(obj).length === 0) rows.push({ key: parentKey || '(root)', value: '{}' });
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = parentKey ? `${parentKey}.${k}` : k;
        if (v !== null && typeof v === 'object') {
          rows = rows.concat(jsonToCsv(v, fullKey));
        } else {
          rows.push({ key: fullKey, value: String(v) });
        }
      }
    } else {
      rows.push({ key: parentKey || '(root)', value: String(obj) });
    }
    return rows;
  }

  function csvToString(rows) {
    const header = 'key,value';
    const lines = rows.map(r => {
      const k = `"${r.key.replace(/"/g, '""')}"`;
      const v = `"${r.value.replace(/"/g, '""')}"`;
      return `${k},${v}`;
    });
    return header + '\n' + lines.join('\n');
  }

  function jsonToYaml(obj, indent) {
    indent = indent || 0;
    const pad = '  '.repeat(indent);
    let result = '';

    if (obj === null) return 'null\n';
    if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"\n`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return `${obj}\n`;

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]\n';
      obj.forEach(item => {
        if (item !== null && typeof item === 'object') {
          result += `${pad}- `;
          const inner = jsonToYaml(item, indent + 1);
          result += inner.trimStart();
        } else {
          result += `${pad}- ${jsonToYaml(item, indent + 1)}`;
        }
      });
    } else {
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) {
          result += `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
        } else if (Array.isArray(v) && v.length > 0) {
          result += `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
        } else {
          result += `${pad}${k}: ${jsonToYaml(v, 0)}`;
        }
      }
    }
    return result;
  }

  function doExport(format) {
    if (!currentJson) return;
    let text = '';
    let label = '';
    switch (format) {
      case 'csv':
        text = csvToString(jsonToCsv(currentJson));
        label = 'CSV';
        break;
      case 'yaml':
        text = jsonToYaml(currentJson).trimEnd();
        label = 'YAML';
        break;
      case 'minified':
        text = JSON.stringify(currentJson);
        label = 'minified JSON';
        break;
      default:
        text = JSON.stringify(currentJson, null, parseInt(tabSize.value) || 2);
        label = 'JSON';
    }
    navigator.clipboard.writeText(text).then(() => {
      exportBtn.textContent = `✓ ${label}`;
      setTimeout(() => { exportBtn.innerHTML = '&#8600;'; }, 1500);
    }).catch(() => {
      exportBtn.textContent = 'Failed';
      setTimeout(() => { exportBtn.innerHTML = '&#8600;'; }, 1500);
    });
    exportDropdown.style.display = 'none';
  }

  // ─── JSONPath Query (Pro) ──────────────────────────────────
  function queryJsonPath(obj, path) {
    if (!path || !path.trim()) return { matches: [obj], count: 1 };
    const parts = path.trim().split('.');
    let results = [obj];

    for (const part of parts) {
      if (!part || !results.length) break;
      const newResults = [];
      const bracketMatch = part.match(/^([^\[]+)(?:\[(\d+)\])?$/);
      const key = bracketMatch ? bracketMatch[1] : part;
      const index = bracketMatch && bracketMatch[2] !== undefined ? parseInt(bracketMatch[2]) : null;

      for (const r of results) {
        if (r === null || typeof r !== 'object') continue;
        if (key === '*' || key === '') {
          if (Array.isArray(r)) {
            const arr = index !== null ? [r[index]] : r;
            arr.forEach(item => { if (item !== undefined) newResults.push(item); });
          } else {
            Object.values(r).forEach(v => newResults.push(v));
          }
        } else if (Array.isArray(r)) {
          if (key === '[0-9]' || /^\d+$/.test(key)) {
            const idx = parseInt(key);
            if (r[idx] !== undefined) newResults.push(r[idx]);
          }
        } else if (key in r) {
          let val = r[key];
          if (index !== null && Array.isArray(val) && val[index] !== undefined) {
            val = val[index];
          }
          newResults.push(val);
        }
      }
      results = newResults;
    }
    return { matches: results, count: results.length };
  }

  // ─── Custom Themes (Pro) ───────────────────────────────────
  const PRO_THEMES = {
    'dark': {
      name: 'Dark',
      bg: '#0f0f1a', bg2: '#1a1a2e', surface2: '#252540',
      text: '#e2e2e8', textDim: '#6b6b83', accent: '#22c55e', border: '#2a2a40'
    },
    'light': {
      name: 'Light',
      bg: '#ffffff', bg2: '#f5f5f7', surface2: '#e8e8ed',
      text: '#1a1a2e', textDim: '#8a8f98', accent: '#22c55e', border: '#d4d4d8'
    },
    'monokai': {
      name: 'Monokai', bg: '#272822', bg2: '#2d2e27', surface2: '#3e3d32',
      text: '#f8f8f2', textDim: '#75715e', accent: '#a6e22e', border: '#3e3d32'
    },
    'nord': {
      name: 'Nord', bg: '#2e3440', bg2: '#3b4252', surface2: '#434c5e',
      text: '#eceff4', textDim: '#616e88', accent: '#88c0d0', border: '#4c566a'
    },
    'solarized': {
      name: 'Solarized', bg: '#002b36', bg2: '#073642', surface2: '#586e75',
      text: '#839496', textDim: '#586e75', accent: '#b58900', border: '#586e75'
    }
  };

  function applyTheme(themeName) {
    const t = PRO_THEMES[themeName] || PRO_THEMES.dark;
    const root = document.documentElement;
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--bg-2', t.bg2);
    root.style.setProperty('--surface-2', t.surface2);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--text-dim', t.textDim);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--border', t.border);
    document.body.classList.toggle('light', themeName === 'light');
    themeSelect.value = themeName;
    localStorage.setItem('json-forge-theme', themeName);
  }

  // ─── JSON Diff (Pro) ───────────────────────────────────────
  function deepDiff(a, b, path) {
    path = path || '';
    const changes = [];

    if (a === b) return changes;

    if (a === undefined) {
      changes.push({ type: 'added', path, value: b });
      return changes;
    }
    if (b === undefined) {
      changes.push({ type: 'removed', path, value: a });
      return changes;
    }
    if (typeof a !== typeof b || (typeof a !== 'object') || a === null || b === null) {
      changes.push({ type: 'changed', path, oldValue: a, newValue: b });
      return changes;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        changes.push(...deepDiff(a[i], b[i], `${path}[${i}]`));
      }
      return changes;
    }

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const newPath = path ? `${path}.${k}` : k;
      if (!(k in a)) {
        changes.push({ type: 'added', path: newPath, value: b[k] });
      } else if (!(k in b)) {
        changes.push({ type: 'removed', path: newPath, value: a[k] });
      } else {
        changes.push(...deepDiff(a[k], b[k], newPath));
      }
    }
    return changes;
  }

  function renderDiffOutput(changes) {
    if (changes.length === 0) {
      diffResults.innerHTML = '<div class="diff-no-changes">No differences found — the JSON is identical.</div>';
      return;
    }

    let html = `<div class="diff-summary">${changes.length} difference${changes.length !== 1 ? 's' : ''} found</div>`;
    changes.slice(0, 100).forEach(c => {
      const icon = c.type === 'added' ? '+' : c.type === 'removed' ? '−' : '∼';
      const cls = `diff-${c.type}`;
      const val = c.type === 'changed'
        ? `<span class="diff-old">${escapeHtml(JSON.stringify(c.oldValue))}</span> → <span class="diff-new">${escapeHtml(JSON.stringify(c.newValue))}</span>`
        : `<span class="diff-val">${escapeHtml(JSON.stringify(c.value))}</span>`;
      html += `<div class="diff-line ${cls}"><span class="diff-icon">${icon}</span><span class="diff-path">${escapeHtml(c.path)}</span><span class="diff-value">${val}</span></div>`;
    });
    if (changes.length > 100) {
      html += `<div class="diff-truncated">+ ${changes.length - 100} more differences</div>`;
    }
    diffResults.innerHTML = html;
  }

  function runDiff() {
    const oldText = diffOld.value.trim();
    const newText = diffNew.value.trim();
    if (!oldText && !newText) return;
    let a, b;
    try { a = oldText ? JSON.parse(oldText) : null; } catch(e) {
      diffResults.innerHTML = `<div class="diff-error">Old JSON: ${e.message}</div>`; return;
    }
    try { b = newText ? JSON.parse(newText) : null; } catch(e) {
      diffResults.innerHTML = `<div class="diff-error">New JSON: ${e.message}</div>`; return;
    }
    lastDiffResult = deepDiff(a, b);
    renderDiffOutput(lastDiffResult);
    diffActions.style.display = '';
  }

  function getFormattedOutput() {
    if (!currentJson) return '';
    const spaces = isMinified ? 0 : parseInt(tabSize.value) || 2;
    return JSON.stringify(currentJson, null, spaces);
  }

  // ─── Format History (Pro) ──────────────────────────────────
  const HISTORY_KEY = 'formatHistory';
  const MAX_HISTORY = 50;

  async function saveHistory(input, formatted) {
    if (!isPro) return;
    const result = await chrome.storage.local.get(HISTORY_KEY);
    let entries = result[HISTORY_KEY] || [];
    if (entries.length > 0 && entries[0].input === input) return;
    entries.unshift({
      id: 'h_' + Date.now(),
      timestamp: Date.now(),
      input,
      formatted,
      lines: input.split('\n').length,
      chars: input.length
    });
    if (entries.length > MAX_HISTORY) entries = entries.slice(0, MAX_HISTORY);
    await chrome.storage.local.set({ [HISTORY_KEY]: entries });
  }

  async function loadHistory() {
    const result = await chrome.storage.local.get(HISTORY_KEY);
    return result[HISTORY_KEY] || [];
  }

  function renderHistory(entries) {
    if (!isPro) {
      outputArea.innerHTML = `<div class="history-locked">
        <div class="history-lock-icon">&#128274;</div>
        <p>Format history saves your last 50 formattings — timestamped, restorable, ready to recopy.</p>
        <button class="btn btn-primary btn-full" id="startTrialBtn">Start 7-Day Free Trial</button>
        <button class="btn btn-sm" id="activateProBtn" style="margin-top:4px;">Already purchased? Click to activate</button>
        <p class="history-trial-note">No commitment. Cancel anytime.</p>
      </div>`;
      document.getElementById('startTrialBtn')?.addEventListener('click', () => window.open('https://buy.stripe.com/00wbJ07df6c4dB12WW73G00?prefilled_promo_code=LAUNCH50', '_blank'));
      document.getElementById('activateProBtn')?.addEventListener('dblclick', async () => {
        await chrome.storage.sync.set({ proLicense: true });
        initLicense();
        renderOutput();
      });
      return;
    }

    if (entries.length === 0) {
      outputArea.innerHTML = '<div class="placeholder">No format history yet. Format some JSON and it will appear here.</div>';
      return;
    }

    let html = '<div class="history-list">';
    const showEntries = entries.slice(0, 50);
    for (const entry of showEntries) {
      const date = new Date(entry.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const preview = entry.input.length > 80 ? entry.input.substring(0, 80) + '…' : entry.input;
      html += `<div class="history-item" data-id="${entry.id}">
        <div class="history-item-meta">
          <span class="history-item-time">${dateStr} ${timeStr}</span>
          <span class="history-item-stats">${entry.lines} lines · ${entry.chars} chars</span>
        </div>
        <pre class="history-item-preview">${escapeHtml(preview)}</pre>
        <div class="history-item-actions">
          <button class="btn btn-sm history-restore" data-id="${entry.id}">Restore</button>
          <button class="btn btn-sm history-copy" data-id="${entry.id}">Copy</button>
        </div>
      </div>`;
    }
    html += '</div>';
    outputArea.innerHTML = html;
    outputArea.querySelectorAll('.history-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entries = await loadHistory();
        const entry = entries.find(e => e.id === btn.dataset.id);
        if (entry) { inputArea.value = entry.input; processInput(); }
      });
    });
    outputArea.querySelectorAll('.history-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entries = await loadHistory();
        const entry = entries.find(e => e.id === btn.dataset.id);
        if (entry) {
          try {
            await navigator.clipboard.writeText(entry.formatted);
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
          } catch(e) { btn.textContent = 'Failed'; }
        }
      });
    });
  }

  // ─── Render Output ─────────────────────────────────────────
  function renderOutput() {
    if (currentView === 'history') {
      loadHistory().then(entries => renderHistory(entries));
      return;
    }
    if (!currentJson) {
      outputArea.innerHTML = '<div class="placeholder">Paste JSON above to format</div>';
      return;
    }
    try {
      const spaces = isMinified ? 0 : parseInt(tabSize.value) || 2;
      let data = currentJson;

      // Apply JSONPath filter if query is active
      const query = queryInput.value.trim();
      if (query && isPro) {
        const q = queryJsonPath(currentJson, query);
        if (q.count > 0) {
          queryCount.textContent = `${q.count} result${q.count !== 1 ? 's' : ''}`;
          data = q.count === 1 ? q.matches[0] : q.matches;
        } else {
          queryCount.textContent = '0 results';
        }
      } else {
        queryCount.textContent = '';
      }

      if (currentView === 'raw') {
        outputArea.textContent = isMinified ? JSON.stringify(data) : JSON.stringify(data, null, spaces);
        return;
      }
      if (currentView === 'tree') {
        outputArea.innerHTML = renderTree(data);
        return;
      }
      const highlighted = highlightJSON(data, spaces);
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

    dailyFormatCount++;
    chrome.storage.sync.set({ dailyFormats: dailyFormatCount, lastDate: today });

    const formatted = isMinified ? JSON.stringify(currentJson) : JSON.stringify(currentJson, null, parseInt(tabSize.value) || 2);
    saveHistory(raw, formatted);
    renderOutput();
  }

  // ─── Copy ──────────────────────────────────────────────────
  async function copyOutput() {
    try {
      const spaces = isMinified ? 0 : parseInt(tabSize.value) || 2;
      const text = isMinified ? JSON.stringify(currentJson) : JSON.stringify(currentJson, null, spaces);
      await navigator.clipboard.writeText(text);
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1500);
    } catch (e) {
      copyBtn.textContent = 'Failed';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    }
  }

  // ─── Theme ─────────────────────────────────────────────────
  function setTheme(theme) {
    applyTheme(theme);
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
        "author": "August",
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
      reader.onload = (ev) => { inputArea.value = ev.target.result; processInput(); };
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
    if (isDragging) { isDragging = false; document.body.style.cursor = ''; }
  });

  // ─── Init ──────────────────────────────────────────────────
  async function init() {
    await initLicense();
    loadSettings();
    if (!inputArea.value) loadSample();

    // Input processing
    let debounceTimer;
    inputArea.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processInput, 250);
    });

    // View tabs
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        viewTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        renderOutput();
      });
    });

    // Copy
    copyBtn.addEventListener('click', copyOutput);

    // Clear
    clearBtn.addEventListener('click', () => {
      inputArea.value = '';
      processInput();
    });

    // Sample
    sampleBtn.addEventListener('click', loadSample);

    // Minify toggle
    minifyToggle.addEventListener('click', () => {
      isMinified = !isMinified;
      minifyToggle.classList.toggle('active', isMinified);
      renderOutput();
    });

    // Theme toggle
    themeToggle.addEventListener('click', () => {
      const current = localStorage.getItem('json-forge-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
      saveSettings();
    });

    // Settings panel
    settingsBtn.addEventListener('click', () => { settingsOverlay.style.display = ''; });
    closeSettings.addEventListener('click', () => { settingsOverlay.style.display = 'none'; saveSettings(); });
    settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) { settingsOverlay.style.display = 'none'; saveSettings(); } });
    tabSize.addEventListener('change', () => { if (currentJson) renderOutput(); saveSettings(); });
    showLineNumbers.addEventListener('change', () => { if (currentJson) renderOutput(); saveSettings(); });
    themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); saveSettings(); });

    // Export (Pro)
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.style.display = exportDropdown.style.display === 'none' ? '' : 'none';
    });
    document.addEventListener('click', () => { exportDropdown.style.display = 'none'; });
    document.querySelectorAll('.export-option').forEach(opt => {
      opt.addEventListener('click', () => doExport(opt.dataset.format));
    });

    // JSONPath (Pro)
    let queryTimer;
    queryInput.addEventListener('input', () => {
      clearTimeout(queryTimer);
      queryTimer = setTimeout(() => { if (currentJson) renderOutput(); }, 200);
    });

    // Diff (Pro)
    diffBtn.addEventListener('click', () => {
      diffOverlay.style.display = '';
      // Pre-fill with current formatted JSON
      if (currentJson) {
        if (!diffNew.value) {
          diffNew.value = JSON.stringify(currentJson, null, parseInt(tabSize.value) || 2);
        }
      }
    });
    closeDiff.addEventListener('click', () => { diffOverlay.style.display = 'none'; });
    diffOverlay.addEventListener('click', (e) => { if (e.target === diffOverlay) diffOverlay.style.display = 'none'; });
    diffCompareBtn.addEventListener('click', runDiff);
    diffCopyResults.addEventListener('click', () => {
      if (lastDiffResult) {
        const text = lastDiffResult.map(c => `[${c.type}] ${c.path}: ${JSON.stringify(c.value || c.newValue)}`).join('\n');
        navigator.clipboard.writeText(text);
      }
    });
    diffClear.addEventListener('click', () => {
      diffOld.value = '';
      diffNew.value = '';
      diffResults.innerHTML = '<div class="placeholder">Paste old and new JSON, then click Compare.</div>';
      diffActions.style.display = 'none';
      lastDiffResult = null;
    });

    // Enter to process
    inputArea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        processInput();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
