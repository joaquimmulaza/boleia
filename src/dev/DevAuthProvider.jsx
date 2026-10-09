import React from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Provider DEV-only para capturas / fixtures (sobrepõe AuthContext).
 * @param {{ children: React.ReactNode; value: Record<string, unknown> }} props
 */
export default function DevAuthProvider({ children, value }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
