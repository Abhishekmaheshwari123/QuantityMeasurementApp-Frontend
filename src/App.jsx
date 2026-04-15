import React, { useEffect, useState } from 'react';
import { MEASUREMENT_TYPES, STORAGE_KEYS } from './config.js';
import {
  apiRequest,
  createEmptyResponse,
  createPendingResponse,
  createResponseViewModel,
  clearPersistedSession,
  formatMeasurementType,
  getBaseUrl,
  getDisplayName,
  getHistory,
  getToken,
  getUser,
  measurementTypesForSelect,
  readQuantity,
  responseMessage,
  resolveSessionFromAuthResponse,
  setBaseUrl,
  unitsForType,
} from './utils.js';

function firstUnitFor(type) {
  return unitsForType(type)[0] || '';
}

function parseHashRoute() {
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const [pathPart = '', queryPart = ''] = rawHash.split('?');
  const route = pathPart === 'login' || pathPart === 'signup' ? pathPart : 'dashboard';

  return {
    route,
    query: new URLSearchParams(queryPart),
  };
}

function useHashRoute() {
  const [routeState, setRouteState] = useState(() => parseHashRoute());

  useEffect(() => {
    const handleHashChange = () => setRouteState(parseHashRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return routeState;
}

function renderTypeOptions(includeTemperature = true) {
  return measurementTypesForSelect(includeTemperature).map((type) => (
    <option key={type} value={type}>
      {formatMeasurementType(type)}
    </option>
  ));
}

function renderUnitOptions(type) {
  return unitsForType(type).map((unit) => (
    <option key={unit} value={unit}>
      {unit}
    </option>
  ));
}

function useSessionState() {
  const [session, setSession] = useState(() => ({
    token: getToken(),
    user: getUser(),
  }));

  useEffect(() => {
    const syncSession = () =>
      setSession({
        token: getToken(),
        user: getUser(),
      });

    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  const updateSession = (nextSession) => {
    if (nextSession?.token) {
      window.localStorage.setItem(STORAGE_KEYS.token, nextSession.token);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.token);
    }

    if (nextSession?.user) {
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextSession.user));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.user);
    }

    setSession({
      token: nextSession?.token || '',
      user: nextSession?.user || null,
    });
  };

  const logout = () => {
    clearPersistedSession();
    setSession({ token: '', user: null });
    window.location.hash = '#/login';
  };

  return {
    session,
    updateSession,
    logout,
  };
}

function HeaderBar({ session, onLogout, mode = 'dashboard' }) {
  const hasSession = Boolean(session.token);
  const displayName = hasSession ? getDisplayName() : '';
  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : '?';

  return (
    <header className="top-strip">
      <p className="mini-tag">quantity measurement app</p>
      <div className="top-links">
        {hasSession ? (
          <>
            <div className="user-chip" aria-label="Signed in user profile">
              <span className="user-avatar">{initial}</span>
              <div className="user-chip-copy">
                <strong>{displayName}</strong>
                <span>Profile</span>
              </div>
            </div>
            <button type="button" className="button button-ghost" onClick={onLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            {mode === 'auth' ? (
              <a href="#/" className="button button-ghost">
                Dashboard
              </a>
            ) : null}
            <a href="#/login" className="button button-ghost">
              Login
            </a>
            <a href="#/signup" className="button button-primary">
              Sign up
            </a>
          </>
        )}
      </div>
    </header>
  );
}

function DashboardPage({ session, onLogout }) {
  const [history, setHistory] = useState(() => getHistory());
  const [health, setHealth] = useState({ state: 'warn', badge: 'Checking', message: 'Checking backend' });
  const [savedBaseUrl, setSavedBaseUrl] = useState(() => getBaseUrl());
  const [apiBaseDraft, setApiBaseDraft] = useState(() => getBaseUrl());
  const [response, setResponse] = useState(() => createEmptyResponse());

  const [convert, setConvert] = useState(() => {
    const type = MEASUREMENT_TYPES.all[0];
    const unit = firstUnitFor(type);
    return { value: '', type, unit, targetUnit: unit };
  });

  const [compare, setCompare] = useState(() => {
    const type = MEASUREMENT_TYPES.all[0];
    const unit = firstUnitFor(type);
    return {
      firstValue: '',
      secondValue: '',
      firstType: type,
      secondType: type,
      firstUnit: unit,
      secondUnit: unit,
      targetUnit: unit,
    };
  });

  const [arithmetic, setArithmetic] = useState(() => {
    const type = MEASUREMENT_TYPES.arithmetic[0];
    const unit = firstUnitFor(type);
    return {
      operation: 'add',
      firstValue: '',
      secondValue: '',
      firstType: type,
      secondType: type,
      firstUnit: unit,
      secondUnit: unit,
      targetUnit: unit,
    };
  });

  useEffect(() => {
    if (history.length) {
      window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.history);
  }, [history]);

  const runHealthCheck = async () => {
    setHealth({ state: 'warn', badge: 'Checking', message: 'Checking backend' });

    try {
      const data = await apiRequest('health', { auth: false, method: 'GET' });
      setHealth({ state: 'ok', badge: 'Online', message: responseMessage(data, 'Backend online') });
    } catch (error) {
      setHealth({ state: 'error', badge: 'Offline', message: error.message });
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const updateResponse = (data, fallbackMessage) => {
    setResponse(createResponseViewModel(data, fallbackMessage));
  };

  const appendHistory = (label, summary) => {
    setHistory((current) =>
      [
        {
          label,
          summary,
          time: new Date().toLocaleString(),
        },
        ...current,
      ].slice(0, 8),
    );
  };

  const submitMeasurementRequest = async ({ endpointKey, label, buildBody, resultLabel }) => {
    setResponse(createPendingResponse(`Sending ${label.toLowerCase()} request...`));

    try {
      const data = await apiRequest(endpointKey, {
        body: buildBody(),
      });

      const message = responseMessage(data, `${label} complete.`);
      updateResponse(data, `${label} complete.`);
      appendHistory(label, resultLabel ? resultLabel(data, message) : message);
    } catch (error) {
      const payload = { success: false, message: error.message };
      updateResponse(payload, error.message);
      appendHistory(`${label} failed`, error.message);
    }
  };

  const handleSaveBaseUrl = async (event) => {
    event.preventDefault();
    const normalized = setBaseUrl(apiBaseDraft);
    setApiBaseDraft(normalized);
    setSavedBaseUrl(normalized);
    await runHealthCheck();
  };

  const lastAction = history[0]?.label || 'No recent action';
  const sessionText = session.token ? `Signed in as ${getDisplayName()}` : 'Not signed in';

  return (
    <main className="screen shell-dashboard">
      <HeaderBar session={session} onLogout={onLogout} />

      <section className="hero-card">
        <div className="hero-copy">
          <h1>Convert, compare, and measure with confidence.</h1>
          <p>
            Connected to your QuantityMeasurement backend with JWT-protected operations. Choose any action below and
            fire requests instantly.
          </p>
          <div className="mini-pills">
            <span className="pill">{sessionText}</span>
            <span className="pill">{health.message}</span>
            <span className="pill">{lastAction}</span>
          </div>
        </div>
      </section>

      <section className="api-bar panel-card">
        <div className="api-bar-head">
          <div>
            <p className="response-kicker">Backend connection</p>
            <h3>API base URL</h3>
          </div>
          <span className={`status-badge ${health.state}`}>{health.badge}</span>
        </div>
        <form className="status-form" onSubmit={handleSaveBaseUrl}>
          <input
            aria-label="Backend API base URL"
            value={apiBaseDraft}
            onChange={(event) => setApiBaseDraft(event.target.value)}
            placeholder="Enter API base URL"
          />
          <button type="submit" className="button button-ghost">
            Save API URL
          </button>
        </form>
        <div className="status-foot">
          <span>{health.message}</span>
          <strong>{savedBaseUrl}</strong>
        </div>
      </section>

      <section className="panel-card operations-panel" id="operations">
        <div className="operation-block">
          <div className="card-head">
            <small>01</small>
            <h2>Convert</h2>
          </div>
          <form
            className="card-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitMeasurementRequest({
                endpointKey: 'convert',
                label: 'Convert',
                buildBody: () => ({
                  sourceQuantity: readQuantity({
                    value: convert.value,
                    measurementType: convert.type,
                    unit: convert.unit,
                    label: 'convert value',
                  }),
                  targetUnit: convert.targetUnit,
                }),
                resultLabel: (_, message) => message,
              });
            }}
          >
            <div className="row2">
              <input
                value={convert.value}
                onChange={(event) => setConvert((current) => ({ ...current, value: event.target.value }))}
                type="number"
                step="any"
                placeholder="Value"
                required
              />
              <select
                value={convert.type}
                onChange={(event) => {
                  const type = event.target.value;
                  const unit = firstUnitFor(type);
                  setConvert((current) => ({ ...current, type, unit, targetUnit: unit }));
                }}
              >
                {renderTypeOptions(true)}
              </select>
            </div>
            <div className="row2">
              <select
                value={convert.unit}
                onChange={(event) => setConvert((current) => ({ ...current, unit: event.target.value }))}
              >
                {renderUnitOptions(convert.type)}
              </select>
              <select
                value={convert.targetUnit}
                onChange={(event) => setConvert((current) => ({ ...current, targetUnit: event.target.value }))}
              >
                {renderUnitOptions(convert.type)}
              </select>
            </div>
            <button type="submit" className="button button-primary">
              Convert
            </button>
          </form>
        </div>

        <article className={`panel-card response-panel${response.visible ? '' : ' hidden'}`}>
          <div className="response-head">
            <div>
              <p className="response-kicker">Latest result</p>
              <h3>{response.title}</h3>
            </div>
            <span
              className={`response-badge${response.success === true ? ' success' : response.success === false ? ' error' : ''}`}
            >
              {response.status}
            </span>
          </div>
          <div className="feedback response-message">{response.message}</div>
          <div className="response-grid">
            {response.summary.map((item) => (
              <div key={item.label} className="response-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <div className="operation-block">
          <div className="card-head">
            <small>02</small>
            <h2>Compare</h2>
          </div>
          <form
            className="card-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitMeasurementRequest({
                endpointKey: 'compare',
                label: 'Compare',
                buildBody: () => ({
                  firstQuantity: readQuantity({
                    value: compare.firstValue,
                    measurementType: compare.firstType,
                    unit: compare.firstUnit,
                    label: 'first quantity',
                  }),
                  secondQuantity: readQuantity({
                    value: compare.secondValue,
                    measurementType: compare.secondType,
                    unit: compare.secondUnit,
                    label: 'second quantity',
                  }),
                  targetUnit: compare.targetUnit,
                }),
                resultLabel: (data) => {
                  const result = data?.data;
                  if (typeof result === 'boolean') {
                    return result ? 'First quantity is larger.' : 'Second quantity is larger or equal.';
                  }

                  return responseMessage(data, 'Comparison complete.');
                },
              });
            }}
          >
            <div className="row2">
              <input
                value={compare.firstValue}
                onChange={(event) => setCompare((current) => ({ ...current, firstValue: event.target.value }))}
                type="number"
                step="any"
                placeholder="First value"
                required
              />
              <input
                value={compare.secondValue}
                onChange={(event) => setCompare((current) => ({ ...current, secondValue: event.target.value }))}
                type="number"
                step="any"
                placeholder="Second value"
                required
              />
            </div>
            <div className="row2">
              <select
                value={compare.firstType}
                onChange={(event) => {
                  const type = event.target.value;
                  const unit = firstUnitFor(type);
                  setCompare((current) => ({ ...current, firstType: type, firstUnit: unit, targetUnit: unit }));
                }}
              >
                {renderTypeOptions(true)}
              </select>
              <select
                value={compare.secondType}
                onChange={(event) => {
                  const type = event.target.value;
                  const unit = firstUnitFor(type);
                  setCompare((current) => ({ ...current, secondType: type, secondUnit: unit }));
                }}
              >
                {renderTypeOptions(true)}
              </select>
            </div>
            <div className="row3">
              <select
                value={compare.firstUnit}
                onChange={(event) => setCompare((current) => ({ ...current, firstUnit: event.target.value }))}
              >
                {renderUnitOptions(compare.firstType)}
              </select>
              <select
                value={compare.secondUnit}
                onChange={(event) => setCompare((current) => ({ ...current, secondUnit: event.target.value }))}
              >
                {renderUnitOptions(compare.secondType)}
              </select>
              <select
                value={compare.targetUnit}
                onChange={(event) => setCompare((current) => ({ ...current, targetUnit: event.target.value }))}
              >
                {renderUnitOptions(compare.firstType)}
              </select>
            </div>
            <input type="text" value="Equal, greater, or less" readOnly />
            <button type="submit" className="button button-primary">
              Compare
            </button>
          </form>
        </div>

        <div className="operation-block">
          <div className="card-head">
            <small>03</small>
            <h2>Arithmetic</h2>
          </div>
          <form
            className="card-form"
            onSubmit={(event) => {
              event.preventDefault();
              const prettyLabel = formatMeasurementType(arithmetic.operation);
              submitMeasurementRequest({
                endpointKey: arithmetic.operation,
                label: prettyLabel,
                buildBody: () => ({
                  firstQuantity: readQuantity({
                    value: arithmetic.firstValue,
                    measurementType: arithmetic.firstType,
                    unit: arithmetic.firstUnit,
                    label: 'first quantity',
                  }),
                  secondQuantity: readQuantity({
                    value: arithmetic.secondValue,
                    measurementType: arithmetic.secondType,
                    unit: arithmetic.secondUnit,
                    label: 'second quantity',
                  }),
                  targetUnit: arithmetic.operation === 'divide' ? null : arithmetic.targetUnit,
                }),
                resultLabel: (data, message) => message,
              });
            }}
          >
            <select
              className="operation-select"
              aria-label="Arithmetic operation"
              value={arithmetic.operation}
              onChange={(event) => setArithmetic((current) => ({ ...current, operation: event.target.value }))}
            >
              <option value="add">Add</option>
              <option value="subtract">Subtract</option>
              <option value="divide">Divide</option>
            </select>
            <div className="row2">
              <input
                value={arithmetic.firstValue}
                onChange={(event) => setArithmetic((current) => ({ ...current, firstValue: event.target.value }))}
                type="number"
                step="any"
                placeholder="First value"
                required
              />
              <input
                value={arithmetic.secondValue}
                onChange={(event) => setArithmetic((current) => ({ ...current, secondValue: event.target.value }))}
                type="number"
                step="any"
                placeholder="Second value"
                required
              />
            </div>
            <div className="row2">
              <select
                value={arithmetic.firstType}
                onChange={(event) => {
                  const type = event.target.value;
                  const unit = firstUnitFor(type);
                  setArithmetic((current) => ({ ...current, firstType: type, firstUnit: unit, targetUnit: unit }));
                }}
              >
                {renderTypeOptions(false)}
              </select>
              <select
                value={arithmetic.secondType}
                onChange={(event) => {
                  const type = event.target.value;
                  const unit = firstUnitFor(type);
                  setArithmetic((current) => ({ ...current, secondType: type, secondUnit: unit }));
                }}
              >
                {renderTypeOptions(false)}
              </select>
            </div>
            <div className="row3">
              <select
                value={arithmetic.firstUnit}
                onChange={(event) => setArithmetic((current) => ({ ...current, firstUnit: event.target.value }))}
              >
                {renderUnitOptions(arithmetic.firstType)}
              </select>
              <select
                value={arithmetic.secondUnit}
                onChange={(event) => setArithmetic((current) => ({ ...current, secondUnit: event.target.value }))}
              >
                {renderUnitOptions(arithmetic.secondType)}
              </select>
              <select
                value={arithmetic.targetUnit}
                onChange={(event) => setArithmetic((current) => ({ ...current, targetUnit: event.target.value }))}
              >
                {renderUnitOptions(arithmetic.firstType)}
              </select>
            </div>
            <input type="text" value="Temperature is excluded from arithmetic" readOnly />
            <button type="submit" className="button button-primary">
              Perform {formatMeasurementType(arithmetic.operation)}
            </button>
          </form>
        </div>
      </section>

      <section className="result-grid">
        <article className="panel-card" id="history">
          <div className="panel-head-line">
            <h3>Recent actions</h3>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setHistory([]);
                setResponse(createEmptyResponse());
              }}
            >
              Clear
            </button>
          </div>
          <ul className="history-list">
            {!history.length ? (
              <li>
                <strong>No requests yet</strong>
                <small>Your latest conversions and comparisons will appear here.</small>
              </li>
            ) : (
              history.map((entry, index) => (
                <li key={`${entry.label}-${entry.time}-${index}`}>
                  <strong>{entry.label}</strong>
                  <small>{entry.time}</small>
                  <small>{entry.summary}</small>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </main>
  );
}

function AuthPage({ mode, queryEmail = '', session, onLogout, onAuthSuccess }) {
  const isLogin = mode === 'login';
  const [savedBaseUrl, setSavedBaseUrl] = useState(() => getBaseUrl());
  const [apiBaseDraft, setApiBaseDraft] = useState(() => getBaseUrl());
  const [feedback, setFeedback] = useState('');
  const [feedbackState, setFeedbackState] = useState('');
  const [form, setForm] = useState(() => ({
    fullName: '',
    email: isLogin ? queryEmail : '',
    password: '',
  }));

  useEffect(() => {
    if (isLogin) {
      setForm((current) => ({
        ...current,
        email: queryEmail || current.email,
      }));
    }
  }, [isLogin, queryEmail]);

  const alreadySignedIn = Boolean(session.token);
  const authStatusText = alreadySignedIn ? `Already signed in as ${getDisplayName()}` : 'Ready to authenticate';

  const saveApiBase = (event) => {
    event.preventDefault();
    const normalized = setBaseUrl(apiBaseDraft);
    setApiBaseDraft(normalized);
    setSavedBaseUrl(normalized);
    setFeedback(`Backend URL saved: ${normalized}`);
    setFeedbackState('success');
  };

  const submitAuthForm = async (event) => {
    event.preventDefault();
    setFeedback('Sending request...');
    setFeedbackState('');

    try {
      const endpointKey = isLogin ? 'login' : 'signup';
      const payload = isLogin
        ? {
            email: form.email.trim(),
            password: form.password,
          }
        : {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            password: form.password,
          };

      const data = await apiRequest(endpointKey, {
        auth: false,
        body: payload,
      });

      if (isLogin) {
        const session = resolveSessionFromAuthResponse(data);
        const token = session.token || data?.data?.token || data?.token || '';
        const user = session.user || data?.data || data;

        if (token) {
          onAuthSuccess({ token, user });
        } else if (user) {
          onAuthSuccess({ token: '', user });
        }

        setFeedback(responseMessage(data, 'Login successful.'));
        setFeedbackState('success');
        window.location.hash = '#/';
        return;
      }

      const session = resolveSessionFromAuthResponse(data);
      const token = session.token || data?.data?.token || data?.token || '';
      const user = session.user || data?.data || data;

      if (token) {
        onAuthSuccess({ token, user });
      }

      setFeedback(responseMessage(data, token ? 'Account created successfully.' : 'Account created successfully. Redirecting to login.'));
      setFeedbackState('success');
      setTimeout(() => {
        if (token) {
          window.location.hash = '#/';
          return;
        }

        window.location.hash = `#/login?email=${encodeURIComponent(form.email.trim())}`;
      }, 900);
    } catch (error) {
      setFeedback(error.message);
      setFeedbackState('error');
    }
  };

  return (
    <main className="screen auth-shell">
      <HeaderBar session={session} onLogout={onLogout} mode="auth" />
      <section className="auth-left">
        <p className="mini-tag">{isLogin ? 'login' : 'signup'}</p>
        <h1>{isLogin ? 'Welcome back.' : 'Create your account.'}</h1>
        <p>
          {isLogin
            ? 'Access your measurement dashboard quickly, securely, and from anywhere.'
            : 'Register once and access conversion, comparison, and arithmetic endpoints with JWT auth.'}
        </p>
        <div className="auth-stats">
          <span>{authStatusText}</span>
          <span>
            {isLogin ? 'Use the same email you used during signup' : 'Password must be at least 8 characters'}
          </span>
        </div>
      </section>

      <section className="auth-right">
        <section className="api-card">
          <h3>Backend URL</h3>
          <form className="status-form" onSubmit={saveApiBase}>
            <input
              aria-label="Backend API base URL"
              value={apiBaseDraft}
              onChange={(event) => setApiBaseDraft(event.target.value)}
              placeholder="Enter API base URL"
            />
            <button type="submit" className="button button-ghost">
              Save
            </button>
          </form>
          <div className="status-foot">
            <span>Current endpoint root</span>
            <strong>{savedBaseUrl}</strong>
          </div>
        </section>

        <form className="auth-form-card" onSubmit={submitAuthForm}>
          {!isLogin ? (
            <>
              <label htmlFor="signupFullName">Full name</label>
              <input
                id="signupFullName"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                type="text"
                placeholder="Alex Johnson"
                required
              />
            </>
          ) : null}

          <label htmlFor={isLogin ? 'loginEmail' : 'signupEmail'}>Email address</label>
          <input
            id={isLogin ? 'loginEmail' : 'signupEmail'}
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            type="email"
            placeholder="you@example.com"
            required
          />

          <label htmlFor={isLogin ? 'loginPassword' : 'signupPassword'}>Password</label>
          <input
            id={isLogin ? 'loginPassword' : 'signupPassword'}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            type="password"
            placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
            required
            minLength={isLogin ? undefined : 8}
          />

          <div className="auth-actions">
            <button className="button button-primary" type="submit">
              {isLogin ? 'Login' : 'Sign up'}
            </button>
            <a href={isLogin ? '#/signup' : '#/login'} className="button button-ghost">
              {isLogin ? 'Create account' : 'Login'}
            </a>
          </div>
          <div className={`feedback${feedbackState ? ` ${feedbackState}` : ''}`}>{feedback}</div>
          <a href="#/" className="back-link">
            Back to dashboard
          </a>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const { session, updateSession, logout } = useSessionState();
  const { route, query } = useHashRoute();

  if (route === 'login') {
    return (
      <AuthPage
        mode="login"
        queryEmail={query.get('email') || ''}
        session={session}
        onLogout={logout}
        onAuthSuccess={updateSession}
      />
    );
  }

  if (route === 'signup') {
    return <AuthPage mode="signup" session={session} onLogout={logout} onAuthSuccess={updateSession} />;
  }

  return <DashboardPage session={session} onLogout={logout} />;
}
