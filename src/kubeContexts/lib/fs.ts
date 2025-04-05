import { useCallback } from 'react';
import { ContextNode } from './contextTree';
import * as yaml from 'yaml';

export const STORAGE_KEY = 'swimmer.contextTree';

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
  lastSelectedContext?: string;
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
