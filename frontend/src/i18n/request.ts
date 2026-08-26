import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { hasLocale } from "next-intl";
import fs from "fs";
import path from "path";
import { DEFAULT_LOCALE, resolveLocaleMessageDir } from "@/lib/locale";

const NAMESPACES = ["common", "coach", "home", "checkin", "learn", "profile", "impact", "journey", "incidents", "facility"] as const;

function resolveLocalesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "..", "locales"),
    path.resolve(process.cwd(), "locales"),
  ];
  const defaultLocaleDir = resolveLocaleMessageDir(DEFAULT_LOCALE);

  const found = candidates.find((dir) =>
    fs.existsSync(path.join(dir, defaultLocaleDir, "common.json"))
  );

  return found ?? candidates[candidates.length - 1];
}

const LOCALES_DIR = resolveLocalesDir();

function loadMessages(locale: string): Record<string, unknown> {
  const messages: Record<string, unknown> = {};
  const messageDir = resolveLocaleMessageDir(locale);
  for (const ns of NAMESPACES) {
    try {
      const filePath = path.join(LOCALES_DIR, messageDir, `${ns}.json`);
      const content = fs.readFileSync(filePath, "utf-8");
      messages[ns] = JSON.parse(content);
    } catch {
      // Fall back to empty — next-intl will use defaultLocale messages
      messages[ns] = {};
    }
  }
  return messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: loadMessages(locale),
  };
});
