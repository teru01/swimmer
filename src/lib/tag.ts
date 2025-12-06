export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface ContextTags {
  [contextId: string]: string[];
}

const TAGS_STORAGE_KEY = 'swimmer_tags';
const CONTEXT_TAGS_STORAGE_KEY = 'swimmer_context_tags';
export const MAX_TAGS_PER_CONTEXT = 20;

export const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#64748b', // slate
  '#6b7280', // gray
  '#78716c', // stone
];

export function loadTags(): Tag[] {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load tags:', error);
    return [];
  }
}

export function saveTags(tags: Tag[]): void {
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error('Failed to save tags:', error);
  }
}

export function loadContextTags(): ContextTags {
  try {
    const stored = localStorage.getItem(CONTEXT_TAGS_STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load context tags:', error);
    return {};
  }
}

export function saveContextTags(contextTags: ContextTags): void {
  try {
    localStorage.setItem(CONTEXT_TAGS_STORAGE_KEY, JSON.stringify(contextTags));
  } catch (error) {
    console.error('Failed to save context tags:', error);
  }
}

export function createTag(name: string, color?: string): Tag {
  const existingTags = loadTags();
  const defaultColor = TAG_COLORS[existingTags.length % TAG_COLORS.length];
  return {
    id: `tag_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    name,
    color: color || defaultColor,
  };
}

export function updateTag(tagId: string, updates: Partial<Omit<Tag, 'id'>>): void {
  const tags = loadTags();
  const index = tags.findIndex(t => t.id === tagId);
  if (index !== -1) {
    tags[index] = { ...tags[index], ...updates };
    saveTags(tags);
  }
}

export function addTag(tag: Tag): void {
  const tags = loadTags();
  tags.push(tag);
  saveTags(tags);
}

export function deleteTag(tagId: string): void {
  const tags = loadTags().filter(t => t.id !== tagId);
  saveTags(tags);

  const contextTags = loadContextTags();
  Object.keys(contextTags).forEach(contextId => {
    contextTags[contextId] = contextTags[contextId].filter(id => id !== tagId);
  });
  saveContextTags(contextTags);
}

export function attachTagToContext(contextId: string, tagId: string): boolean {
  const contextTags = loadContextTags();
  const currentTags = contextTags[contextId] || [];

  if (currentTags.length >= MAX_TAGS_PER_CONTEXT) {
    return false;
  }

  if (currentTags.includes(tagId)) {
    return false;
  }

  contextTags[contextId] = [...currentTags, tagId];
  saveContextTags(contextTags);
  return true;
}

export function detachTagFromContext(contextId: string, tagId: string): void {
  const contextTags = loadContextTags();
  const currentTags = contextTags[contextId] || [];
  contextTags[contextId] = currentTags.filter(id => id !== tagId);
  saveContextTags(contextTags);
}

export function getContextTags(contextId: string): string[] {
  const contextTags = loadContextTags();
  return contextTags[contextId] || [];
}

export function getTagById(tagId: string): Tag | undefined {
  const tags = loadTags();
  return tags.find(t => t.id === tagId);
}
