import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Logo } from '../../../components/brand/Logo.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { text } from '../text/index.js';

const t = text.slip;

/** One language column of the slip. */
function Instructions({ lang, copy, account }) {
  return (
    <section lang={lang} className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">{copy.heading}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted">{copy.child}</dt>
        <dd className="font-semibold" lang={account.nameLang}>
          {account.name}
        </dd>
        <dt className="text-muted">{copy.class}</dt>
        <dd className="font-semibold">{account.classSection}</dd>
        <dt className="text-muted">{copy.username}</dt>
        <dd className="font-mono text-lg font-bold">{account.username}</dd>
        <dt className="text-muted">{copy.password}</dt>
        <dd className="font-mono text-lg font-bold tracking-wide">{account.password}</dd>
      </dl>
      <ol className="list-decimal space-y-1 pl-5">
        {copy.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="font-semibold">{copy.help}</p>
    </section>
  );
}

/** The printed sheet: logo, the account, the instructions in English and Bangla. */
export function SlipSheet({ account }) {
  return (
    <article
      aria-label={t.title}
      className="slip-sheet mx-auto flex max-w-[44rem] flex-col gap-5 rounded-card border-2 border-dashed border-line-strong bg-surface p-6 text-ink"
    >
      <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <Logo width={120} />
        <p className="text-right text-sm text-muted">{account.date}</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <Instructions lang="en" copy={t.en} account={account} />
        <Instructions lang="bn" copy={t.bn} account={account} />
      </div>
      <p className="border-t border-line pt-3 text-sm text-muted">
        <span>{t.note.split(' · ')[0]}</span>
        <br />
        <span lang="bn">{t.note.split(' · ')[1]}</span>
      </p>
    </article>
  );
}

/**
 * The guardian's login slip after creating a student or resetting their password. The password
 * lives only in this component's props (never stored); printing shows only the slip
 * (index.css: body.printing-slip). The Bangla font is loaded before the print dialog opens.
 *
 * account: { name, classSection, username, password, date }
 */
export function LoginSlipDialog({ account, onClose }) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const done = () => {
      document.body.classList.remove('printing-slip');
      setPrinting(false);
    };
    window.addEventListener('afterprint', done);
    return () => {
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing-slip');
    };
  }, []);

  const print = async () => {
    setPrinting(true);
    // Hind Siliguri loads on demand (unicode-range): make sure it is there before printing.
    try {
      await document.fonts.load('16px "Hind Siliguri"', 'অআ');
      await document.fonts.ready;
    } catch {
      // Print anyway; the system font still shows Bangla.
    }
    document.body.classList.add('printing-slip');
    window.print();
  };

  return (
    <>
      <Modal
        open={Boolean(account)}
        onClose={onClose}
        size="lg"
        title={t.title}
        description={t.printHint}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.close}
            </Button>
            <Button icon={Printer} onClick={print} loading={printing}>
              {t.print}
            </Button>
          </>
        }
      >
        {account && <SlipSheet account={account} />}
      </Modal>
      {/* The copy that prints: outside the dialog, hidden on screen. */}
      {account &&
        createPortal(
          <div className="print-slip" aria-hidden="true">
            <SlipSheet account={account} />
          </div>,
          document.body,
        )}
    </>
  );
}
