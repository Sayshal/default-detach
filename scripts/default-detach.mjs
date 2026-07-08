import { DefaultDetachConfig } from './config.mjs';

/** @type {Map<string, string>} appId -> displayName */
const discoveredApps = new Map();

/** @type {Map<string, string>} typeKey -> label */
const discoveredTypes = new Map();

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

Hooks.once('init', () => {
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
