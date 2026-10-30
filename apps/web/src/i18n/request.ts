import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async () => {
  const locale = await rootParams.locale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = (await import(`../messages/${locale}.json`)) as { default: object };
  return { locale, messages: messages.default, timeZone: 'Europe/Berlin' };
});
