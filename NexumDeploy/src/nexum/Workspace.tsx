import React from 'react';
import { IconButton } from '../istrong/components/kit/kit';
import { ArrowLeftRight, FileImport, ContentLibraryIcon, SourceCode, Settings, House, Moon, Sun, type AppIcon } from '../istrong/components/ui/icons';
import { useChromeScale } from '../istrong/utils/useMenuScale';
import { toggleTheme } from '../istrong/utils/theme';
import { ToOsaPage } from './tools/ToOsaPage';
import { FromOsaPage } from './tools/FromOsaPage';
import type { SourceFile } from './convert';

export type ToolId = 'toOsa' | 'fromOsa';
const TOOLS: { id: ToolId; label: string; Icon: AppIcon }[] = [
  { id: 'toOsa', label: 'iStrong to OSA', Icon: ArrowLeftRight },
  { id: 'fromOsa', label: 'OSA to iStrong', Icon: FileImport },
];
const RAIL_STROKE = 1.5;

function RailButton({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: AppIcon; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} data-tip={label} data-tip-side="right"
      className={`toolbar-icon w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.97] relative ${active ? 'toolbar-icon-active' : 'text-[var(--k-rail-icon)] hover:bg-[var(--k-icon-hover)] hover:text-[var(--k-rail-icon-on)]'}`}>
      <Icon size={20} strokeWidth={RAIL_STROKE} absoluteStrokeWidth />
    </button>
  );
}

export const Workspace: React.FC<{
  tool: ToolId;
  setTool: (t: ToolId) => void;
  isDark: boolean;
  handed: { files: SourceFile[]; at: number } | null;
  onLibrary: () => void;
  onSource: () => void;
  onSettings: () => void;
  onMenu: () => void;
}> = ({ tool, setTool, isDark, handed, onLibrary, onSource, onSettings, onMenu }) => {
  const chromeScale = useChromeScale();
  const current = TOOLS.find((t) => t.id === tool)!;
  return (
    <>
      <header style={{ zoom: chromeScale }} className="k-bar k-chrome h-[55px] bg-[var(--k-chrome)] grid grid-cols-[1fr_auto_1fr] items-center gap-4 z-30 relative shrink-0">
        <div className="flex items-center min-w-0 gap-2">
          <h1 className="sr-only">iStrong Nexum</h1>
          <button type="button" className="k-tb-logo" onClick={onMenu} aria-label="Main Menu">
            <img src="/logo4.png" alt="" className="k-tb-logo-img" draggable={false} />
          </button>
          <span className="k-panel-title truncate">iStrong Nexum</span>
        </div>
        <div className="flex justify-center min-w-0">
          <span className="k-panel-title truncate text-[var(--text-secondary)]">{current.label}</span>
        </div>
        <div className="flex items-center gap-1 justify-end min-w-0 pr-3">
          <IconButton label="Tank Library" onClick={onLibrary}><ContentLibraryIcon size={18} strokeWidth={1.5} absoluteStrokeWidth /></IconButton>
          <IconButton label="Source Code" onClick={onSource}><SourceCode size={18} strokeWidth={1.5} absoluteStrokeWidth /></IconButton>
          <IconButton label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => toggleTheme()}>
            {isDark ? <Moon size={18} strokeWidth={1.5} absoluteStrokeWidth /> : <Sun size={18} strokeWidth={1.5} absoluteStrokeWidth />}
          </IconButton>
        </div>
      </header>
      <div className="flex flex-1 min-h-0 relative">
        <aside style={{ zoom: chromeScale }} className="toolbar-rail k-chrome w-[60px] bg-[var(--k-chrome)] z-20 h-full shrink-0">
          <div className="rail-stack">
            {TOOLS.map((t) => <RailButton key={t.id} active={tool === t.id} onClick={() => setTool(t.id)} Icon={t.Icon} label={t.label} />)}
            <div className="rail-divider" />
            <RailButton active={false} onClick={onLibrary} Icon={ContentLibraryIcon} label="Tank Library" />
            <div className="rail-spacer" />
            <div className="rail-divider" />
            <RailButton active={false} onClick={onSource} Icon={SourceCode} label="Source Code" />
            <RailButton active={false} onClick={onSettings} Icon={Settings} label="App Settings" />
            <RailButton active={false} onClick={onMenu} Icon={House} label="Main Menu" />
          </div>
        </aside>
        <main className="flex-1 min-w-0 relative bg-[var(--surface-canvas)] shadow-inner dark:shadow-none">
          <div style={{ zoom: chromeScale }} className="absolute inset-0 flex justify-center p-4">
            <div className="w-full max-w-[1080px] h-full panel-gradient rounded-[10px] flex flex-col min-h-0 overflow-hidden">
              <div className="h-12 tool-headline flex items-center gap-2.5 px-4 shrink-0">
                <current.Icon size={18.29} strokeWidth={1.576} absoluteStrokeWidth className="text-[var(--text-primary)] shrink-0" />
                <h2 key={current.id} className="k-panel-title truncate k-title-swap">{current.label}</h2>
              </div>
              <div className="flex-1 min-h-0 relative">
                <div className={tool === 'toOsa' ? 'absolute inset-0' : 'hidden'}><ToOsaPage handed={handed} onLibrary={onLibrary} /></div>
                <div className={tool === 'fromOsa' ? 'absolute inset-0' : 'hidden'}><FromOsaPage /></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};
