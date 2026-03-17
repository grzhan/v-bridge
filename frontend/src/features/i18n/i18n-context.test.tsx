import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';

import { I18nProvider, LANGUAGE_STORAGE_KEY, useI18n } from '@/features/i18n/i18n-context';

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('I18nProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('falls back to en when localStorage is empty', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.language).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('reads persisted language preference', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.language).toBe('en');
  });

  it('updates language preference in state and storage', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => {
      result.current.setLanguage('zh-CN');
    });

    expect(result.current.language).toBe('zh-CN');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN');
  });

  it('translates keys with the current language', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.t('auth.login.title')).toBe('Log in');

    act(() => {
      result.current.setLanguage('zh-CN');
    });

    expect(result.current.t('auth.login.title')).toBe('登录');
  });

  it('replaces template parameters', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.t('user.orders.release.success', { ratio: 50, amount: '$10.00' })).toContain('Refund 50');

    act(() => {
      result.current.setLanguage('zh-CN');
    });

    expect(result.current.t('user.orders.release.success', { ratio: 50, amount: '¥10.00' })).toContain('50');
  });
});
