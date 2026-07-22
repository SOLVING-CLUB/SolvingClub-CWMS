import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action, imageSrc, imageAlt = "" }: {
  icon: ReactNode; title: string; description: string; action?: ReactNode; imageSrc?: string; imageAlt?: string;
}) {
  return (
    <div className={`empty-panel${imageSrc ? " with-visual" : ""}`}>
      {imageSrc && <img className="empty-visual" src={imageSrc} alt={imageAlt} loading="lazy" />}
      <div className="empty-copy"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p>{action}</div>
    </div>
  );
}
