import React, { useState } from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import './preferencesPage.css';

interface PreferencesPageProps {
  onBack?: () => void;
}

type Section = 'general' | 'ai-chat' | 'terminal';

const PreferencesPage: React.FC<PreferencesPageProps> = ({ onBack }) => {
  const { preferences, updatePreferences } = usePreferences();
  const [activeSection, setActiveSection] = useState<Section>('general');

  const handleToggleAiChat = async (enabled: boolean) => {
    await updatePreferences({
      ...preferences,
      ui: {
        ...preferences.ui,
        showAiChatPane: enabled,
      },
    });
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
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default PreferencesPage;
