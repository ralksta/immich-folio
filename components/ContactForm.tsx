'use client';

/**
 * Contact form (#702). Posts to /api/contact; see lib/contact.ts for what
 * happens to the message.
 *
 * Spam protection without a captcha, which would be another third party: a
 * honeypot field people never see, and `startedAt`, the time the form was
 * rendered, which the server compares against the submission.
 */

import { useState } from 'react';
import { useDictionary } from './I18nProvider';

interface Props {
  retentionDays: number;
}

type State = 'idle' | 'sending' | 'done';

export default function ContactForm({ retentionDays }: Props) {
  const t = useDictionary().contact;
  // When the form became usable. A bot posting straight to the endpoint has
  // none; one filling the form on load is faster than MIN_FILL_MS.
  const [startedAt] = useState(() => Date.now());
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError('');
    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
          website: data.get('website'),
          startedAt,
        }),
      });
      if (res.ok) {
        setState('done');
        return;
      }
      setError(res.status === 400 ? t.invalid : res.status === 429 ? t.tooMany : t.failed);
    } catch {
      setError(t.failed);
    }
    setState('idle');
  }

  if (state === 'done') {
    return (
      <div className="contact-form__done" role="status">
        <h2>{t.successTitle}</h2>
        <p>{t.successText}</p>
      </div>
    );
  }

  const sending = state === 'sending';

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form__field">
        <label className="contact-form__label" htmlFor="contact-name">
          {t.name}
        </label>
        <input
          id="contact-name"
          name="name"
          className="contact-form__input"
          autoComplete="name"
          maxLength={100}
          required
          disabled={sending}
        />
      </div>

      <div className="contact-form__field">
        <label className="contact-form__label" htmlFor="contact-email">
          {t.email}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          className="contact-form__input"
          autoComplete="email"
          maxLength={200}
          required
          disabled={sending}
        />
      </div>

      <div className="contact-form__field">
        <label className="contact-form__label" htmlFor="contact-message">
          {t.message}
        </label>
        <textarea
          id="contact-message"
          name="message"
          className="contact-form__input"
          maxLength={5000}
          required
          disabled={sending}
        />
      </div>

      <div className="contact-form__trap" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="contact-form__privacy">{t.privacy(retentionDays)}</p>

      {error && (
        <p className="contact-form__error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="contact-form__submit" disabled={sending}>
        {sending ? t.sending : t.submit}
      </button>
    </form>
  );
}
