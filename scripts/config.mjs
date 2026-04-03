import { getDiscoveredApps } from './default-detach.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Configuration dialog for Default Detach. */
export class DefaultDetachConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'default-detach-config',
    tag: 'form',
    window: { title: 'DEFAULT_DETACH.Config.Title', icon: 'fa-solid fa-arrow-up-right-from-square', resizable: true },
    position: { width: 480, height: 'auto' },
    form: { closeOnSubmit: true, handler: DefaultDetachConfig.#onSubmit }
  };

  /** @override */
  static PARTS = {
    form: { template: 'modules/default-detach/templates/config.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };

  /** @override */
  async _prepareContext(_options) {
    const autoDetach = game.settings.get('default-detach', 'autoDetach');
    const saved = new Map(autoDetach.map((entry) => [entry.id, entry.displayName]));
    const discovered = getDiscoveredApps();
    const merged = new Map([...saved, ...discovered]);
    const apps = [];
    for (const [id, displayName] of merged) apps.push({ id, displayName, checked: saved.has(id) });
    apps.sort((a, b) => a.displayName.localeCompare(b.displayName));
    const buttons = [{ type: 'submit', icon: 'fa-solid fa-save', label: 'DEFAULT_DETACH.Config.Save' }];
    return { apps, hasApps: apps.length > 0, buttons };
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
    for (const [id, value] of Object.entries(formData.object)) if (value === true) selected.push({ id, displayName: discovered.get(id) || oldNames.get(id) || id });
    await game.settings.set('default-detach', 'autoDetach', selected);
  }
}
