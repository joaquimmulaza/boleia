import React from 'react';
import { User } from 'lucide-react';

/**
 * @param {{ nome: string; tipoPerfil: string; avatarUrl?: string | null }} props
 */
export default function ProfileIdentityHeader({ nome, tipoPerfil, avatarUrl }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="size-20 shrink-0 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden"
        aria-hidden={avatarUrl ? undefined : true}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <User className="size-10 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground truncate">{nome || 'Utilizador'}</p>
        <p className="text-sm text-muted-foreground">{tipoPerfil}</p>
      </div>
    </div>
  );
}
