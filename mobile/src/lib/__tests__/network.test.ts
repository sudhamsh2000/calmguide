/**
 * Tests for useNetworkStatus (P2-12 offline/degraded-mode scaffolding).
 * NetInfo itself is mocked via jest.setup.js (the package's official mock);
 * these tests drive it directly through the mocked addEventListener/fetch.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../network';

type Listener = (state: Partial<import('@react-native-community/netinfo').NetInfoState>) => void;

function mockNetInfo(initial: Partial<import('@react-native-community/netinfo').NetInfoState>) {
  let listener: Listener | null = null;
  (NetInfo.fetch as jest.Mock).mockResolvedValue(initial);
  (NetInfo.addEventListener as jest.Mock).mockImplementation((cb: Listener) => {
    listener = cb;
    return jest.fn();
  });
  return {
    emit: (state: Partial<import('@react-native-community/netinfo').NetInfoState>) => {
      act(() => listener?.(state));
    },
  };
}

describe('useNetworkStatus', () => {
  it('reports online once NetInfo resolves a connected state', async () => {
    mockNetInfo({ isConnected: true, isInternetReachable: true });
    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isOnline).toBe(true));
    expect(result.current.justReconnected).toBe(false);
  });

  it('reports offline when isConnected is false', async () => {
    mockNetInfo({ isConnected: false, isInternetReachable: false });
    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isOnline).toBe(false));
  });

  it('does not treat unknown isInternetReachable as offline', async () => {
    // Link layer connected, but the reachability probe hasn't resolved yet —
    // a false positive here would show an incorrect offline banner on cold start.
    mockNetInfo({ isConnected: true, isInternetReachable: null });
    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isOnline).toBe(true));
  });

  it('flags justReconnected only on the offline -> online transition', async () => {
    const { emit } = mockNetInfo({ isConnected: false, isInternetReachable: false });
    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isOnline).toBe(false));
    expect(result.current.justReconnected).toBe(false);

    emit({ isConnected: true, isInternetReachable: true });
    await waitFor(() => expect(result.current.isOnline).toBe(true));
    expect(result.current.justReconnected).toBe(true);
  });
});
