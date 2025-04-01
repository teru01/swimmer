/**
 * Rust の Tauri コマンドを型安全に呼び出すためのラッパー関数を提供します。
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * サポートされている全ての Rust コマンドをラップしたオブジェクト
 */
export const commands = {
  /**
   * 挨拶メッセージを生成します
   */
  greet: (name: string): Promise<string> => {
    return invoke('greet', { name });
  },

  /**
   * 利用可能な Kubernetes コンテキストのリストを取得します
   */
  getKubeContexts: (): Promise<string[]> => {
    return invoke('get_kube_contexts');
  },
}; 
