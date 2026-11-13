// Language registry: components ask for a module by language and never branch on it
import type { Lang } from "@lingua-camera/shared";
import { fr } from "./fr.ts";
import type { LangModule } from "./types.ts";
import { zh } from "./zh.ts";

const modules: Record<Lang, LangModule> = { fr, zh };

export const getLang = (lang: Lang): LangModule => modules[lang];
