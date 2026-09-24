import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

import { splitServerErrors } from '../lib/serverErrors.js';

/**
 * react-hook-form + Zod, plus server errors:
 *
 *   const form = useZodForm(schema, { defaultValues });
 *   <form onSubmit={form.submit((values) => mutation.mutateAsync(values))}>
 *     <FormField label="Name" error={form.formState.errors.name?.message}>…
 *     {form.formError && <Alert tone="error">{form.formError}</Alert>}
 *
 * If the submit handler throws an ApiClientError, 422 field errors are set on their fields (the
 * first one is focused) and anything else becomes `formError`.
 */
export function useZodForm(schema, { defaultValues, ...options } = {}) {
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues,
    ...options,
  });
  const [formError, setFormError] = useState(null);
  const { getValues, setError, handleSubmit } = form;

  const setServerError = useCallback(
    (error) => {
      const { fieldErrors, formMessage } = splitServerErrors(error, Object.keys(getValues()));
      fieldErrors.forEach(({ field, message }, i) =>
        setError(field, { type: 'server', message }, { shouldFocus: i === 0 }),
      );
      setFormError(formMessage);
    },
    [getValues, setError],
  );

  const submit = useCallback(
    (onValid) =>
      handleSubmit(async (values) => {
        setFormError(null);
        try {
          await onValid(values);
        } catch (error) {
          setServerError(error);
        }
      }),
    [handleSubmit, setServerError],
  );

  return { ...form, formError, setFormError, setServerError, submit };
}
