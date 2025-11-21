import { z } from 'zod';

/**
 * アプリケーションの設定スキーマ
 */
export const PreferencesSchema = z.object({
  // UI設定
  ui: z.object({
    showAiChatPane: z.boolean().default(true),
  }),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

/**
 * デフォルトの設定値
 */
export const defaultPreferences: Preferences = {
  ui: {
    showAiChatPane: true,
  },
};
