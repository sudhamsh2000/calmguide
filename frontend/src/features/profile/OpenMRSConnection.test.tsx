import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpenMRSConnection } from './OpenMRSConnection';

const FRANK = 'fba2fc07-8bbd-447b-8aaa-c4b8dfcfec63';

const api = vi.hoisted(() => ({
  getClinicalLink: vi.fn(),
  previewClinicalLink: vi.fn(),
  linkClinicalRecord: vi.fn(),
  testClinicalLink: vi.fn(),
  unlinkClinicalRecord: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ApiError: actual.ApiError, ...api };
});

const { ApiError } = await import('@/lib/api');

const connectedStatus = {
  linked: true,
  source: 'openmrs',
  linked_at: new Date().toISOString(),
  last_synced_at: new Date().toISOString(),
  last_status: 'ok',
  patient_ref_hint: 'ec63',
};

function renderRow() {
  return render(
    <OpenMRSConnection
      accessCode="FRNKKOWL"
      patientName="Frank"
      name="OpenMRS"
      hint="Sync clinical information"
      icon={null}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpenMRSConnection', () => {
  it('keeps the "Coming soon" behaviour when the server has it switched off', async () => {
    api.getClinicalLink.mockRejectedValue(
      new ApiError('disabled', 404, { code: 'FEATURE_DISABLED' }),
    );
    renderRow();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled();
    expect(screen.queryByLabelText('OpenMRS patient ID')).not.toBeInTheDocument();
  });

  it('links after the caregiver confirms the right person', async () => {
    api.getClinicalLink.mockResolvedValue({ ...connectedStatus, linked: false });
    api.previewClinicalLink.mockResolvedValue({ display_name: 'Frank' });
    api.linkClinicalRecord.mockResolvedValue(connectedStatus);
    renderRow();

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    fireEvent.change(screen.getByLabelText('OpenMRS patient ID'), {
      target: { value: ` ${FRANK.toUpperCase()} ` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Link to Frank?')).toBeInTheDocument();
    expect(api.previewClinicalLink).toHaveBeenCalledWith('FRNKKOWL', FRANK);
    expect(api.linkClinicalRecord).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(api.linkClinicalRecord).toHaveBeenCalledWith('FRNKKOWL', FRANK);
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeInTheDocument();
  });

  it('rejects a malformed ID without calling the server', async () => {
    api.getClinicalLink.mockResolvedValue({ ...connectedStatus, linked: false });
    renderRow();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    fireEvent.change(screen.getByLabelText('OpenMRS patient ID'), {
      target: { value: 'frank' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "doesn't look like an OpenMRS patient ID",
    );
    expect(api.previewClinicalLink).not.toHaveBeenCalled();
  });

  it('says so when no patient has that ID', async () => {
    api.getClinicalLink.mockResolvedValue({ ...connectedStatus, linked: false });
    api.previewClinicalLink.mockRejectedValue(
      new ApiError('missing', 404, { code: 'PATIENT_NOT_FOUND' }),
    );
    renderRow();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    fireEvent.change(screen.getByLabelText('OpenMRS patient ID'), {
      target: { value: FRANK },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No patient with that ID');
  });

  it('asks before disconnecting', async () => {
    api.getClinicalLink.mockResolvedValue(connectedStatus);
    api.unlinkClinicalRecord.mockResolvedValue({ ...connectedStatus, linked: false });
    renderRow();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(api.unlinkClinicalRecord).not.toHaveBeenCalled();
    expect(screen.getByText(/Disconnect the health record\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(api.unlinkClinicalRecord).toHaveBeenCalledWith('FRNKKOWL');
  });

  it('tells the caregiver the coach keeps working when the record is unreachable', async () => {
    api.getClinicalLink.mockResolvedValue({ ...connectedStatus, last_status: 'unavailable' });
    renderRow();
    expect(
      await screen.findByText(/Moment Coach will keep working without it/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
