import React from 'react';
import { BreadcrumbItem } from '../../context/DriveContext';
import { ChevronRight, HardDrive } from 'lucide-react';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onSelect: (id: string | null) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onSelect }) => {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-300 overflow-x-auto py-1 selection:bg-none">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={item.id || 'root'}>
            {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
            <button
              onClick={() => onSelect(item.id)}
              disabled={isLast}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors flex-shrink-0 ${
                isLast
                  ? 'text-slate-100 font-semibold cursor-default'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {idx === 0 && <HardDrive className="w-4 h-4 text-brand-400" />}
              {item.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
