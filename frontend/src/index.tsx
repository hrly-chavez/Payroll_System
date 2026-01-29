// index.tsx
import 'antd/dist/reset.css'; // for Ant Design v5+
import './index.css';
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
