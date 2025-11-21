import { ContextNode } from './contextTree';
import { Preferences, PreferencesSchema, defaultPreferences } from './preferences';
import * as yaml from 'yaml';

export const STORAGE_KEY = 'swimmer.contextTree';
export const PREFERENCES_STORAGE_KEY = 'swimmer.preferences';

// Mock file system operations
export const mockFs = {
  // Read file from local storage
  readTextFile: async (_path: string): Promise<string> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) throw new Error('Configuration not found');
    return stored;
  },

  // Write file to local storage
  writeTextFile: async (_path: string, content: string): Promise<void> => {
    localStorage.setItem(STORAGE_KEY, content);
  },

  // Create directory (mock - no operation needed)
  createDir: async (_path: string, _options?: { recursive: boolean }): Promise<void> => {
    return;
  },
};

// Save configuration
export const saveConfig = async (config: {
  contextTree: ContextNode[];
  lastSelectedContext?: ContextNode;
  tags: string[];
}) => {
  try {
    const configYaml = yaml.stringify(config);
    await mockFs.writeTextFile(STORAGE_KEY, configYaml);
  } catch (err) {
    console.error('Error saving config:', err);
    throw new Error('Failed to save configuration');
  }
};

// Load preferences
export const loadPreferences = async (): Promise<Preferences> => {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(stored);
    return PreferencesSchema.parse(parsed);
  } catch (err) {
    console.error('Error loading preferences:', err);
    return defaultPreferences;
  }
};

// Save preferences
export const savePreferences = async (preferences: Preferences): Promise<void> => {
  try {
    const json = JSON.stringify(preferences, null, 2);
    localStorage.setItem(PREFERENCES_STORAGE_KEY, json);
  } catch (err) {
    console.error('Error saving preferences:', err);
    throw new Error('Failed to save preferences');
  }
};
