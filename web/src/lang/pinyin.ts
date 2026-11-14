// Pinyin with tone marks, computed on the phone
//
// pinyin-pro is large, so it is only fetched for Chinese (a separate file from our own origin)
const HAN = /\p{Script=Han}/u;

type PinyinFn = (word: string, options: { toneType: "symbol"; nonZh: "consecutive" }) => string;

let loading: Promise<PinyinFn | null> | null = null;

/** Starts fetching pinyin-pro; safe to call often. A failed fetch can be retried by the next call. */
export function preloadPinyin(): Promise<PinyinFn | null> {
  loading ??= import("pinyin-pro")
    .then((m) => m.pinyin as PinyinFn)
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

/** "chū kǒu" for 出口; null for text without Han characters or when pinyin-pro isn't available. */
export async function pinyinFor(word: string): Promise<string | null> {
  if (!HAN.test(word)) return null;
  const pinyin = await preloadPinyin();
  return pinyin ? pinyin(word, { toneType: "symbol", nonZh: "consecutive" }) : null;
}
