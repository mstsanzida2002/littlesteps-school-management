import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { generateTempPassword } from '../../../utils/tempPassword.js';
import { text } from '../text/index.js';

const t = text.tempPassword;

/**
 * A temporary password input with "Generate" (utils/tempPassword.js) and "Copy". Controlled:
 * value + onChange(password). Put it inside a FormField. The password lives only in form state.
 */
export function TempPasswordField({ value, onChange, invalid, id, ...props }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the password is visible to copy by hand.
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        invalid={invalid}
        autoComplete="new-password"
        spellCheck={false}
        className="font-mono"
        {...props}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={() => onChange(generateTempPassword())}
        >
          {t.generate}
        </Button>
        <Button
          variant="ghost"
          icon={copied ? Check : Copy}
          onClick={copy}
          disabled={!value}
          aria-live="polite"
        >
          {copied ? t.copied : t.copy}
        </Button>
      </div>
    </div>
  );
}
