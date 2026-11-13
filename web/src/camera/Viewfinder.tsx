// Live rear-camera preview; reports when the camera is ready or blocked
import { useEffect, type RefObject } from "react";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  onReady: () => void;
  onUnavailable: () => void;
}

export function Viewfinder({ videoRef, onReady, onUnavailable }: Props) {
  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      onUnavailable();
      return;
    }
    media
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play().catch(() => {});
        }
        onReady();
      }, onUnavailable);
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef, onReady, onUnavailable]);

  return <video ref={videoRef} className="viewfinder" playsInline muted autoPlay aria-label="Camera view" />;
}
