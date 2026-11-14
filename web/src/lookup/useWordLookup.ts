// React wrapper around the lookup controller
import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { pinyinFor } from "../lang/pinyin.ts";
import { createLookupController, type SheetState } from "./lookupController.ts";

export function useWordLookup() {
  const [state, setState] = useState<SheetState>({ status: "idle" });
  // Created once; its callbacks always point at the latest setState
  const [controller] = useState(() =>
    createLookupController(
      {
        lookup: (req, signal) => api.lookup(req, { signal }),
        pinyin: pinyinFor,
      },
      setState,
    ),
  );
  useEffect(() => () => controller.reset(), [controller]);
  return { state, controller };
}
