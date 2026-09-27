'use client';

/**
 * The contact form inbox at /admin/messages (#702). Messages live in
 * content/messages/ (lib/contact.ts); replying happens in the owner's own
 * mail client through a mailto: link, since Folio sends no mail.
 */

import { useState } from 'react';
import Link from 'next/link';
import * as Icons from './Icons';
import { reportIfSessionExpired } from './sessionExpiry';
import { useAdminFetch } from './useAdminFetch';
import AdminLoadState from './AdminLoadState';
import type { ContactMessage } from '@/lib/contact';
import { useNotify } from './Notifications';
import PageHeader from './PageHeader';
import { useConfirm } from './ConfirmDialog';

interface InboxData {
  enabled: boolean;
  notifyConfigured: boolean;
  retentionDays: number;
  messages: ContactMessage[];
}

function replyHref(m: ContactMessage): string {
  const subject = encodeURIComponent('Re: your message');
  const quoted = m.message
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const body = encodeURIComponent(`\n\n${m.name} wrote:\n${quoted}`);
  // Encoded so a ? or & in the address cannot start the query, with the @
  // put back: not every mail client decodes %40 in the address part.
  const to = encodeURIComponent(m.email).replace(/%40/g, '@');
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

export default function MessagesView() {
  const confirm = useConfirm();
  const notify = useNotify();
  const inbox = useAdminFetch<InboxData>('/api/admin/messages');
  const data = inbox.data;
  const [open, setOpen] = useState<string | null>(null);

  async function markRead(m: ContactMessage, read: boolean) {
    const res = await fetch('/api/admin/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, read }),
    });
    if (!res.ok) {
      reportIfSessionExpired(res);
      return;
    }
    inbox.mutate((d) => ({
      ...d,
      messages: d.messages.map((x) => (x.id === m.id ? { ...x, read } : x)),
    }));
  }

  function toggle(m: ContactMessage) {
    const opening = open !== m.id;
    setOpen(opening ? m.id : null);
    if (opening && !m.read) markRead(m, true);
  }

  async function remove(m: ContactMessage) {
    const ok = await confirm({
      title: `Delete the message from ${m.name}?`,
      message: 'It is removed from this server and cannot be restored.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/messages?id=${encodeURIComponent(m.id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      if (!reportIfSessionExpired(res)) notify('error', `Delete failed (HTTP ${res.status}).`);
      return;
    }
    inbox.mutate((d) => ({ ...d, messages: d.messages.filter((x) => x.id !== m.id) }));
  }

  if (!data || inbox.error) {
    return (
      <AdminLoadState
        loading={inbox.loading}
        error={inbox.error}
        onRetry={inbox.reload}
        hasData={!!data}
      />
    );
  }

  const unread = data.messages.filter((m) => !m.read).length;

  return (
    <div className="messages-view">
      <PageHeader
        kicker="Visitors"
        title={
          <>
            Messages
            {unread > 0 && <span className="messages-count">{unread} unread</span>}
          </>
        }
        description={`Sent through the contact form at /contact. Stored on this server and deleted after ${data.retentionDays} days.`}
        actions={
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={inbox.reload}>
            <Icons.IconRefresh size={14} /> Refresh
          </button>
        }
      />

      {!data.enabled && (
        <div className="messages-notice">
          The contact form is switched off, so no new messages arrive.{' '}
          <Link href="/admin/settings/legal">Turn it on in Settings → Legal</Link>.
        </div>
      )}
      {data.enabled && !data.notifyConfigured && (
        <div className="messages-notice">
          No notification is set up, so new messages only show up here.{' '}
          <Link href="/admin/settings/legal">Add an ntfy URL in Settings → Legal</Link>.
        </div>
      )}

      {data.messages.length === 0 ? (
        <div className="analytics-panel messages-empty">No messages.</div>
      ) : (
        <ul className="messages-list">
          {data.messages.map((m) => {
            const expanded = open === m.id;
            return (
              <li
                key={m.id}
                className={`messages-item${m.read ? '' : ' messages-item--unread'}${expanded ? ' messages-item--open' : ''}`}
              >
                <button
                  type="button"
                  className="messages-summary"
                  onClick={() => toggle(m)}
                  aria-expanded={expanded}
                >
                  <span className="messages-dot" aria-hidden="true" />
                  <span className="messages-from">
                    {m.name}
                    {!m.read && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="messages-preview">{m.message.slice(0, 120)}</span>
                  <time className="messages-date" dateTime={m.receivedAt}>
                    {new Date(m.receivedAt).toLocaleString()}
                  </time>
                </button>
                {expanded && (
                  <div className="messages-body">
                    <p className="messages-meta">
                      {m.name} &lt;{m.email}&gt;
                    </p>
                    <p className="messages-text">{m.message}</p>
                    <div className="messages-actions">
                      <a className="admin-btn admin-btn-primary admin-btn-sm" href={replyHref(m)}>
                        Reply by email
                      </a>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={() => markRead(m, false)}
                      >
                        Mark unread
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={() => remove(m)}
                      >
                        <Icons.IconTrash size={14} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
