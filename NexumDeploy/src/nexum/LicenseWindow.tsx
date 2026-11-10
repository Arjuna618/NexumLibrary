import React, { useState } from 'react';
import { Modal } from '../istrong/components/kit/Modal';
import { PageSwap } from '../istrong/components/kit/Collapse';
import { LegalTerms } from '../istrong/components/ui/icons';
import { useModalMaxHeight } from '../istrong/utils/useMenuScale';
import licenseSource from '../../LICENSE?raw';
import noticesSource from '../../public/THIRD-PARTY-NOTICES.txt?raw';

type Block = { t: 'title' | 'h' | 'p' | 'li' | 'quote'; text: string };
function blocksOf(source: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ t: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('## ')) { flush(); out.push({ t: 'h', text: line.slice(3) }); continue; }
    if (line.startsWith('# ')) { flush(); out.push({ t: 'title', text: line.slice(2) }); continue; }
    if (line.startsWith('- ')) { flush(); out.push({ t: 'li', text: line.slice(2) }); continue; }
    if (line.startsWith('> ')) { flush(); out.push({ t: 'quote', text: line.slice(2) }); continue; }
    para.push(line);
  }
  flush();
  return out;
}
type Span = { k: 'text' | 'bold' | 'code'; text: string } | { k: 'link'; text: string; href: string };
function spansOf(text: string): Span[] {
  const out: Span[] = [];
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|`(.+?)`|\[([^\]]+)\]\(([^)\s]+)\)|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s)>]+)/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ k: 'text', text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ k: 'bold', text: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'bold', text: m[2] });
    else if (m[3] !== undefined) out.push({ k: 'code', text: m[3] });
    else if (m[4] !== undefined) out.push(/^https?:\/\//.test(m[5]) ? { k: 'link', text: m[4], href: m[5] } : { k: 'text', text: m[4] });
    else if (m[6] !== undefined) out.push({ k: 'link', text: m[6], href: m[6] });
    else {
      const href = m[7].replace(/[.,;:]+$/, '');
      out.push({ k: 'link', text: href, href });
      if (href.length < m[7].length) out.push({ k: 'text', text: m[7].slice(href.length) });
    }
    at = re.lastIndex;
  }
  if (at < text.length) out.push({ k: 'text', text: text.slice(at) });
  return out;
}

function Spans({ text }: { text: string }) {
  return <>{spansOf(text).map((s, i) => {
    if (s.k === 'bold') return <strong key={i} className="k-legal-strong">{s.text}</strong>;
    if (s.k === 'code') return <code key={i} className="k-legal-code">{s.text}</code>;
    if (s.k === 'link') return <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="k-legal-link">{s.text}</a>;
    return <React.Fragment key={i}>{s.text}</React.Fragment>;
  })}</>;
}
function Blocks({ blocks, inCard }: { blocks: Block[]; inCard?: boolean }) {
  return <>{blocks.map((b, i) => {
    switch (b.t) {
      case 'title': return <h3 key={i} className={inCard ? 'k-legal-card-title' : 'k-legal-title'}>{b.text}</h3>;
      case 'h': return <h4 key={i} className={inCard ? 'k-legal-card-h' : 'k-docs-h'}>{b.text}</h4>;
      case 'li': return <p key={i} className="k-docs-p k-legal-li"><span className="k-legal-dot" aria-hidden /><Spans text={b.text} /></p>;
      case 'quote': return <p key={i} className="k-docs-p k-legal-quote"><Spans text={b.text} /></p>;
      default:
        if (/^(Version |Required Notice:)/.test(b.text)) return <p key={i} className="k-legal-meta"><Spans text={b.text} /></p>;
        return <p key={i} className="k-docs-p"><Spans text={b.text} /></p>;
    }
  })}</>;
}

interface NoticePart { name: string; license: string; link: string; blocks: Block[] }
function noticeParts(src: string): { intro: Block[]; parts: NoticePart[] } {
  const chunks = src.replace(/\r\n/g, '\n').split(/^={20,}$/m);
  const parts: NoticePart[] = [];
  for (let i = 1; i + 1 < chunks.length; i += 2) {
    const head = chunks[i].trim().split('\n');
    const m = /^(.*) \(([^()]+)\)$/.exec((head[0] ?? '').trim());
    parts.push({ name: m ? m[1] : (head[0] ?? ''), license: m ? m[2] : '', link: (head[1] ?? '').trim(), blocks: blocksOf(chunks[i + 1]) });
  }
  return { intro: blocksOf(chunks[0] ?? ''), parts };
}
const LICENSE = blocksOf(licenseSource);
const NOTICES = noticeParts(noticesSource);

type Page = 'license' | 'notices';
const PAGES: { id: Page; label: string }[] = [{ id: 'license', label: 'License' }, { id: 'notices', label: 'Notices' }];

export const LicenseWindow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [page, setPage] = useState<Page>('license');
  const maxH = useModalMaxHeight();
  const bodyH = Math.max(320, Math.min(640, maxH - 58));
  return (
    <Modal title="License and Notices" icon={<LegalTerms size={18} absoluteStrokeWidth />} width={860} onClose={onClose} fit
      bodyClassName="k-modal-body-flush" waitHeight={bodyH} surface="content">
      <div className="flex min-h-0" style={{ height: bodyH }}>
        <nav className="k-rd-side k-legal-side" aria-label="Pages">
          <div className="k-rd-list">
            {PAGES.map((p) => (
              <button key={p.id} type="button" className={page === p.id ? 'k-rd-item k-rd-item-on' : 'k-rd-item'} onClick={() => setPage(p.id)}>
                <span className="k-rd-item-text">{p.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <PageSwap>
          <div key={page} className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
            <div className="k-legal-page">
              {page === 'license' ? <Blocks blocks={LICENSE} /> : (
                <>
                  <h3 className="k-legal-title">Notices</h3>
                  <Blocks blocks={NOTICES.intro} />
                  {NOTICES.parts.map((p, i) => (
                    <section key={i} className="k-info-card k-legal-notice">
                      <header className="k-legal-notice-head">
                        <div className="k-legal-notice-name">{p.name}</div>
                        {p.license && <span className="k-badge k-legal-notice-tag">{p.license}</span>}
                        {p.link && <div className="k-legal-notice-link"><Spans text={p.link} /></div>}
                      </header>
                      <div className="k-legal-notice-body"><Blocks blocks={p.blocks} inCard /></div>
                    </section>
                  ))}
                </>
              )}
            </div>
          </div>
        </PageSwap>
      </div>
    </Modal>
  );
};
