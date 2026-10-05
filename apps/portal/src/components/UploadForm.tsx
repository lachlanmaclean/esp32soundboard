"use client";

import { useState } from "react";

/** Starts as a single button; expands into the actual fields only once the user commits to uploading. */
export function UploadForm({
  action,
  buttonLabel,
}: {
  action: (formData: FormData) => void;
  buttonLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button className="btn btn-primary" type="button" onClick={() => setExpanded(true)}>
        {buttonLabel}
      </button>
    );
  }

  return (
    <form action={action} className="field-row">
      <input type="text" name="displayName" placeholder="Name" required autoFocus />
      <input type="color" name="color" defaultValue="#5865F2" required />
      <input type="text" name="icon" placeholder="Icon (emoji)" maxLength={4} style={{ width: 110 }} />
      <input type="file" name="audio" accept="audio/mpeg,audio/wav,audio/ogg" required />
      <button className="btn btn-primary" type="submit">{buttonLabel}</button>
      <button className="btn" type="button" onClick={() => setExpanded(false)}>Cancel</button>
    </form>
  );
}
