// Photo from the gallery, or the phone's own camera app when the live camera is blocked
import type { ChangeEvent } from "react";

interface Props {
  showTakePhoto: boolean;
  onPhoto: (file: File) => void;
}

export function PhotoPickers({ showTakePhoto, onPhoto }: Props) {
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same photo again must still fire
    if (file) onPhoto(file);
  };
  return (
    <div className="pickers">
      {showTakePhoto && (
        <label className="button button-primary">
          Take photo
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
        </label>
      )}
      <label className="button">
        Choose from gallery
        <input type="file" accept="image/*" onChange={pick} hidden />
      </label>
    </div>
  );
}
