import { DEFAULT_API_BASE_URL, ENDPOINTS, MEASUREMENT_TYPES, STORAGE_KEYS, UNITS } from './config.js';

export function normalizeBaseUrl(value) {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');

  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }

  if (trimmed.endsWith('/api')) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

export function getBaseUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  return normalizeBaseUrl(window.localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || DEFAULT_API_BASE_URL);
}

export function setBaseUrl(value) {
  if (typeof window === 'undefined') {
    return normalizeBaseUrl(value);
  }

  const normalized = normalizeBaseUrl(value);
  window.localStorage.setItem(STORAGE_KEYS.apiBaseUrl, normalized);
  return normalized;
}

export function getToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(STORAGE_KEYS.token) || '';
}

export function getUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setPersistedSession(token, user) {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem(STORAGE_KEYS.token, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.token);
  }

  if (user) {
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.user);
  }
}

export function clearPersistedSession() {
  setPersistedSession('', null);
}

export function getHistory() {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.history);
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

export function formatMeasurementType(type) {
  if (!type) {
    return '';
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function measurementTypesForSelect(includeTemperature = true) {
  return includeTemperature ? MEASUREMENT_TYPES.all : MEASUREMENT_TYPES.arithmetic;
}

export function unitsForType(type) {
  return UNITS[type] || [];
}

export function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.');
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

export function getDisplayName() {
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

export function responseMessage(data, fallback) {
  if (data && typeof data === 'object') {
    return data.message || data.Message || fallback;
  }

  return fallback;
}

export function formatResponseValue(value) {
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

export function createEmptyResponse() {
  return {
    visible: false,
    success: null,
    title: 'Response',
    status: 'Waiting',
    message: 'Submit a form to see the backend response.',
    summary: [],
  };
}

export function createPendingResponse(message) {
  return {
    visible: true,
    success: null,
    title: 'Response',
    status: 'Waiting',
    message,
    summary: [],
  };
}

export function createResponseViewModel(data, fallbackMessage = 'No message available.') {
  const success = Boolean(data?.success);
  const payload = data?.data;
  const summary = [{ label: 'Message', value: responseMessage(data, fallbackMessage) }];

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if ('value' in payload) {
      summary.push({ label: 'Value', value: formatResponseValue(payload.value) });
    }

    if ('unit' in payload) {
      summary.push({ label: 'Unit', value: formatResponseValue(payload.unit) });
    }

    if ('measurementType' in payload) {
      summary.push({ label: 'Type', value: formatResponseValue(payload.measurementType) });
    }

    if ('result' in payload) {
      summary.push({ label: 'Result', value: formatResponseValue(payload.result) });
    }
  } else if (payload !== undefined && payload !== null) {
    summary.push({ label: 'Result', value: formatResponseValue(payload) });
  }

  return {
    visible: true,
    success,
    title: success ? 'Operation completed' : 'Operation failed',
    status: success ? 'Success' : 'Error',
    message: responseMessage(data, fallbackMessage),
    summary,
  };
}

export function resolveSessionFromAuthResponse(data) {
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

export function readQuantity({ value, measurementType, unit, label }) {
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Enter a valid number for ${label}.`);
  }

  return {
    value: parsedValue,
    measurementType,
    unit,
  };
}

export async function readResponseBody(response) {
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

export async function apiRequest(endpointKey, options = {}) {
  const endpoint = ENDPOINTS[endpointKey];

  if (!endpoint) {
    throw new Error(`Unknown endpoint: ${endpointKey}`);
  }

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

  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
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
