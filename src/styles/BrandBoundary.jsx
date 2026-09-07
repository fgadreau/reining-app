import React from 'react';
import { useLocation } from 'react-router-dom';
import './brand.css';

// Include shortcut screens, livestream TV and broadcast overlays in the exclusion.
export function isProtectedDisplayPath(pathname) {
  return /^\/tv(?:\/|$)/.test(pathname) ||
    /^\/public\/associations\/[^/]+\/shows\/[^/]+\/(?:tv|livestream\/tv|overlay)(?:\/|$)/.test(pathname);
}

export default function BrandBoundary({ children }) {
  const { pathname } = useLocation();
  return isProtectedDisplayPath(pathname) ? children : (
    <div className="showscore-theme" style={{ display: 'contents' }}>{children}</div>
  );
}
