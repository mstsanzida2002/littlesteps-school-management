import { LogIn, User } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input, PasswordInput } from '../../../components/ui/Input.jsx';
import { PageTitle } from '../../../components/ui/PageTitle.jsx';
import { ROLE_HOME } from '../../../config/constants.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
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

export default function LoginPage() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const loginMutation = useLogin();
  const form = useZodForm(loginSchema, { defaultValues: { identifier: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  if (isAuthenticated) {
    return <Navigate to={destinationFor(user, location.state?.from)} replace />;
  }

  return (
    <>
      <PageTitle title="Log in" />
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-muted">Parents and guardians use the student&apos;s account.</p>

      <form
        onSubmit={form.submit((values) => loginMutation.mutateAsync(values))}
        className="mt-6 flex flex-col gap-4"
        noValidate
      >
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
