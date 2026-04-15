const STORAGE_KEYS = window.APP_CONFIG.storageKeys;

function byId(id) {
  return document.getElementById(id);
}

function getBaseUrl() {
  return localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || window.APP_CONFIG.apiBaseUrl;
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return window.APP_CONFIG.defaultApiBaseUrl;
  }
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

function setBaseUrl(value) {
  const normalized = normalizeBaseUrl(value);
  localStorage.setItem(STORAGE_KEYS.apiBaseUrl, normalized);
  window.APP_CONFIG.apiBaseUrl = normalized;
  syncBaseUrlLabels();
  return normalized;
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || '';
}

function getUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSession(token, user) {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
  }
  if (user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }
  syncSessionUi();
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  syncSessionUi();
}

function getHistory() {
  const raw = localStorage.getItem(STORAGE_KEYS.history);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry) {
  const history = [entry, ...getHistory()].slice(0, 8);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEYS.history);
  renderHistory();
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getDisplayName() {
  const storedUser = getUser();
  const token = getToken();
  const tokenPayload = token ? decodeJwtPayload(token) : null;
  return (
    storedUser?.fullName ||
    storedUser?.name ||
    storedUser?.email ||
    tokenPayload?.name ||
    tokenPayload?.email ||
    'Guest'
  );
}

function syncBaseUrlLabels() {
  const baseUrl = getBaseUrl();
  const labels = ['apiBaseLabel', 'apiBaseValue'];
  labels.forEach((id) => {
    const element = byId(id);
    if (element) {
      element.textContent = baseUrl;
    }
  });

  const input = byId('apiBaseInput');
  if (input) {
    input.value = baseUrl;
  }
}

function syncSessionUi() {
  const token = getToken();
  const hasToken = Boolean(token);
  const userName = getDisplayName();
  const user = getUser();
  const history = getHistory();

  const values = {
    sessionStatus: hasToken ? `Signed in as ${userName}` : 'Not signed in',
    healthStatus: byId('healthStatus')?.textContent || 'Checking status',
    lastAction: history[0]?.label || 'None yet',
    tokenState: hasToken ? 'Present' : 'Missing',
    currentUser: hasToken ? userName : 'Guest',
    storedTokenState: hasToken ? 'Yes' : 'No',
    storedUserState: user ? 'Yes' : 'No',
    historyCount: String(history.length),
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = byId(id);
    if (element) {
      element.textContent = value;
    }
  });
}

function formatMeasurementType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function measurementTypesForSelect(includeTemperature = true) {
  return includeTemperature ? window.APP_MEASUREMENT_TYPES.all : window.APP_MEASUREMENT_TYPES.arithmetic;
}

function unitsForType(type) {
  return window.APP_UNITS[type] || [];
}

function fillTypeSelect(select, includeTemperature = true) {
  const options = measurementTypesForSelect(includeTemperature);
  select.innerHTML = options
    .map((type) => `<option value="${type}">${formatMeasurementType(type)}</option>`)
    .join('');
}

function fillUnitSelect(select, type) {
  const options = unitsForType(type);
  select.innerHTML = options.map((unit) => `<option value="${unit}">${unit}</option>`).join('');
}

function readQuantity(quantityConfig) {
  const valueElement = byId(quantityConfig.valueId);
  const typeElement = byId(quantityConfig.typeId);
  const unitElement = byId(quantityConfig.unitId);

  const value = Number(valueElement.value);
  if (Number.isNaN(value)) {
    throw new Error(`Enter a valid number for ${quantityConfig.label}.`);
  }

  return {
    value,
    measurementType: typeElement.value,
    unit: unitElement.value,
  };
}

function setFeedback(elementId, message, state = '') {
  const element = byId(elementId);
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `feedback ${state}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatResponseValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  return String(value);
}

function buildResponseSummary(data) {
  const summary = byId('responseSummary');
  const title = byId('responseTitle');
  const status = byId('responseStatus');

  if (!summary || !title || !status) {
    return;
  }

  const success = Boolean(data?.success);
  title.textContent = success ? 'Operation completed' : 'Operation failed';
  status.textContent = success ? 'Success' : 'Error';
  status.className = `response-badge ${success ? 'success' : 'error'}`;

  const details = [];
  const payload = data?.data;

  details.push({ label: 'Message', value: responseMessage(data, 'No message available.') });

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if ('value' in payload) {
      details.push({ label: 'Value', value: formatResponseValue(payload.value) });
    }
    if ('unit' in payload) {
      details.push({ label: 'Unit', value: formatResponseValue(payload.unit) });
    }
    if ('measurementType' in payload) {
      details.push({ label: 'Type', value: formatResponseValue(payload.measurementType) });
    }
    if ('result' in payload) {
      details.push({ label: 'Result', value: formatResponseValue(payload.result) });
    }
  } else if (payload !== undefined && payload !== null) {
    details.push({ label: 'Result', value: formatResponseValue(payload) });
  }

  summary.innerHTML = details
    .map(
      (item) => `
        <div class="response-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `,
    )
    .join('');
}

function setResponse(data) {
  buildResponseSummary(data);
}

function revealResponsePanel() {
  const panel = byId('responsePanel');
  if (panel) {
    panel.classList.remove('hidden');
  }
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseMessage(data, fallback) {
  if (data && typeof data === 'object') {
    return data.message || data.Message || fallback;
  }

  return fallback;
}

async function apiRequest(endpointKey, options = {}) {
  const baseUrl = getBaseUrl();
  const endpoint = window.APP_CONFIG.endpoints[endpointKey];
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.auth !== false) {
    const token = getToken();
    if (!token) {
      throw new Error('Sign in first so the request can include a Bearer token.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || 'POST',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(responseMessage(data, `Request failed with status ${response.status}.`));
  }

  if (data && typeof data === 'object' && data.success === false) {
    throw new Error(responseMessage(data, 'The backend rejected the request.'));
  }

  return data;
}

function resolveSessionFromAuthResponse(data) {
  const payload = data?.data ?? data;
  if (!payload) {
    return { token: '', user: null };
  }

  if (typeof payload === 'string') {
    return { token: payload, user: null };
  }

  const token = payload.token || payload.accessToken || payload.jwtToken || payload.jwt || data?.token || '';
  return {
    token,
    user: payload,
  };
}

function renderHistory() {
  const list = byId('historyList');
  if (!list) {
    return;
  }

  const history = getHistory();
  if (!history.length) {
    list.innerHTML = '<li><strong>No requests yet</strong><small>Your latest conversions and comparisons will appear here.</small></li>';
    syncSessionUi();
    return;
  }

  list.innerHTML = history
    .map(
      (entry) => `
        <li>
          <strong>${entry.label}</strong>
          <small>${entry.time}</small>
          <small>${entry.summary}</small>
        </li>
      `,
    )
    .join('');

  syncSessionUi();
}

function appendHistory(label, summary) {
  saveHistoryEntry({
    label,
    summary,
    time: new Date().toLocaleString(),
  });
}

function bindQuantitySelects(typeId, unitId, includeTemperature = true) {
  const typeSelect = byId(typeId);
  const unitSelect = byId(unitId);
  if (!typeSelect || !unitSelect) {
    return;
  }

  fillTypeSelect(typeSelect, includeTemperature);

  const syncUnits = () => fillUnitSelect(unitSelect, typeSelect.value);
  syncUnits();
  typeSelect.addEventListener('change', syncUnits);
}

function syncBaseOverrideButtons() {
  const button = byId('saveApiBaseBtn');
  const input = byId('apiBaseInput');
  if (!button || !input) {
    return;
  }

  button.addEventListener('click', () => {
    const normalized = setBaseUrl(input.value);
    setFeedback('responseFeedback', `Backend URL saved: ${normalized}`, 'success');
    syncSessionUi();
  });
}

function initHealthCheck() {
  const badge = byId('healthBadge');
  const healthStatus = byId('healthStatus');

  if (!badge || !healthStatus) {
    return;
  }

  const updateHealthUi = (state, text) => {
    badge.className = `status-badge ${state}`;
    badge.textContent = text;
    healthStatus.textContent = text;
  };

  updateHealthUi('warn', 'Checking');

  apiRequest('health', { auth: false, method: 'GET' })
    .then((data) => {
      const message = responseMessage(data, 'Backend online');
      updateHealthUi('ok', 'Online');
      healthStatus.textContent = message;
    })
    .catch((error) => {
      updateHealthUi('error', 'Offline');
      healthStatus.textContent = error.message;
    })
    .finally(() => {
      syncSessionUi();
    });
}

function initAuthPage(pageName) {
  const form = byId(`${pageName}Form`);
  const feedbackId = `${pageName}Feedback`;
  const statusElement = byId('authPageStatus');
  const apiInput = byId('apiBaseInput');

  syncBaseUrlLabels();
  syncSessionUi();

  if (apiInput) {
    apiInput.value = getBaseUrl();
  }

  if (statusElement) {
    statusElement.textContent = getToken() ? `Already signed in as ${getDisplayName()}` : 'Ready to authenticate';
  }

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFeedback(feedbackId, 'Sending request...');

    try {
      setBaseUrl(apiInput ? apiInput.value : getBaseUrl());
      const payload =
        pageName === 'login'
          ? {
              email: byId('loginEmail').value.trim(),
              password: byId('loginPassword').value,
            }
          : {
              fullName: byId('signupFullName').value.trim(),
              email: byId('signupEmail').value.trim(),
              password: byId('signupPassword').value,
            };

      const endpoint = pageName === 'login' ? 'login' : 'signup';
      const data = await apiRequest(endpoint, {
        auth: false,
        body: payload,
      });

      if (pageName === 'login') {
        const session = resolveSessionFromAuthResponse(data);
        const token = session.token || data?.data?.token || data?.token || '';
        const user = session.user || data?.data || data;
        if (token) {
          setSession(token, user);
        } else if (user) {
          localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
          syncSessionUi();
        }
        setFeedback(feedbackId, responseMessage(data, 'Login successful.'), 'success');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 650);
        return;
      }

      setFeedback(feedbackId, responseMessage(data, 'Account created successfully. Redirecting to login.'), 'success');
      setTimeout(() => {
        const url = new URL('login.html', window.location.href);
        url.searchParams.set('email', byId('signupEmail').value.trim());
        window.location.href = url.toString();
      }, 900);
    } catch (error) {
      setFeedback(feedbackId, error.message, 'error');
    }
  });

  const emailFromQuery = new URLSearchParams(window.location.search).get('email');
  if (emailFromQuery && pageName === 'login') {
    const emailInput = byId('loginEmail');
    if (emailInput) {
      emailInput.value = emailFromQuery;
    }
  }
}

function createRequestHandler({ formId, buildBody, endpointKey, label, resultLabel }) {
  const form = byId(formId);
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFeedback('responseFeedback', `Sending ${label.toLowerCase()} request...`);

    try {
      const body = buildBody();
      const data = await apiRequest(endpointKey, { body });
      const message = responseMessage(data, `${label} complete.`);
      revealResponsePanel();
      setFeedback('responseFeedback', message, 'success');
      setResponse(data);
      appendHistory(label, resultLabel(data));
      syncSessionUi();
    } catch (error) {
      const payload = { success: false, message: error.message };
      revealResponsePanel();
      setFeedback('responseFeedback', error.message, 'error');
      setResponse(payload);
      appendHistory(`${label} failed`, error.message);
    }
  });
}

function initDashboard() {
  syncBaseUrlLabels();
  syncSessionUi();
  syncBaseOverrideButtons();
  initHealthCheck();
  renderHistory();

  bindQuantitySelects('convertType', 'convertUnit', true);
  bindQuantitySelects('compareFirstType', 'compareFirstUnit', true);
  bindQuantitySelects('compareSecondType', 'compareSecondUnit', true);
  bindQuantitySelects('arithFirstType', 'arithFirstUnit', false);
  bindQuantitySelects('arithSecondType', 'arithSecondUnit', false);

  const convertTargetUnit = byId('convertTargetUnit');
  const compareTargetUnit = byId('compareTargetUnit');
  const arithTargetUnit = byId('arithTargetUnit');
  const convertType = byId('convertType');
  const compareFirstType = byId('compareFirstType');
  const arithFirstType = byId('arithFirstType');

  if (convertTargetUnit && convertType) {
    fillUnitSelect(convertTargetUnit, convertType.value);
    convertType.addEventListener('change', () => fillUnitSelect(convertTargetUnit, convertType.value));
  }

  if (compareTargetUnit && compareFirstType) {
    fillUnitSelect(compareTargetUnit, compareFirstType.value);
    compareFirstType.addEventListener('change', () => fillUnitSelect(compareTargetUnit, compareFirstType.value));
  }

  if (arithTargetUnit && arithFirstType) {
    fillUnitSelect(arithTargetUnit, arithFirstType.value);
    arithFirstType.addEventListener('change', () => fillUnitSelect(arithTargetUnit, arithFirstType.value));
  }

  const operationInput = byId('arithmeticOperation');
  const submitButton = byId('arithSubmit');

  if (operationInput && submitButton) {
    const syncOperationButton = () => {
      submitButton.textContent = `Perform ${formatMeasurementType(operationInput.value || 'add')}`;
    };

    syncOperationButton();
    operationInput.addEventListener('change', syncOperationButton);
  }

  createRequestHandler({
    formId: 'convertForm',
    endpointKey: 'convert',
    label: 'Convert',
    buildBody: () => ({
      sourceQuantity: readQuantity({
        valueId: 'convertValue',
        typeId: 'convertType',
        unitId: 'convertUnit',
        label: 'convert value',
      }),
      targetUnit: byId('convertTargetUnit').value,
    }),
    resultLabel: (data) => responseMessage(data, 'Conversion complete.'),
  });

  createRequestHandler({
    formId: 'compareForm',
    endpointKey: 'compare',
    label: 'Compare',
    buildBody: () => ({
      firstQuantity: readQuantity({
        valueId: 'compareFirstValue',
        typeId: 'compareFirstType',
        unitId: 'compareFirstUnit',
        label: 'first quantity',
      }),
      secondQuantity: readQuantity({
        valueId: 'compareSecondValue',
        typeId: 'compareSecondType',
        unitId: 'compareSecondUnit',
        label: 'second quantity',
      }),
      targetUnit: byId('compareTargetUnit').value,
    }),
    resultLabel: (data) => {
      const result = data?.data;
      if (typeof result === 'boolean') {
        return result ? 'First quantity is larger.' : 'Second quantity is larger or equal.';
      }
      return responseMessage(data, 'Comparison complete.');
    },
  });

  const arithmeticForm = byId('arithmeticForm');
  if (arithmeticForm) {
    arithmeticForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const operation = operationInput?.value || 'add';
      const endpointKey = operation;
      setFeedback('responseFeedback', `Sending ${operation} request...`);

      try {
        const data = await apiRequest(endpointKey, {
          body: {
            firstQuantity: readQuantity({
              valueId: 'arithFirstValue',
              typeId: 'arithFirstType',
              unitId: 'arithFirstUnit',
              label: 'first quantity',
            }),
            secondQuantity: readQuantity({
              valueId: 'arithSecondValue',
              typeId: 'arithSecondType',
              unitId: 'arithSecondUnit',
              label: 'second quantity',
            }),
            targetUnit: operation === 'divide' ? null : byId('arithTargetUnit').value,
          },
        });
        const prettyLabel = formatMeasurementType(operation);
        const message = responseMessage(data, `${prettyLabel} complete.`);
        revealResponsePanel();
        setFeedback('responseFeedback', message, 'success');
        setResponse(data);
        appendHistory(prettyLabel, message);
      } catch (error) {
        const prettyLabel = formatMeasurementType(operation);
        revealResponsePanel();
        setFeedback('responseFeedback', error.message, 'error');
        setResponse({ success: false, message: error.message });
        appendHistory(`${prettyLabel} failed`, error.message);
      }
    });
  }

  const clearHistoryButton = byId('clearHistoryBtn');
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', clearHistory);
  }
}

function initApp() {
  syncBaseUrlLabels();
  const page = document.body.getAttribute('data-page');

  if (page === 'auth') {
    initAuthPage(document.body.getAttribute('data-auth'));
    return;
  }

  if (page === 'dashboard') {
    initDashboard();
    return;
  }
}

document.addEventListener('DOMContentLoaded', initApp);
