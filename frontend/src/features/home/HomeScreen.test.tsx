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

describe('HomeScreen components', () => {
  it('PatientCard renders patient name with possessive and stage', () => {
    render(<PatientCard patientName="Mom" diseaseStage="middle" behaviorCount={3} />);
    expect(screen.getByText(/Mom's Profile/)).toBeInTheDocument();
    expect(screen.getByText(/Middle stage/)).toBeInTheDocument();
    expect(screen.getByText(/3 behaviors tracked/)).toBeInTheDocument();
  });

  it('PatientCard shows avatar initial and edit link', () => {
    render(<PatientCard patientName="Dad" diseaseStage="early" />);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('PatientCard shows correct stage labels', () => {
    const { rerender } = render(<PatientCard patientName="Mom" diseaseStage="early" />);
    expect(screen.getByText(/Early stage/)).toBeInTheDocument();

    rerender(<PatientCard patientName="Mom" diseaseStage="late" />);
    expect(screen.getByText(/Late stage/)).toBeInTheDocument();
  });
});
