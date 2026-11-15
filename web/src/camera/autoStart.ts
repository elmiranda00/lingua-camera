// Router state that makes the camera page start the camera at once (set by "Open the Camera")
export const START_CAMERA = { startCamera: true } as const;

export function wantsCameraStart(state: unknown): boolean {
  return typeof state === "object" && state !== null && "startCamera" in state && state.startCamera === true;
}
