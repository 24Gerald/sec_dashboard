import React from 'react';

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page__header">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="page__eyebrow">{eyebrow}</div>}
        <h1 className="page__title">{title}</h1>
        {sub && <div className="page__sub">{sub}</div>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </div>
  );
}
