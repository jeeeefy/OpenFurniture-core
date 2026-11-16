import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';

describe('App smoke', () => {
  it('renders the title in jsdom', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Panel Furniture Designer' })).toBeDefined();
  });
});
