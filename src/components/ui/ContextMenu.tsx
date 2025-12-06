import { useRef, useEffect, useState } from 'react';
import './ContextMenu.css';

export interface ContextMenuItem {
  id: string;
  type?: 'item';
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ContextMenuSeparator {
  id: string;
  type: 'separator';
  label?: never;
}

export type ContextMenuItemType = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItemType[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleItemClick = (item: ContextMenuItemType) => {
    if (item.type === 'separator') return;
    if (item.disabled) return;

    item.onClick();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="custom-context-menu-container"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="custom-context-menu-main">
        {items.map(item => {
          if (item.type === 'separator') {
            return <div key={item.id} className="custom-context-menu-separator" />;
          }

          return (
            <div
              key={item.id}
              className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SubmenuItem extends ContextMenuItem {
  checked?: boolean;
}

interface ContextMenuWithSubmenuProps {
  x: number;
  y: number;
  items: ContextMenuItemType[];
  submenuLabel?: string;
  submenuItems?: SubmenuItem[];
  onClose: () => void;
}

export function ContextMenuWithSubmenu({
  x,
  y,
  items,
  submenuLabel,
  submenuItems = [],
  onClose,
}: ContextMenuWithSubmenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
        setShowSubmenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleItemClick = (item: ContextMenuItemType) => {
    if (item.type === 'separator') return;
    if (item.disabled) return;

    item.onClick();
    onClose();
  };

  const handleSubmenuItemClick = (item: SubmenuItem) => {
    if (item.disabled) return;
    item.onClick();
  };

  return (
    <div
      ref={menuRef}
      className="custom-context-menu-container"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="custom-context-menu-main">
        {items.map(item => {
          if (item.type === 'separator') {
            return <div key={item.id} className="custom-context-menu-separator" />;
          }

          return (
            <div
              key={item.id}
              className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''}`}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => setShowSubmenu(false)}
            >
              {item.label}
            </div>
          );
        })}
        {submenuLabel && (
          <div
            className="custom-context-menu-item has-submenu"
            onMouseEnter={() => setShowSubmenu(true)}
          >
            <span>{submenuLabel}</span>
            <span className="submenu-arrow">▶</span>
          </div>
        )}
      </div>

      {showSubmenu && submenuItems.length > 0 && (
        <div className="custom-context-menu-submenu" onMouseEnter={() => setShowSubmenu(true)}>
          {submenuItems.map(item => (
            <div
              key={item.id}
              className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''}`}
              onClick={() => handleSubmenuItemClick(item)}
            >
              <span className="tag-check">{item.checked ? '✓' : ''}</span>
              <span className="tag-text">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
