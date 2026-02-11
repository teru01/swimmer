import React, { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

// ボタンコンポーネント
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'small' | 'medium' | 'large';
  danger?: boolean;
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  size = 'medium',
  danger,
  children,
  className,
  ...rest
}) => {
  const sizeClass =
    size === 'small'
      ? 'text-xs py-1 px-2'
      : size === 'large'
        ? 'text-base py-2 px-4'
        : 'text-sm py-1.5 px-3';

  const colorClass = danger
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-blue-500 hover:bg-blue-600 text-white';

  return (
    <button
      className={`rounded border-none ${sizeClass} ${colorClass} cursor-pointer ${className || ''}`}
      {...rest}
    >
      {children}
    </button>
  );
};

// 入力フィールドコンポーネント
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: 'small' | 'medium' | 'large';
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'medium', prefix, suffix, className, ...rest }, ref) => {
    const sizeClass =
      size === 'small'
        ? 'text-xs py-1 px-2 h-6'
        : size === 'large'
          ? 'text-base py-2 px-4 h-10'
          : 'text-sm py-1.5 px-3 h-8';

    return (
      <div className={`relative flex items-center ${className || ''}`}>
        {prefix && <span className="absolute left-2 text-gray-400">{prefix}</span>}
        <input
          ref={ref}
          className={`w-full ${sizeClass} border border-gray-300 rounded ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''}`}
          {...rest}
        />
        {suffix && <span className="absolute right-2 text-gray-400">{suffix}</span>}
      </div>
    );
  }
);

// タグコンポーネント
interface TagProps {
  children: ReactNode;
  className?: string;
  closable?: boolean;
  onClose?: () => void;
  onClick?: () => void;
}

export const Tag: React.FC<TagProps> = ({ children, className, closable, onClose, onClick }) => {
  return (
    <span
      className={`inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full ${onClick ? 'cursor-pointer hover:bg-gray-200' : ''} ${className || ''}`}
      onClick={onClick}
    >
      {children}
      {closable && (
        <span
          className="ml-1 text-gray-500 hover:text-gray-700 cursor-pointer"
          onClick={e => {
            e.stopPropagation();
            onClose?.();
          }}
        >
          ×
        </span>
      )}
    </span>
  );
};

// ドロップダウンコンポーネント
interface DropdownProps {
  overlay: ReactNode;
  children: ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({ overlay, children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 外部クリックでドロップダウンを閉じる
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{children}</div>
      {isOpen && (
        <div className="absolute right-0 mt-1 z-10 bg-white shadow-lg rounded p-2 min-w-[150px]">
          {overlay}
        </div>
      )}
    </div>
  );
};

// メニューコンポーネント
export const Menu = {
  Item: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <div className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded" onClick={onClick}>
      {children}
    </div>
  ),
  Divider: () => <div className="my-1 border-t border-gray-200" />,
};
