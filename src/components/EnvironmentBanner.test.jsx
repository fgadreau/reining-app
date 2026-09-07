import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import EnvironmentBanner from './EnvironmentBanner';
const config = vi.hoisted(() => ({ error: '', label: 'STAGING' }));
vi.mock('../features/cloud/deployEnvironment', () => ({ getConfiguredSupabaseProjectRef: () => 'fiction', getDeployEnvironmentLabel: () => config.label, getSupabaseConfigurationError: () => config.error }));
afterEach(() => { cleanup(); config.error = ''; config.label = 'STAGING'; });
function setup(path = '/') {
 return render(<MemoryRouter initialEntries={[path]}><EnvironmentBanner />{['/associations','/tv','/public/associations/a/shows/s/tv','/public/associations/a/shows/s/livestream/tv','/public/associations/a/shows/s/overlay'].map(p=><Link key={p} to={p}>{p}</Link>)}</MemoryRouter>);
}
test('hides informational banner on all broadcast routes and restores it during SPA navigation', () => {
 setup(); expect(screen.queryByRole('status')).not.toBeNull();
 for(const path of ['/tv','/public/associations/a/shows/s/tv','/public/associations/a/shows/s/livestream/tv','/public/associations/a/shows/s/overlay']) {
 fireEvent.click(screen.getByText(path)); expect(screen.queryByRole('status')).toBeNull();
 fireEvent.click(screen.getByText('/associations')); expect(screen.queryByRole('status')).not.toBeNull();
 }
});
test('configuration error remains visible on TV and management including production without label', () => {
 config.error = 'Fictitious invalid configuration'; config.label = null; setup('/tv');
 expect(screen.getByRole('alert').textContent).toContain('CONFIGURATION BLOQUÉE');
 fireEvent.click(screen.getByText('/associations')); expect(screen.getByRole('alert')).not.toBeNull();
 fireEvent.click(screen.getByText('/public/associations/a/shows/s/tv')); expect(screen.getByRole('alert')).not.toBeNull();
});
