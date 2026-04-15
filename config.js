const defaultApiBaseUrl =
  window.__APP_ENV__?.API_BASE_URL || `${window.location.origin.replace(/\/+$/, '')}/api`;

window.APP_CONFIG = {
  defaultApiBaseUrl,
  apiBaseUrl: localStorage.getItem('qm.apiBaseUrl') || defaultApiBaseUrl,
  storageKeys: {
    token: 'qm.token',
    user: 'qm.user',
    history: 'qm.history',
    apiBaseUrl: 'qm.apiBaseUrl',
  },
  endpoints: {
    signup: '/Auth/signup',
    login: '/Auth/login',
    health: '/QuantityMeasurement/health',
    compare: '/QuantityMeasurement/compare',
    convert: '/QuantityMeasurement/convert',
    add: '/QuantityMeasurement/add',
    subtract: '/QuantityMeasurement/subtract',
    divide: '/QuantityMeasurement/divide',
  },
};

window.APP_UNITS = {
  length: ['Feet', 'Inches', 'Yards', 'Centimeters'],
  weight: ['Gram', 'Kilogram', 'Pound', 'Tonne'],
  volume: ['Litre', 'Millilitre', 'Gallon'],
  temperature: ['Celsius', 'Fahrenheit', 'Kelvin'],
};

window.APP_MEASUREMENT_TYPES = {
  all: ['length', 'weight', 'volume', 'temperature'],
  arithmetic: ['length', 'weight', 'volume'],
};
