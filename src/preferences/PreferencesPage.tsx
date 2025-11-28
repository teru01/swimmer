import React, { useState } from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import './preferencesPage.css';
import { loadTags, addTag, deleteTag, createTag, Tag } from '../lib/tag';

interface PreferencesPageProps {
  onBack?: () => void;
}

type Section = 'general' | 'ai-chat' | 'terminal' | 'tags';

const PreferencesPage: React.FC<PreferencesPageProps> = ({ onBack }) => {
  const { preferences, updatePreferences } = usePreferences();
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [tags, setTags] = useState<Tag[]>(loadTags());
  const [newTagName, setNewTagName] = useState('');

  const handleToggleAiChat = async (enabled: boolean) => {
    await updatePreferences({
      ...preferences,
      ui: {
        ...preferences.ui,
        showAiChatPane: enabled,
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

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const tag = createTag(newTagName.trim());
    addTag(tag);
    setTags(loadTags());
    setNewTagName('');
  };

  const handleDeleteTag = (tagId: string) => {
    if (confirm('Are you sure you want to delete this tag?')) {
      deleteTag(tagId);
      setTags(loadTags());
    }
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
            className={`sidebar-item ${activeSection === 'ai-chat' ? 'active' : ''}`}
            onClick={() => setActiveSection('ai-chat')}
          >
            AI Chat
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
            </section>
          )}

          {activeSection === 'ai-chat' && (
            <section className="preferences-section">
              <h2>AI Chat</h2>
              <p className="section-description">Configure AI chat pane visibility and behavior.</p>

              <div className="preference-row">
                <div className="preference-label-wrapper">
                  <label htmlFor="ai-chat-enabled">Enable AI Chat Pane</label>
                  <p className="preference-description">
                    Show the AI chat pane in the cluster information view.
                  </p>
                </div>
                <label className="switch">
                  <input
                    id="ai-chat-enabled"
                    type="checkbox"
                    checked={preferences.ui.showAiChatPane}
                    onChange={e => handleToggleAiChat(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
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
                  />
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
                        <span className="tag-color-dot" style={{ backgroundColor: tag.color }} />
                        <span className="tag-name-text">{tag.name}</span>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
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
    </div>
  );
};

export default PreferencesPage;
