import { useRef, useEffect, useState, useCallback } from 'react';
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

function getActionableItems(items: MenuItem[]): MenuItem[] {
  return items.filter(item => item.type !== 'separator');
}

export function Menu({ x, y, items, onClose }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | undefined>(undefined);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [, setSubmenuFocusedIndex] = useState<number>(0);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const actionableItems = getActionableItems(items);

  const focusItem = useCallback(
    (index: number) => {
      const item = actionableItems[index];
      if (item) {
        const el = itemRefs.current.get(item.id);
        el?.focus();
      }
    },
    [actionableItems]
  );

  useEffect(() => {
    focusItem(0);
  }, [focusItem]);

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

  const handleMainKeyDown = (e: React.KeyboardEvent, item: MenuItem, index: number) => {
    const hasSubmenu = item.children && item.children.length > 0;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = (index + 1) % actionableItems.length;
        setFocusedIndex(next);
        focusItem(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = (index - 1 + actionableItems.length) % actionableItems.length;
        setFocusedIndex(prev);
        focusItem(prev);
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (hasSubmenu) {
          setActiveSubmenuId(item.id);
          setSubmenuFocusedIndex(0);
          setTimeout(() => {
            const subItems = getActionableItems(item.children!);
            if (subItems[0]) {
              const el = itemRefs.current.get(`sub-${subItems[0].id}`);
              el?.focus();
            }
          }, 0);
        } else {
          handleItemClick(item);
        }
        break;
      }
      case 'ArrowRight': {
        if (hasSubmenu) {
          e.preventDefault();
          setActiveSubmenuId(item.id);
          setSubmenuFocusedIndex(0);
          setTimeout(() => {
            const subItems = getActionableItems(item.children!);
            if (subItems[0]) {
              const el = itemRefs.current.get(`sub-${subItems[0].id}`);
              el?.focus();
            }
          }, 0);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        onClose();
        break;
      }
    }
  };

  const handleSubmenuKeyDown = (
    e: React.KeyboardEvent,
    item: MenuItem,
    index: number,
    parentItems: MenuItem[]
  ) => {
    const subActionableItems = getActionableItems(parentItems);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = (index + 1) % subActionableItems.length;
        setSubmenuFocusedIndex(next);
        const el = itemRefs.current.get(`sub-${subActionableItems[next].id}`);
        el?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = (index - 1 + subActionableItems.length) % subActionableItems.length;
        setSubmenuFocusedIndex(prev);
        const el = itemRefs.current.get(`sub-${subActionableItems[prev].id}`);
        el?.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (!item.disabled) {
          item.onClick?.();
          onClose();
        }
        break;
      }
      case 'ArrowLeft':
      case 'Escape': {
        e.preventDefault();
        setActiveSubmenuId(undefined);
        focusItem(focusedIndex);
        break;
      }
    }
  };

  const renderItem = (item: MenuItem) => {
    if (item.type === 'separator') {
      return <div key={item.id} className="custom-context-menu-separator" role="separator" />;
    }

    const hasSubmenu = item.children && item.children.length > 0;
    const actionIndex = actionableItems.indexOf(item);

    return (
      <div key={item.id}>
        <div
          ref={el => {
            if (el) itemRefs.current.set(item.id, el);
          }}
          role="menuitem"
          tabIndex={-1}
          aria-disabled={item.disabled || undefined}
          aria-haspopup={hasSubmenu ? 'menu' : undefined}
          aria-expanded={hasSubmenu ? activeSubmenuId === item.id : undefined}
          className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''}`}
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => setActiveSubmenuId(hasSubmenu ? item.id : undefined)}
          onKeyDown={e => handleMainKeyDown(e, item, actionIndex)}
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
            role="menu"
            onMouseEnter={() => setActiveSubmenuId(item.id)}
          >
            {item.children!.map(child => renderSubmenuItem(child, item.children!))}
          </div>
        )}
      </div>
    );
  };

  const renderSubmenuItem = (item: MenuItem, parentItems: MenuItem[]) => {
    if (item.type === 'separator') {
      return <div key={item.id} className="custom-context-menu-separator" role="separator" />;
    }

    const subActionableItems = getActionableItems(parentItems);
    const subIndex = subActionableItems.indexOf(item);

    return (
      <div
        key={item.id}
        ref={el => {
          if (el) itemRefs.current.set(`sub-${item.id}`, el);
        }}
        role="menuitem"
        tabIndex={-1}
        aria-disabled={item.disabled || undefined}
        className={`custom-context-menu-item ${item.disabled ? 'disabled' : ''}`}
        onClick={() => {
          if (item.disabled) return;
          item.onClick?.();
          onClose();
        }}
        onKeyDown={e => handleSubmenuKeyDown(e, item, subIndex, parentItems)}
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
      <div className="custom-context-menu-main" role="menu">
        {items.map(item => renderItem(item))}
      </div>
    </div>
  );
}
