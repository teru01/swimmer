import React, { useState, useRef, useEffect } from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import { commands } from '../api/commands';
import './preferencesPage.css';
import { loadTags, addTag, deleteTag, createTag, updateTag, Tag, TAG_COLORS } from '../lib/tag';

export type PreferencesSection = 'general' | 'terminal' | 'tags';

interface PreferencesPageProps {
  onBack?: () => void;
  initialSection?: PreferencesSection;
}

// Get random color from TAG_COLORS
function getRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

const PreferencesPage: React.FC<PreferencesPageProps> = ({
  onBack,
  initialSection = 'general',
}) => {
  const { preferences, updatePreferences } = usePreferences();
  const [activeSection, setActiveSection] = useState<PreferencesSection>(initialSection);
  const [tags, setTags] = useState<Tag[]>(loadTags());
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(getRandomColor());
  const [tagToDelete, setTagToDelete] = useState<Tag | undefined>(undefined);
  const [newTagColorDropdownOpen, setNewTagColorDropdownOpen] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | undefined>(undefined);
  const newTagColorDropdownRef = useRef<HTMLDivElement>(null);
  const editingTagDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleKubeconfigPathChange = async (kubeconfigPath: string) => {
    await updatePreferences({
      ...preferences,
      general: {
        ...preferences.general,
        kubeconfigPath,
      },
    });
    await commands.setKubeconfigPath(kubeconfigPath || undefined);
  };

  const handleThemeChange = async (theme: 'dark' | 'light' | 'system') => {
    await updatePreferences({
      ...preferences,
      general: {
        ...preferences.general,
        theme,
      },
    });
  };

  const handleTimeoutChange = async (resourceFetchTimeoutSec: number) => {
    await updatePreferences({
      ...preferences,
      general: {
        ...preferences.general,
        resourceFetchTimeoutSec,
      },
    });
  };

  const handleShellPathChange = async (shellPath: string) => {
    await updatePreferences({
      ...preferences,
      terminal: {
        ...preferences.terminal,
        shellPath,
      },
    });
  };

  const handleFontSizeChange = async (fontSize: number) => {
    await updatePreferences({
      ...preferences,
      terminal: {
        ...preferences.terminal,
        fontSize,
      },
    });
  };

  const handleFontFamilyChange = async (fontFamily: string) => {
    await updatePreferences({
      ...preferences,
      terminal: {
        ...preferences.terminal,
        fontFamily,
      },
    });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        newTagColorDropdownRef.current &&
        !newTagColorDropdownRef.current.contains(event.target as Node)
      ) {
        setNewTagColorDropdownOpen(false);
      }
      Object.values(editingTagDropdownRefs.current).forEach(ref => {
        if (ref && !ref.contains(event.target as Node)) {
          setEditingTagId(undefined);
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const tag = createTag(newTagName.trim(), newTagColor);
    addTag(tag);
    setTags(loadTags());
    setNewTagName('');
    setNewTagColor(getRandomColor());
    setNewTagColorDropdownOpen(false);
  };

  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
  };

  const confirmDeleteTag = () => {
    if (tagToDelete) {
      deleteTag(tagToDelete.id);
      setTags(loadTags());
      setTagToDelete(undefined);
    }
  };

  const cancelDeleteTag = () => {
    setTagToDelete(undefined);
  };

  const handleTagColorChange = (tagId: string, color: string) => {
    updateTag(tagId, { color });
    const updatedTags = loadTags();
    setTags(updatedTags);
    // Close dropdown after state update
    setTimeout(() => {
      setEditingTagId(undefined);
    }, 0);
  };

  return (
    <div className="preferences-page">
      <div className="preferences-page-header">
        <h1>Preferences</h1>
        <button className="close-button" onClick={onBack}>
          ×
        </button>
      </div>

      <div className="preferences-page-body">
        <aside className="preferences-sidebar">
          <button
            className={`sidebar-item ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSection('general')}
          >
            General
          </button>
          <button
            className={`sidebar-item ${activeSection === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveSection('terminal')}
          >
            Terminal
          </button>
          <button
            className={`sidebar-item ${activeSection === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveSection('tags')}
          >
            Tags
          </button>
        </aside>

        <main className="preferences-content">
          {activeSection === 'general' && (
            <section className="preferences-section">
              <h2>General</h2>
              <p className="section-description">General settings for the application.</p>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="kubeconfig-path">Kubeconfig Path</label>
                  <p className="preference-description">
                    Path to the kubeconfig file. Leave empty to use default (~/.kube/config).
                  </p>
                </div>
                <input
                  id="kubeconfig-path"
                  type="text"
                  value={preferences.general.kubeconfigPath}
                  onChange={e => handleKubeconfigPathChange(e.target.value)}
                  placeholder="~/.kube/config"
                  className="text-input"
                />
              </div>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="theme-select">Theme</label>
                  <p className="preference-description">Choose the application color theme.</p>
                </div>
                <select
                  id="theme-select"
                  value={preferences.general.theme}
                  onChange={e => handleThemeChange(e.target.value as 'dark' | 'light' | 'system')}
                  className="select-input"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="fetch-timeout">Resource Fetch Timeout (sec)</label>
                  <p className="preference-description">
                    Timeout in seconds for fetching Kubernetes resources.
                  </p>
                </div>
                <input
                  id="fetch-timeout"
                  type="number"
                  min={5}
                  max={60}
                  step={1}
                  value={preferences.general.resourceFetchTimeoutSec}
                  onChange={e => handleTimeoutChange(Number(e.target.value))}
                  className="number-input"
                />
              </div>
            </section>
          )}

          {activeSection === 'terminal' && (
            <section className="preferences-section">
              <h2>Terminal</h2>
              <p className="section-description">Configure terminal settings.</p>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="shell-path">Shell Path</label>
                  <p className="preference-description">
                    Path to the shell executable (e.g., /bin/zsh, /bin/bash, /usr/bin/fish).
                  </p>
                </div>
                <input
                  id="shell-path"
                  type="text"
                  value={preferences.terminal.shellPath}
                  onChange={e => handleShellPathChange(e.target.value)}
                  placeholder="/bin/zsh"
                  className="text-input"
                />
              </div>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="font-size">Font Size</label>
                  <p className="preference-description">Font size for the terminal (8-24).</p>
                </div>
                <input
                  id="font-size"
                  type="number"
                  min={8}
                  max={24}
                  step={1}
                  value={preferences.terminal.fontSize}
                  onChange={e => handleFontSizeChange(Number(e.target.value))}
                  className="number-input"
                />
              </div>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="font-family">Font Family</label>
                  <p className="preference-description">Font family for the terminal.</p>
                </div>
                <input
                  id="font-family"
                  type="text"
                  value={preferences.terminal.fontFamily}
                  onChange={e => handleFontFamilyChange(e.target.value)}
                  placeholder='Menlo, Monaco, "Courier New", monospace'
                  className="text-input"
                />
              </div>
            </section>
          )}

          {activeSection === 'tags' && (
            <section className="preferences-section">
              <h2>Tags</h2>
              <p className="section-description">
                Manage tags for organizing your Kubernetes contexts.
              </p>

              <div className="tags-section">
                <div className="add-tag-row">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="Enter tag name"
                    className="text-input"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <div className="color-dropdown-wrapper" ref={newTagColorDropdownRef}>
                    <button
                      type="button"
                      className="color-marker-button"
                      onClick={() => setNewTagColorDropdownOpen(!newTagColorDropdownOpen)}
                      aria-label="Select color"
                    >
                      <span className="tag-color-dot" style={{ backgroundColor: newTagColor }} />
                    </button>
                    {newTagColorDropdownOpen && (
                      <div className="color-dropdown">
                        {TAG_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            className={`color-dropdown-item ${newTagColor === color ? 'selected' : ''}`}
                            onClick={() => {
                              setNewTagColor(color);
                              setNewTagColorDropdownOpen(false);
                            }}
                            aria-label={`Select ${color}`}
                          >
                            <span className="tag-color-dot" style={{ backgroundColor: color }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddTag} className="add-button">
                    Add Tag
                  </button>
                </div>

                <div className="tags-list">
                  {tags.length === 0 ? (
                    <p className="no-tags">No tags created yet.</p>
                  ) : (
                    tags.map(tag => (
                      <div key={tag.id} className="tag-row">
                        <div
                          className="color-dropdown-wrapper"
                          ref={el => {
                            editingTagDropdownRefs.current[tag.id] = el;
                          }}
                        >
                          <button
                            type="button"
                            className="color-marker-button"
                            onClick={() =>
                              setEditingTagId(editingTagId === tag.id ? undefined : tag.id)
                            }
                            aria-label="Change tag color"
                          >
                            <span
                              className="tag-color-dot"
                              style={{ backgroundColor: tag.color }}
                            />
                          </button>
                          {editingTagId === tag.id && (
                            <div
                              className="color-dropdown"
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                            >
                              {TAG_COLORS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`color-dropdown-item ${tag.color === color ? 'selected' : ''}`}
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleTagColorChange(tag.id, color);
                                  }}
                                  aria-label={`Select ${color}`}
                                >
                                  <span
                                    className="tag-color-dot"
                                    style={{ backgroundColor: color }}
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="tag-name-text">{tag.name}</span>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="delete-button"
                          aria-label="Delete tag"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {tagToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteTag}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete Tag</h2>
            <p>
              Are you sure you want to delete the tag &quot;{tagToDelete.name}&quot;? This tag will
              be detached from all contexts.
            </p>
            <div className="modal-actions">
              <button onClick={cancelDeleteTag}>Cancel</button>
              <button onClick={confirmDeleteTag} className="primary-button">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreferencesPage;
