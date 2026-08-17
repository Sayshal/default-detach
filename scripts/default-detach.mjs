import { DefaultDetachConfig } from './config.mjs';

/** @type {Map<string, string>} appId -> displayName */
const discoveredApps = new Map();

/** @type {Map<string, string>} typeKey -> label */
const discoveredTypes = new Map();

/** @enum {string} Hook events dispatched by this module. */
const HOOKS = { PRE_DETACH: 'default-detach.preDetach', DETACHED: 'default-detach.detached' };

/** @type {{app: string, type: string}} API kind -> the setting key backing it. */
const KIND_SETTINGS = { app: 'autoDetach', type: 'autoDetachTypes' };

/** @returns {Map<string, string>} The discovered apps registry. */
export function getDiscoveredApps() {
  return discoveredApps;
}

/** @returns {Map<string, string>} The discovered document-type registry. */
export function getDiscoveredTypes() {
  return discoveredTypes;
}

/**
 * Human-readable label for a document type, e.g. "Actor (Non-Player Character)".
 * @param {string} documentName - The document class name.
 * @param {string|null} subtype - The subtype, or null for the bare document.
 * @returns {string} The localized label.
 */
export function getTypeLabel(documentName, subtype) {
  const docLabel = _loc(getDocumentClass(documentName).metadata.label);
  if (!subtype) return docLabel;
  const key = CONFIG[documentName]?.typeLabels?.[subtype];
  return `${docLabel} (${key && game.i18n.has(key) ? _loc(key) : subtype})`;
}

/**
 * Derive the detach type key and label for a document.
 * @param {foundry.abstract.Document|null} doc - The application's document.
 * @returns {{key: string, label: string}|null} The type key and label, or null for non-document apps.
 */
export function getDocumentType(doc) {
  if (!doc) return null;
  const subtype = doc.constructor.hasTypeData && doc.type && doc.type !== CONST.BASE_DOCUMENT_TYPE ? doc.type : null;
  const key = subtype ? `${doc.documentName}/${subtype}` : doc.documentName;
  return { key, label: getTypeLabel(doc.documentName, subtype) };
}

/**
 * Persist an auto-detach list and refresh an open config dialog so its checkboxes stay current.
 * @param {string} kind - Either 'app' or 'type'.
 * @param {Array} entries - The new setting value.
 * @returns {Promise<void>}
 */
async function saveEntries(kind, entries) {
  await game.settings.set('default-detach', KIND_SETTINGS[kind], entries);
  foundry.applications.instances.get('default-detach-config')?.render();
}

/**
 * Add an app id or document-type key to its auto-detach list.
 * @param {string} id - The application id, or the document-type key for kind 'type'.
 * @param {string} [kind] - Either 'app' or 'type'.
 * @returns {Promise<void>}
 */
async function add(id, kind = 'app') {
  const current = game.settings.get('default-detach', KIND_SETTINGS[kind]);
  if (kind === 'type') {
    if (!current.includes(id)) await saveEntries(kind, [...current, id]);
    return;
  }
  if (current.some((entry) => entry.id === id)) return;
  await saveEntries(kind, [...current, { id, displayName: discoveredApps.get(id) || id }]);
}

/**
 * Remove an app id or document-type key from its auto-detach list.
 * @param {string} id - The application id, or the document-type key for kind 'type'.
 * @param {string} [kind] - Either 'app' or 'type'.
 * @returns {Promise<void>}
 */
async function remove(id, kind = 'app') {
  const current = game.settings.get('default-detach', KIND_SETTINGS[kind]);
  const next = kind === 'type' ? current.filter((key) => key !== id) : current.filter((entry) => entry.id !== id);
  if (next.length !== current.length) await saveEntries(kind, next);
}

/**
 * The current auto-detach selections.
 * @returns {{apps: Array<{id: string, displayName: string}>, types: string[]}} The saved apps and document-type keys.
 */
function list() {
  return { apps: game.settings.get('default-detach', 'autoDetach'), types: game.settings.get('default-detach', 'autoDetachTypes') };
}

Hooks.once('init', () => {
  const detachWindow = foundry.applications.api.ApplicationV2.prototype.detachWindow;
  foundry.applications.api.ApplicationV2.prototype.detachWindow = function (options = {}) {
    const type = getDocumentType(this.document);
    if (Hooks.call(HOOKS.PRE_DETACH, this, type) === false) return Promise.resolve(this);
    return detachWindow.call(this, options).then((app) => {
      Hooks.callAll(HOOKS.DETACHED, this, type);
      return app;
    });
  };
  ATLAS.register('default-detach', {
    title: 'Default Detach',
    github: 'Sayshal/default-detach',
    theme: { scope: '.default-detach' }
  });
  game.settings.register('default-detach', 'autoDetach', {
    name: 'DEFAULT_DETACH.Settings.ConfigName',
    hint: 'DEFAULT_DETACH.Settings.ConfigHint',
    scope: 'client',
    config: false,
    type: Array,
    default: []
  });
  game.settings.register('default-detach', 'autoDetachTypes', {
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

Hooks.once('ready', () => {
  game.modules.get('default-detach').api = { add, remove, list };
  for (const entry of ATLAS.getRegisteredModules().values()) {
    for (const app of entry.detachable) if (!discoveredApps.has(app.id)) discoveredApps.set(app.id, app.label);
  }
});

Hooks.on('renderApplicationV2', (app, _element, _context, options) => {
  if (app.hasFrame) discoveredApps.set(app.id, app.title || app.id);
  const type = getDocumentType(app.document);
  if (type) discoveredTypes.set(type.key, type.label);
  if (!options.isFirstRender) return;
  if (app.window.windowId) return;
  if (app.id === 'default-detach-config') return;
  if (!app._canDetach()) return;
  const autoDetach = game.settings.get('default-detach', 'autoDetach');
  const autoDetachTypes = game.settings.get('default-detach', 'autoDetachTypes');
  if (autoDetach.some((entry) => entry.id === app.id) || (type && autoDetachTypes.includes(type.key))) app.detachWindow();
});
