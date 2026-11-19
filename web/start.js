// Starts whichever page loaded it. supabase.js (Supabase's own browser build,
// copied here so the pages load nothing from other sites) sets window.supabase.
import { settings } from './settings.js';
import { startConfirmPage, startResetPage } from './pages.js';

const deps = { createClient: window.supabase.createClient, settings };
document.querySelector('[data-app-name]').textContent = settings.APP_NAME;

if (document.body.dataset.page === 'confirm') startConfirmPage(document, window, deps);
if (document.body.dataset.page === 'reset') startResetPage(document, window, deps);
