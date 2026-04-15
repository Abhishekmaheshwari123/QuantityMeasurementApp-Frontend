# Quantity Measurement App

React frontend for the QuantityMeasurement backend, built with Vite.

## Environment

Create a `.env` file in the project root:

VITE_API_BASE_URL=http://localhost:5044/api

## Run Locally

1. Install dependencies with `npm install`.
2. Start the app with `npm run dev`.
3. Open the local Vite URL in your browser.

## Project Files

- `index.html` is now the React mount page.
- `src/App.jsx` contains the dashboard, login, and signup screens.
- `src/utils.js` handles API calls, localStorage, and response formatting.
- `styles.css` still provides the shared visual system for the React UI.

## Legacy Entry Points

`login.html` and `signup.html` now redirect into the React router so old bookmarks still work.

## Backend Routes

- `POST /api/Auth/signup`
- `POST /api/Auth/login`
- `GET /api/QuantityMeasurement/health`
- `POST /api/QuantityMeasurement/convert`
- `POST /api/QuantityMeasurement/compare`
- `POST /api/QuantityMeasurement/add`
- `POST /api/QuantityMeasurement/subtract`
- `POST /api/QuantityMeasurement/divide`