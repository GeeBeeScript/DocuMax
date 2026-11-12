import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useThrottledRefresh } from "./use-throttled-refresh";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("useThrottledRefresh", () => {
  it("refreshes at once, then collapses a burst into one trailing refresh", () => {
    const { result } = renderHook(() => useThrottledRefresh(1000));
    result.current();
    expect(refresh).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) result.current();
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes immediately again once the window has passed", () => {
    const { result } = renderHook(() => useThrottledRefresh(1000));
    result.current();
    vi.advanceTimersByTime(1500);
    result.current();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending refresh on unmount", () => {
    const { result, unmount } = renderHook(() => useThrottledRefresh(1000));
    result.current();
    result.current();
    unmount();
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
