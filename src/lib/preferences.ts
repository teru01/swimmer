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
  },
};
