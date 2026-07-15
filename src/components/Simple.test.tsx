import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

const DummyComponent = () => <div>Hello, Vitest!</div>;

describe('Simple Test', () => {
  it('renders dummy component', () => {
    render(<DummyComponent />);
    expect(screen.getByText('Hello, Vitest!')).toBeInTheDocument();
  });
});
