import { LogIn, User, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input, PasswordInput } from '../../../components/ui/Input.jsx';
import { PageTitle } from '../../../components/ui/PageTitle.jsx';
import { ROLE_HOME, ROLES } from '../../../config/constants.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import {
  forgetAccount,
  rememberAccount,
  rememberedAccounts,
} from '../../../lib/rememberedAccounts.js';
import { childName } from '../../../utils/names.js';
import { text as studentText } from '../../student/text/index.js';
import { useAuth } from '../hooks/useAuth.js';
import { useLogin } from '../hooks/useLogin.js';
import { loginSchema } from '../schemas.js';

/** Where to go after sign-in: the page they wanted, if their role may see it; else their home. */
function destinationFor(user, from) {
  const home = ROLE_HOME[user.role];
  const wanted = from?.pathname;
  return wanted && (wanted === home || wanted.startsWith(`${home}/`))
    ? `${wanted}${from.search ?? ''}`
    : home;
}

const t = studentText.switchChild;

/**
 * Children used on this device (usernames and names only): tap one to fill the username, or
 * remove it. Shown whenever the device remembers someone; "Switch child" opens this page.
 */
function RememberedChildren({ accounts, onChoose, onRemove, highlight }) {
  const [removed, setRemoved] = useState('');
  return (
    <section
      aria-labelledby="remembered-title"
      className={highlight ? 'mt-5 rounded-card bg-blush-50 p-3' : 'mt-5'}
    >
      <h2 id="remembered-title" className="font-bold">
        {t.choose}
      </h2>
      <p className="text-sm text-muted">{t.chooseHint}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {accounts.map((account) => {
          const label = t.chip(account.name, account.username);
          return (
            <li
              key={account.username}
              className="flex items-center rounded-full border border-line-strong bg-surface"
            >
              <button
                type="button"
                onClick={() => onChoose(account.username)}
                className="flex min-h-12 items-center gap-2 rounded-l-full py-1 pr-2 pl-3 font-semibold text-ink hover:bg-blush-50"
              >
                <UserRound aria-hidden="true" className="size-5 text-brand-700" />
                {label}
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(account.username);
                  setRemoved(t.removed(label));
                }}
                aria-label={t.remove(label)}
                title={t.remove(label)}
                className="grid size-12 place-items-center rounded-r-full text-sand-600 hover:bg-blush-50 hover:text-absent-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" className="sr-only">
        {removed}
      </p>
    </section>
  );
}

export default function LoginPage() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const loginMutation = useLogin();
  const form = useZodForm(loginSchema, { defaultValues: { identifier: '', password: '' } });
  const { errors, isSubmitting } = form.formState;
  const [accounts, setAccounts] = useState(rememberedAccounts);

  const onSubmit = async (values) => {
    const signedIn = await loginMutation.mutateAsync(values);
    // Only children's accounts are remembered (shared phones), never passwords or tokens.
    if (signedIn.role === ROLES.STUDENT) {
      rememberAccount({ username: signedIn.username, name: childName(signedIn) });
    }
  };
  const choose = (username) => {
    form.setValue('identifier', username, { shouldValidate: true });
    form.setFocus('password');
  };
  const remove = (username) => {
    forgetAccount(username);
    setAccounts(rememberedAccounts());
  };

  if (isAuthenticated) {
    return <Navigate to={destinationFor(user, location.state?.from)} replace />;
  }

  return (
    <>
      <PageTitle title="Log in" />
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-muted">Parents and guardians use the student&apos;s account.</p>

      {accounts.length > 0 && (
        <RememberedChildren
          accounts={accounts}
          onChoose={choose}
          onRemove={remove}
          highlight={params.get('switch') === '1'}
        />
      )}

      <form onSubmit={form.submit(onSubmit)} className="mt-6 flex flex-col gap-4" noValidate>
        <FormField label="Username or email" error={errors.identifier?.message}>
          <Input
            id="identifier"
            icon={User}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...form.register('identifier')}
          />
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...form.register('password')}
          />
        </FormField>

        {form.formError && <Alert tone="error">{form.formError}</Alert>}

        <Button type="submit" size="lg" icon={LogIn} loading={isSubmitting} fullWidth>
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
    </>
  );
}
