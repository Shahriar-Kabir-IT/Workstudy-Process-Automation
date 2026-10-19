// Load runtime configuration FIRST (public/config/config.json), then mount the app.
// This lets config changes take effect without touching component code.
import { loadConfig } from './config.js'

loadConfig().finally(() => { import('./bootstrap.jsx') })
