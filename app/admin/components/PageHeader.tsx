import type { ReactNode } from 'react';

/**
 * The one screen header (UX stage 2, docs/admin-ux-concept.md): kicker with
 * the site's square marker, title, one sentence, actions on the right. Every
 * screen used to build its own, each with a different size and position.
 */
export default function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <p className="page-header-kicker">{kicker}</p>
        <h1 className="page-header-title">{title}</h1>
        {description && <p className="page-header-sub">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
