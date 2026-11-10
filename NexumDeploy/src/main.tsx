import './istrong/istrong.css';
import './tailwind.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GlobalTips } from './istrong/components/shared/HelpTooltip';
import { applyTheme, getStoredTheme } from './istrong/utils/theme';

applyTheme(getStoredTheme(), false);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
const tips = document.createElement('div');
tips.id = 'k-tips-root';
document.body.appendChild(tips);
ReactDOM.createRoot(tips).render(<React.StrictMode><GlobalTips /></React.StrictMode>);
