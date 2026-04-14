# QuantityMeasurementApp-Frontend

Static frontend for the QuantityMeasurementApp backend.

## Files

- `index.html` - dashboard for convert, compare, and arithmetic requests
- `login.html` - JWT login form
- `signup.html` - account creation form
- `styles.css` - shared UI styling
- `config.js` - backend URL and endpoint configuration
- `app.js` - API calls, auth state, and local history

## Backend Connection

The frontend targets the backend API at `http://localhost:5044/api` by default.

You can change the API base URL from the UI on the dashboard or the auth pages, and the value is saved in localStorage.

## Run Locally

Serve this folder with any static file server, then open `index.html` in the browser.

Examples:

- VS Code Live Server
- `python -m http.server 5500`

## Expected Backend Routes

- `POST /api/Auth/signup`
- `POST /api/Auth/login`
- `GET /api/QuantityMeasurement/health`
- `POST /api/QuantityMeasurement/convert`
- `POST /api/QuantityMeasurement/compare`
- `POST /api/QuantityMeasurement/add`
- `POST /api/QuantityMeasurement/subtract`
- `POST /api/QuantityMeasurement/divide`