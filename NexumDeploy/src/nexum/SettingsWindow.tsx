import React, { useCallback, useState } from 'react';
import { Modal } from '../istrong/components/kit/Modal';
import { Group, SliderRow, SelectRow, headerIcon } from '../istrong/components/kit/kit';
import { Settings, HdAppWindow, HdPaintBoard } from '../istrong/components/ui/icons';
import { getUiSizeSetting, setUiSizeSetting, UI_SIZE_MIN, UI_SIZE_MAX } from '../istrong/utils/useMenuScale';
import { toggleTheme } from '../istrong/utils/theme';
import { useHtmlDark } from '../istrong/components/library/useHtmlDark';

export const SettingsWindow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [draft, setDraft] = useState(() => Math.round(getUiSizeSetting() * 100));
  const commit = useCallback((v: number) => {
    setUiSizeSetting(v / 100);
    setDraft(Math.round(getUiSizeSetting() * 100));
  }, []);
  const dark = useHtmlDark();
  const onTheme = useCallback((v: string) => { if ((v === 'dark') !== document.documentElement.classList.contains('dark')) toggleTheme(); }, []);
  return (
    <Modal title="App Settings" icon={<Settings size={18} strokeWidth={1.5} absoluteStrokeWidth />} size="md" onClose={onClose}>
      <div className="space-y-3">
        <Group title="Interface" icon={headerIcon(HdAppWindow)}>
          <SliderRow label="UI Size" value={draft} onChange={setDraft} onCommit={commit}
            min={Math.round(UI_SIZE_MIN * 100)} max={Math.round(UI_SIZE_MAX * 100)} display={`${draft}%`}
            minLabel="Compact" maxLabel="Large"
            help="Scales every menu, window and panel. Applies when you release the slider. Browser zoom (Ctrl+wheel) does not resize the app, use this instead. Saved in this browser." />
        </Group>
        <Group title="Appearance" icon={headerIcon(HdPaintBoard)}>
          <SelectRow label="Theme" description="Light or dark, as the sun and moon button." value={dark ? 'dark' : 'light'} onChange={onTheme}
            options={{ light: 'Light', dark: 'Dark' }} />
        </Group>
      </div>
    </Modal>
  );
};
