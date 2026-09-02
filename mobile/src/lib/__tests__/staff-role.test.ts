import { toStaffRole } from '../facility-storage';

/**
 * The API types `role` as a bare string, but it decides whether a staff member
 * is routed to the admin dashboard. These tests pin the least-privilege
 * behaviour: anything unrecognised must land on 'staff', never be trusted
 * through as-is.
 */
describe('toStaffRole', () => {
  it('passes through the three known roles', () => {
    expect(toStaffRole('staff')).toBe('staff');
    expect(toStaffRole('admin')).toBe('admin');
    expect(toStaffRole('owner')).toBe('owner');
  });

  it('falls back to the least-privileged role for anything unknown', () => {
    // A role added to the backend that this build doesn't know about must not
    // be forwarded verbatim — it could otherwise land somewhere privileged.
    expect(toStaffRole('superadmin')).toBe('staff');
    expect(toStaffRole('')).toBe('staff');
    expect(toStaffRole('ADMIN')).toBe('staff'); // case-sensitive on purpose
  });

  it('never escalates on malformed input', () => {
    for (const bad of ['admin ', ' owner', 'admin;owner', 'null', 'undefined']) {
      expect(toStaffRole(bad)).toBe('staff');
    }
  });
});
