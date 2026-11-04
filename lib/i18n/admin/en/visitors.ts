/**
 * The sidebar's "Visitors" group: the contact form inbox, client proofing
 * links and the view counts.
 */
export const visitors = {
  /** The page header's kicker above each of the three screens. */
  kicker: 'Visitors',
  refresh: 'Refresh',

  messages: {
    title: 'Messages',
    unread: (n: number) => `${n} unread`,
    description: (days: number) =>
      `Sent through the contact form at /contact. Stored on this server and deleted after ${days} days.`,
    /** `{link}` is a link labelled with `formOffLink`. */
    formOff: 'The contact form is switched off, so no new messages arrive. {link}.',
    formOffLink: 'Turn it on in Settings → Legal',
    noNotify: 'No notification is set up, so new messages only show up here. {link}.',
    noNotifyLink: 'Add an ntfy URL in Settings → Legal',
    empty: 'No messages.',
    /** Read out after the sender's name by screen readers. */
    unreadMarker: ' (unread)',
    reply: 'Reply by email',
    markUnread: 'Mark unread',
    delete: 'Delete',
    deleteTitle: (name: string) => `Delete the message from ${name}?`,
    deleteMessage: 'It is removed from this server and cannot be restored.',
    deleteFailed: (status: number) => `Delete failed (HTTP ${status}).`,
    /** The reply mail's subject line, prefilled in the owner's mail client. */
    replySubject: 'Re: your message',
    /** Introduces the quoted original in the reply mail. */
    replyQuote: (name: string) => `${name} wrote:`,
  },

  proofing: {
    title: 'Client proofing',
    description:
      'A private link per client. Picks are saved as they go; you see them here once they submit.',
    /** `{env}` is the PROOFING_WEBHOOK_URL variable name. */
    webhookTip:
      'Tip: set {env} to be notified (Discord, Slack, Gotify, n8n, …) when a client submits.',
    empty: 'No client links yet.',
    states: {
      open: 'Open',
      submitted: 'Submitted',
      expired: 'Expired',
    },
    downloads: {
      none: 'No downloads',
      selection: 'Selection as ZIP',
      album: 'Whole album as ZIP',
    },
    create: {
      title: 'New client link',
      client: 'Client',
      clientPlaceholder: 'Anna & Ben',
      album: 'Album',
      chooseAlbum: 'Choose an Immich album…',
      loadingAlbums: 'Loading albums…',
      validUntil: 'Valid until (optional)',
      downloads: 'Downloads',
      limit: 'Download limit (optional)',
      unlimited: 'Unlimited',
      creating: 'Creating…',
      submit: 'Create link',
    },
    card: {
      albumMissing: 'Album not found in Immich',
      /** `of` is null when the album's size is unknown. */
      selected: (n: number, of: number | null) =>
        of === null ? `${n} selected` : `${n} of ${of} selected`,
      created: (date: string) => `created ${date}`,
      validUntil: (date: string) => `valid until ${date}`,
      /** `limit` is null when downloads are unlimited. */
      downloadsUsed: (used: number, limit: number | null) =>
        limit === null ? `${used} used` : `${used} / ${limit} used`,
      submitted: (date: string) => `submitted ${date}`,
      copied: 'Copied',
      copyLink: 'Copy link',
      /** Label of the browser prompt shown when the clipboard is unavailable. */
      copyPrompt: 'Copy:',
      open: 'Open',
      selection: 'Selection',
      lightroomTitle:
        "File names without extension, comma-separated — paste into Lightroom's or Capture One's filename filter to find the RAW files too",
      copyLightroom: 'Copy file names (Lightroom)',
      reopen: 'Reopen for changes',
      resetDownloads: 'Reset downloads',
      deleteLink: 'Delete link',
      deleteConfirm: (client: string) => `Delete the link for ${client}? It stops working at once.`,
      noPicks: 'No photos selected yet.',
    },
  },

  analytics: {
    title: 'Analytics',
    description: 'Cookieless page counts, kept on this server. No personal data is collected.',
    /** `{title}` is `disabledTitle`, shown bold; `{where}` is `disabledWhere`, in italics. */
    disabled:
      '{title} No new visitor views are being recorded. You can re-enable tracking anytime under {where}.',
    disabledTitle: 'Analytics Tracking is Currently Disabled.',
    disabledWhere: 'Settings → General',
    totalViews: 'Total Page Views',
    lifetime: 'Lifetime aggregate',
    activeDays: 'Active Days Tracked',
    daysRecorded: 'Days recorded',
    devices: 'Desktop vs Mobile',
    deviceSplit: 'Device distribution',
    dailyTrend: 'Daily Traffic Trend (Last 14 Days)',
    /** Tooltip on one bar of the chart. */
    dayViews: (date: string, n: number) => `${date}: ${n} views`,
    noViews: 'No pageviews recorded yet. Visit portfolio pages to start tracking!',
    topPages: 'Top Visited Pages',
    noPages: 'No pages recorded yet.',
    pageViews: (n: number) => `${n} views`,
  },
};
