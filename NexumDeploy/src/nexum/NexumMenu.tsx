import React, { useCallback, useRef, useState } from 'react';
import { ArrowLeftRight, ContentLibraryIcon, SourceCode, Discord, LegalTerms, Github, ExternalLink, Settings } from '../istrong/components/ui/icons';
import { AsciiFluidBackground } from '../istrong/components/menu/AsciiFluidBackground';
import { ThemeSwitch } from '../istrong/components/kit/ThemeSwitch';
import { useMenuScale } from '../istrong/utils/useMenuScale';
import { getEffectiveViewportHeight, getEffectiveViewportWidth } from '../istrong/utils/zoomCompensation';

const CARD_W = 400, CARD_MIN_W = 300, SIDE = 16, END = 24;

function useCardZoom(card: React.RefObject<HTMLDivElement | null>): { zoom: number; width: number } {
  const scale = useMenuScale();
  const [vp, setVp] = useState(() => ({ w: getEffectiveViewportWidth(), h: getEffectiveViewportHeight() }));
  const [natH, setNatH] = useState(0);
  React.useEffect(() => {
    let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; setVp({ w: getEffectiveViewportWidth(), h: getEffectiveViewportHeight() }); }); };
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  React.useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const read = () => setNatH(el.offsetHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card]);
  const width = Math.max(CARD_MIN_W, Math.min(CARD_W, (vp.w - 2 * SIDE) / scale));
  let zoom = Math.min(scale, (vp.w - 2 * SIDE) / width);
  if (natH > 0) zoom = Math.min(zoom, (vp.h - 2 * END) / natH);
  return { zoom: Math.max(0.1, zoom), width };
}

export const NexumMenu: React.FC<{
  isDark: boolean;
  onConverter: () => void;
  onLibrary: () => void;
  onSource: () => void;
  onLicense: () => void;
  onSettings: () => void;
}> = ({ isDark, onConverter, onLibrary, onSource, onLicense, onSettings }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { zoom, width } = useCardZoom(cardRef);
  const [logoOn, setLogoOn] = useState(false);
  const logoRef = useCallback((img: HTMLImageElement | null) => { if (img && img.complete && img.naturalWidth > 0) setLogoOn(true); }, []);
  return (
    <div className="k-mm-root fixed inset-0 z-40 bg-[var(--surface-canvas)] select-none">
      <AsciiFluidBackground isDark={isDark} />
      <div className="k-mm-stage">
        <div className="k-mm-zoom" style={{ zoom }}>
          <div ref={cardRef} className="k-mm-card k-mm-card-in" style={{ width }}>
            <div className="k-mm-theme"><ThemeSwitch /></div>
            <div className="k-mm-head">
              <span className="k-mm-logo">
                <img ref={logoRef} src="/logo4.png" alt="iStrong Nexum" draggable={false}
                  className={logoOn ? 'k-mm-logo-img k-mm-logo-on' : 'k-mm-logo-img'} onLoad={() => setLogoOn(true)} />
              </span>
              <h1 className="k-mm-word">iStrong Nexum</h1>
              <span className="k-mm-tag">Tank Converter</span>
            </div>
            <div className="k-mm-actions">
              <button type="button" className="k-btn k-btn-primary k-mm-action" onClick={onConverter}>
                <ArrowLeftRight size={18} absoluteStrokeWidth /> Open Converter
              </button>
              <button type="button" className="k-btn k-btn-secondary k-mm-action" onClick={onLibrary}>
                <ContentLibraryIcon size={18} absoluteStrokeWidth /> Tank Library
              </button>
              <button type="button" className="k-btn k-btn-secondary k-mm-action" onClick={onSettings}>
                <Settings size={18} absoluteStrokeWidth /> App Settings
              </button>
            </div>
            <div className="k-mm-foot">
              <button type="button" className="k-mm-link k-mm-link-ico" onClick={onSource} title="Source Code" aria-label="Source Code">
                <SourceCode size={16} />
              </button>
              <a href="https://istrong.pages.dev" target="_blank" rel="noopener noreferrer" className="k-mm-link k-mm-link-ico"
                title="iStrong Tank & Game Mode Maker" aria-label="iStrong Tank & Game Mode Maker">
                <ExternalLink size={16} />
              </a>
              <a href="https://github.com/Arjuna618/NexumLibrary" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub"
                className="k-mm-link k-mm-link-ico">
                <Github size={16} />
              </a>
              <a href="https://discord.gg/HTE9MTsmBm" target="_blank" rel="noopener noreferrer" title="Join our Discord" aria-label="Join our Discord"
                className="k-mm-link k-mm-link-ico">
                <Discord size={16} />
              </a>
              <button type="button" className="k-mm-link k-mm-link-ico" onClick={onLicense} title="License and notices" aria-label="License and notices">
                <LegalTerms size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
