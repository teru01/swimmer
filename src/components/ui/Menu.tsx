import { useRef, useEffect, useState } from 'react';
import './ContextMenu.css';

export interface MenuItem {
  id: string;
  type?: 'item' | 'separator';
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  checked?: boolean;
  children?: MenuItem[];
}

interface MenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function Menu({ x, y, items, onClose }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | undefined>(undefined);

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

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.children) return;

    item.onClick?.();
    onClose();
  };

  const renderItem = (item: MenuItem) => {
    if (item.type === 'separator') {
      return <div key={item.id} className="custom-context-menu-separator" />;
    }

    const hasSubmenu = item.children && item.children.length > 0;

    return (
      <div key={item.id}>
        <div
          className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''}`}
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => setActiveSubmenuId(hasSubmenu ? item.id : undefined)}
        >
          {item.checked !== undefined && (
            <span className="menu-item-prefix">{item.checked ? '✓' : ''}</span>
          )}
          <span>{item.label}</span>
          {hasSubmenu && <span className="submenu-arrow">▶</span>}
        </div>
        {hasSubmenu && activeSubmenuId === item.id && (
          <div
            className="custom-context-menu-submenu"
            onMouseEnter={() => setActiveSubmenuId(item.id)}
          >
            {item.children!.map(child => renderSubmenuItem(child))}
          </div>
        )}
      </div>
    );
  };

  const renderSubmenuItem = (item: MenuItem) => {
    if (item.type === 'separator') {
      return <div key={item.id} className="custom-context-menu-separator" />;
    }

    return (
      <div
        key={item.id}
        className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''}`}
        onClick={() => {
          if (item.disabled) return;
          item.onClick?.();
        }}
      >
        {item.checked !== undefined && (
          <span className="menu-item-prefix">{item.checked ? '✓' : ''}</span>
        )}
        <span>{item.label}</span>
      </div>
    );
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
      <div className="custom-context-menu-main">{items.map(item => renderItem(item))}</div>
    </div>
  );
}
