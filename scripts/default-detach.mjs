import { DefaultDetachConfig } from './config.mjs';

/** @type {Map<string, string>} appId -> displayName */
const discoveredApps = new Map();

/** @returns {Map<string, string>} The discovered apps registry. */
export function getDiscoveredApps() {
  return discoveredApps;
}

Hooks.once('init', () => {
  game.settings.register('default-detach', 'autoDetach', {
    name: 'DEFAULT_DETACH.Settings.ConfigName',
    hint: 'DEFAULT_DETACH.Settings.ConfigHint',
    scope: 'client',
    config: false,
    type: Array,
    default: []
  });

  game.settings.registerMenu('default-detach', 'configMenu', {
    name: 'DEFAULT_DETACH.Settings.ConfigName',
    label: 'DEFAULT_DETACH.Settings.ConfigLabel',
    hint: 'DEFAULT_DETACH.Settings.ConfigHint',
    icon: 'fa-solid fa-arrow-up-right-from-square',
    type: DefaultDetachConfig,
    restricted: false
  });
});

Hooks.on('renderApplicationV2', (app, _element, _context, options) => {
  if (app.hasFrame) discoveredApps.set(app.id, app.title || app.id);
  if (!options.isFirstRender) return;
  if (app.window.windowId) return;
  if (app.id === 'default-detach-config') return;
  if (!app._canDetach()) return;
  const autoDetach = game.settings.get('default-detach', 'autoDetach');
  if (autoDetach.some((entry) => entry.id === app.id)) app.detachWindow();
});
