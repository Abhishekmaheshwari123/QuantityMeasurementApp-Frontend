export const DEFAULT_API_BASE_URL = 'http://localhost:5044/api';

export const STORAGE_KEYS = {
  token: 'qm.token',
  user: 'qm.user',
  history: 'qm.history',
  apiBaseUrl: 'qm.apiBaseUrl',
};

export const ENDPOINTS = {
  signup: '/Auth/signup',
  login: '/Auth/login',
  health: '/QuantityMeasurement/health',
  compare: '/QuantityMeasurement/compare',
  convert: '/QuantityMeasurement/convert',
  add: '/QuantityMeasurement/add',
  subtract: '/QuantityMeasurement/subtract',
  divide: '/QuantityMeasurement/divide',
};

export const UNITS = {
  length: ['Feet', 'Inches', 'Yards', 'Centimeters'],
  weight: ['Gram', 'Kilogram', 'Pound', 'Tonne'],
  volume: ['Litre', 'Millilitre', 'Gallon'],
  temperature: ['Celsius', 'Fahrenheit', 'Kelvin'],
};

export const MEASUREMENT_TYPES = {
  all: ['length', 'weight', 'volume', 'temperature'],
  arithmetic: ['length', 'weight', 'volume'],
};
