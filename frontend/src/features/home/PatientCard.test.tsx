import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientCard } from './PatientCard';

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      const messages: Record<string, string> = {
        'view.middle_stage': 'Middle stage',
        'view.early_stage': 'Early stage',
        'view.late_stage': 'Late stage',
        'card.title': `${values?.name}'s Profile`,
        'card.behaviors_tracked': `${values?.count} behaviors tracked`,
        'actions.edit': 'Edit',
      };
      return messages[key] ?? key;
    };
    t.has = (key: string) =>
      ['view.middle_stage', 'view.early_stage', 'view.late_stage'].includes(key);
    return t;
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('PatientCard', () => {
  it('displays the patient name with possessive', () => {
    render(<PatientCard patientName="Mom" diseaseStage="middle" />);
    expect(screen.getByText(/Mom's Profile/)).toBeInTheDocument();
  });

  it('displays the disease stage', () => {
    render(<PatientCard patientName="Mom" diseaseStage="middle" />);
    expect(screen.getByText(/Middle stage/)).toBeInTheDocument();
  });

  it('displays behavior count when provided', () => {
    render(<PatientCard patientName="Mom" diseaseStage="middle" behaviorCount={3} />);
    expect(screen.getByText(/3 behaviors tracked/)).toBeInTheDocument();
  });

  it('shows avatar initial', () => {
    render(<PatientCard patientName="Margaret" diseaseStage="early" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('has an Edit link to profile page', () => {
    render(<PatientCard patientName="Dad" diseaseStage="late" />);
    const editLink = screen.getByText('Edit');
    expect(editLink.closest('a')).toHaveAttribute('href', '/profile');
  });

  it('accepts a custom className', () => {
    const { container } = render(
      <PatientCard patientName="Mom" diseaseStage="middle" className="my-custom" />,
    );
    expect(container.firstChild).toHaveClass('my-custom');
  });

  it('shows the monogram by default, not a portrait', () => {
    const { container } = render(<PatientCard patientName="Margaret" diseaseStage="early" />);
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('replaces the monogram with the chosen portrait', () => {
    const { container } = render(
      <PatientCard patientName="Tarun" diseaseStage="early" avatar="male" />,
    );
    expect(screen.queryByText('T')).toBeNull();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('avatar-male');
  });

  it('uses the female portrait when that is the choice', () => {
    const { container } = render(
      <PatientCard patientName="Asha" diseaseStage="late" avatar="female" />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toContain('avatar-female');
  });

  it('leaves the portrait out of the accessible name, which the heading carries', () => {
    const { container } = render(
      <PatientCard patientName="Tarun" diseaseStage="early" avatar="male" />,
    );
    // Decorative: the card already says "Tarun's Profile" in text, so an
    // alt here would just repeat it to a screen reader.
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
