import { z } from 'zod';

/**
 * アプリケーションの設定スキーマ
 */
export const PreferencesSchema = z.object({
  // UI設定
  ui: z.object({
    showAiChatPane: z.boolean().default(false),
  }),
  // Terminal設定
  terminal: z.object({
    shellPath: z.string().default('/bin/zsh'),
    theme: z.object({
      background: z.string().default('#1e1e1e'),
      foreground: z.string().default('#d4d4d4'),
      cursor: z.string().default('#ffffff'),
      black: z.string().default('#000000'),
      red: z.string().default('#cd3131'),
      green: z.string().default('#0dbc79'),
      yellow: z.string().default('#e5e510'),
      blue: z.string().default('#2472c8'),
      magenta: z.string().default('#bc3fbc'),
      cyan: z.string().default('#11a8cd'),
      white: z.string().default('#e5e5e5'),
      brightBlack: z.string().default('#666666'),
      brightRed: z.string().default('#f14c4c'),
      brightGreen: z.string().default('#23d18b'),
      brightYellow: z.string().default('#f5f543'),
      brightBlue: z.string().default('#3b8eea'),
      brightMagenta: z.string().default('#d670d6'),
      brightCyan: z.string().default('#29b8db'),
      brightWhite: z.string().default('#e5e5e5'),
    }),
    fontSize: z.number().default(12),
    fontFamily: z.string().default('Menlo, Monaco, "Courier New", monospace'),
  }),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

/**
 * デフォルトの設定値
 */
export const defaultPreferences: Preferences = {
  ui: {
    showAiChatPane: false,
  },
  terminal: {
    shellPath: '/bin/zsh',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5',
    },
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
};
