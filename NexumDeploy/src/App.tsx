import React, { useCallback, useEffect, useState } from 'react';
import { ToastProvider } from './istrong/components/ui/Toast';
import { Modal } from './istrong/components/kit/Modal';
import { Button } from './istrong/components/kit/kit';
import { MonitorSmartphone } from './istrong/components/ui/icons';
import { useHtmlDark } from './istrong/components/library/useHtmlDark';
import { isPhoneDevice } from './istrong/utils/device';
import { blockBrowserZoomInputs } from './istrong/utils/zoomCompensation';
import { NexumMenu } from './nexum/NexumMenu';
import { Workspace, type ToolId } from './nexum/Workspace';
import { LibraryWindow } from './nexum/library/LibraryWindow';
import { SettingsWindow } from './nexum/SettingsWindow';
import { LicenseWindow } from './nexum/LicenseWindow';
import { SourceWindow } from './nexum/SourceWindow';
import type { SourceFile } from './nexum/convert';

type Screen = 'menu' | 'work';

export default function App() {
  const isDark = useHtmlDark();
  const [screen, setScreen] = useState<Screen>('menu');
  const [tool, setTool] = useState<ToolId>('toOsa');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState(false);
  const [handed, setHanded] = useState<{ files: SourceFile[]; at: number } | null>(null);

  useEffect(() => blockBrowserZoomInputs(), []);

  const onPc = useCallback((run: () => void) => { if (isPhoneDevice()) setPhoneNotice(true); else run(); }, []);
  const openConverter = useCallback(() => onPc(() => setScreen('work')), [onPc]);
  const openLibrary = useCallback(() => onPc(() => setLibraryOpen(true)), [onPc]);

  return (
    <ToastProvider>
      <div className="fixed inset-0 flex flex-col bg-[var(--surface-canvas)] text-[var(--text-primary)] font-sans overflow-hidden">
        {screen === 'menu' ? (
          <NexumMenu isDark={isDark} onConverter={openConverter} onLibrary={openLibrary}
            onSource={() => setSourceOpen(true)} onLicense={() => setLicenseOpen(true)} onSettings={() => setSettingsOpen(true)} />
        ) : (
          <Workspace tool={tool} setTool={setTool} isDark={isDark} handed={handed}
            onLibrary={() => setLibraryOpen(true)} onSource={() => setSourceOpen(true)}
            onSettings={() => setSettingsOpen(true)} onMenu={() => setScreen('menu')} />
        )}
      </div>

      {libraryOpen && (
        <LibraryWindow isDark={isDark} onClose={() => setLibraryOpen(false)}
          onConvert={(files) => { setHanded({ files, at: Date.now() }); setTool('toOsa'); setScreen('work'); setLibraryOpen(false); }} />
      )}
      {sourceOpen && <SourceWindow onClose={() => setSourceOpen(false)} />}
      {settingsOpen && <SettingsWindow onClose={() => setSettingsOpen(false)} />}
      {licenseOpen && <LicenseWindow onClose={() => setLicenseOpen(false)} />}
      {phoneNotice && (
        <Modal title="iStrong Nexum" icon={<MonitorSmartphone size={18} strokeWidth={1.5} absoluteStrokeWidth />} size="sm" onClose={() => setPhoneNotice(false)}
          footer={close => <Button variant="primary" onClick={() => close()}>OK</Button>}>
          <p className="k-modal-text">iStrong Nexum needs a bigger screen. Open it on a computer to convert tanks and to browse the library.</p>
        </Modal>
      )}
    </ToastProvider>
  );
}
