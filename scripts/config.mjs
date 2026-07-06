import { getDiscoveredApps, getDiscoveredTypes, getTypeLabel } from './default-detach.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** World documents worth pre-seeding into the Types tab; anything else surfaces via discovery when opened. */
const SEED_DOCS = ['Actor', 'Item', 'JournalEntry', 'Cards', 'Folder'];

/**
 * Build the pre-populated document-type registry for the seed documents.
 * @returns {Map<string, string>} typeKey -> label
 */
function getConfigTypes() {
  const out = new Map();
  for (const documentName of SEED_DOCS) {
    const cls = CONFIG[documentName]?.documentClass;
    if (!cls) continue;
    const subtypes = cls.hasTypeData ? (game.documentTypes[documentName] ?? []).filter((t) => t !== CONST.BASE_DOCUMENT_TYPE) : [];
    if (!subtypes.length) {
      out.set(documentName, getTypeLabel(documentName, null));
      continue;
    }
    for (const subtype of subtypes) out.set(`${documentName}/${subtype}`, getTypeLabel(documentName, subtype));
  }
  return out;
}

/** Configuration dialog for Default Detach. */
export class DefaultDetachConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'default-detach-config',
    tag: 'form',
    classes: ['default-detach'],
    window: { title: 'DEFAULT_DETACH.Config.Title', icon: 'fa-solid fa-arrow-up-right-from-square', resizable: true },
    position: { width: 380, height: 600 },
    form: { closeOnSubmit: true, handler: DefaultDetachConfig.#onSubmit }
  };

  /** @override */
  static PARTS = {
    tabs: { template: 'modules/default-detach/templates/tabs.hbs' },
    types: { template: 'modules/default-detach/templates/types.hbs' },
    apps: { template: 'modules/default-detach/templates/apps.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };

  /** @override */
  static TABS = {
    primary: {
      initial: 'types',
      tabs: [
        { id: 'types', icon: 'fa-solid fa-shapes', label: 'DEFAULT_DETACH.Config.TypeSectionTitle' },
        { id: 'apps', icon: 'fa-solid fa-window-restore', label: 'DEFAULT_DETACH.Config.AppSectionTitle' }
      ]
    }
  };

  /** @override */
  async _prepareContext(_options) {
    const autoDetach = game.settings.get('default-detach', 'autoDetach');
    const saved = new Map(autoDetach.map((entry) => [entry.id, entry.displayName]));
    const merged = new Map([...saved, ...getDiscoveredApps()]);
    const apps = [];
    for (const [id, displayName] of merged) apps.push({ id, displayName, checked: saved.has(id) });
    apps.sort((a, b) => a.displayName.localeCompare(b.displayName));
    const autoDetachTypes = game.settings.get('default-detach', 'autoDetachTypes');
    const mergedTypes = new Map([...getConfigTypes(), ...getDiscoveredTypes()]);
    for (const key of autoDetachTypes) if (!mergedTypes.has(key)) mergedTypes.set(key, key);
    const types = [];
    for (const [key, label] of mergedTypes) types.push({ key, label, checked: autoDetachTypes.includes(key) });
    types.sort((a, b) => a.label.localeCompare(b.label));
    const buttons = [{ type: 'submit', icon: 'fa-solid fa-save', label: 'DEFAULT_DETACH.Config.Save' }];
    return { tabs: this._prepareTabs('primary'), apps, hasApps: apps.length > 0, types, hasTypes: types.length > 0, buttons };
  }

  /**
   * @param {SubmitEvent} _event - The form submission event.
   * @param {HTMLFormElement} _form - The form element.
   * @param {object} formData - The parsed form data.
   */
  static async #onSubmit(_event, _form, formData) {
    const discovered = getDiscoveredApps();
    const saved = game.settings.get('default-detach', 'autoDetach');
    const oldNames = new Map(saved.map((entry) => [entry.id, entry.displayName]));
    const selected = [];
    const selectedTypes = [];
    for (const [key, value] of Object.entries(formData.object)) {
      if (value !== true) continue;
      if (key.startsWith('type:')) selectedTypes.push(key.slice(5));
      else selected.push({ id: key, displayName: discovered.get(key) || oldNames.get(key) || key });
    }
    await game.settings.set('default-detach', 'autoDetach', selected);
    await game.settings.set('default-detach', 'autoDetachTypes', selectedTypes);
  }
}
