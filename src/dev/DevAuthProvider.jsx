import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';

/**
 * Provider DEV-only para capturas / fixtures (sobrepõe AuthContext via API pública).
 * @param {{ children: React.ReactNode; value: Record<string, unknown> }} props
 */
export default function DevAuthProvider({ children, value }) {
  return <AuthProvider devValue={value}>{children}</AuthProvider>;
}
