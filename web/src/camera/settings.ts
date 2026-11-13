// The chosen language, remembered on this phone
import { Lang } from "@lingua-camera/shared";

const KEY = "lc.lang";

export function readStoredLang(): Lang {
  try {
    const parsed = Lang.safeParse(localStorage.getItem(KEY));
    return parsed.success ? parsed.data : "fr";
  } catch {
    return "fr"; // storage blocked
  }
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // storage blocked: the choice just isn't remembered
  }
}
