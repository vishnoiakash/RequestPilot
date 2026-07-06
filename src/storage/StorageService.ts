import type { AnyRule, Environment, Settings, HistoryEntry, ExportSchema } from '../models/types.js';
import { STORAGE_KEYS } from '../models/types.js';

// ============================================================
// Default Settings — used on first install and after reset
// ============================================================

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultEnvironmentId: null,
  autoBackup: false,
  extensionEnabled: true,
};

// ============================================================
// Storage Service
// ============================================================

export class StorageService {
  private static instance: StorageService;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // ----------------------------------------------------------
  // Initialization — seeds empty state on first install
  // ----------------------------------------------------------

  async initialize(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.INITIALIZED);
    if (!result[STORAGE_KEYS.INITIALIZED]) {
      await this.initEmpty();
      await chrome.storage.local.set({ [STORAGE_KEYS.INITIALIZED]: true });
    }
  }

  private async initEmpty(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.RULES]:        [],
      [STORAGE_KEYS.ENVIRONMENTS]: [],
      [STORAGE_KEYS.HISTORY]:      [],
    });
    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    });
  }

  // ----------------------------------------------------------
  // Rules
  // ----------------------------------------------------------

  async getRules(): Promise<AnyRule[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.RULES);
    return (result[STORAGE_KEYS.RULES] as AnyRule[]) || [];
  }

  async saveRule(rule: AnyRule): Promise<void> {
    const rules = await this.getRules();
    const now = new Date().toISOString();
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = { ...rule, updatedAt: now };
    } else {
      rules.push({ ...rule, id: rule.id || crypto.randomUUID(), createdAt: now, updatedAt: now });
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
    await this.maybeAutoBackup();
  }

  async deleteRule(id: string): Promise<void> {
    const rules = await this.getRules();
    await chrome.storage.local.set({
      [STORAGE_KEYS.RULES]: rules.filter((r) => r.id !== id),
    });
  }

  async duplicateRule(id: string): Promise<AnyRule | null> {
    const rules = await this.getRules();
    const rule = rules.find((r) => r.id === id);
    if (!rule) return null;
    const now = new Date().toISOString();
    const copy: AnyRule = {
      ...rule,
      id: crypto.randomUUID(),
      name: `${rule.name} (Copy)`,
      enabled: false,
      createdAt: now,
      updatedAt: now,
    } as AnyRule;
    rules.push(copy);
    await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
    return copy;
  }

  async toggleRule(id: string, enabled: boolean): Promise<void> {
    const rules = await this.getRules();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rules[idx] = { ...rules[idx], enabled, updatedAt: new Date().toISOString() };
      await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
    }
  }

  // ----------------------------------------------------------
  // Environments
  // ----------------------------------------------------------

  async getEnvironments(): Promise<Environment[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ENVIRONMENTS);
    return (result[STORAGE_KEYS.ENVIRONMENTS] as Environment[]) || [];
  }

  async saveEnvironment(env: Environment): Promise<void> {
    const envs = await this.getEnvironments();
    const idx = envs.findIndex((e) => e.id === env.id);
    if (idx >= 0) {
      envs[idx] = env;
    } else {
      envs.push({ ...env, id: env.id || crypto.randomUUID() });
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.ENVIRONMENTS]: envs });
  }

  async deleteEnvironment(id: string): Promise<void> {
    let envs = await this.getEnvironments();
    const wasActive = envs.find((e) => e.id === id)?.isActive ?? false;
    envs = envs.filter((e) => e.id !== id);
    if (wasActive && envs.length > 0) {
      envs[0].isActive = true;
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.ENVIRONMENTS]: envs });
  }

  async setActiveEnvironment(id: string): Promise<void> {
    const envs = await this.getEnvironments();
    envs.forEach((e) => { e.isActive = e.id === id; });
    await chrome.storage.local.set({ [STORAGE_KEYS.ENVIRONMENTS]: envs });
  }

  async getActiveEnvironment(): Promise<Environment | null> {
    const envs = await this.getEnvironments();
    return envs.find((e) => e.isActive) ?? null;
  }

  // ----------------------------------------------------------
  // Settings
  // ----------------------------------------------------------

  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return (result[STORAGE_KEYS.SETTINGS] as Settings) || DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
  }

  // ----------------------------------------------------------
  // History
  // ----------------------------------------------------------

  async getHistory(): Promise<HistoryEntry[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    return (result[STORAGE_KEYS.HISTORY] as HistoryEntry[]) || [];
  }

  async clearHistory(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
  }

  async addHistoryEntry(entry: HistoryEntry): Promise<void> {
    const history = await this.getHistory();
    const updated = [entry, ...history].slice(0, 500);
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
  }

  // ----------------------------------------------------------
  // Import / Export
  // ----------------------------------------------------------

  async exportAll(): Promise<ExportSchema> {
    const [rules, environments] = await Promise.all([
      this.getRules(),
      this.getEnvironments(),
    ]);
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      rules,
      environments,
    };
  }

  async importAll(data: ExportSchema, mode: 'merge' | 'replace'): Promise<void> {
    if (mode === 'replace') {
      await chrome.storage.local.set({
        [STORAGE_KEYS.RULES]:        data.rules,
        [STORAGE_KEYS.ENVIRONMENTS]: data.environments,
      });
    } else {
      const [existing, existingEnvs] = await Promise.all([
        this.getRules(),
        this.getEnvironments(),
      ]);
      const mergedRules = [...existing];
      data.rules.forEach((r) => {
        if (!mergedRules.find((e) => e.id === r.id)) mergedRules.push(r);
      });
      const mergedEnvs = [...existingEnvs];
      data.environments.forEach((e) => {
        if (!mergedEnvs.find((x) => x.id === e.id)) mergedEnvs.push(e);
      });
      await chrome.storage.local.set({
        [STORAGE_KEYS.RULES]:        mergedRules,
        [STORAGE_KEYS.ENVIRONMENTS]: mergedEnvs,
      });
    }
  }

  async resetToDefaults(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await this.initEmpty();
    await chrome.storage.local.set({ [STORAGE_KEYS.INITIALIZED]: true });
  }

  // ----------------------------------------------------------
  // Auto Backup
  // ----------------------------------------------------------

  private async maybeAutoBackup(): Promise<void> {
    const settings = await this.getSettings();
    if (settings.autoBackup) {
      const snapshot = await this.exportAll();
      await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_BACKUP]: snapshot });
    }
  }
}

export const storageService = StorageService.getInstance();
