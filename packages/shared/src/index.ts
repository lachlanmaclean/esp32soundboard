export const MAX_SOUNDS_PER_USER = 8;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const PAIRING_CODE_LENGTH = 6;

/** A single button as the CYD renders it. Mirrors a subset of the Sound model. */
export interface SoundButtonConfig {
  id: string;
  displayName: string;
  color: string;
  icon: string | null;
}

/** Response body for GET /api/devices/:cuid/config — what the CYD polls for. */
export interface DeviceConfig {
  buttons: SoundButtonConfig[];
  /** Bump whenever config changes, so the CYD can skip a re-render if unchanged. */
  version: number;
  /** Whether the paired user is currently in a voice channel the bot can see. */
  inVoiceChannel: boolean;
}

/** Body the CYD posts on first boot / whenever it has no paired user yet. */
export interface DeviceRegisterRequest {
  cuid: string;
  firmwareVersion?: string;
}

export interface DeviceRegisterResponse {
  cuid: string;
  /** Present only while the device is unpaired and awaiting pairing. */
  pairingCode: string | null;
  paired: boolean;
}

/** Body the CYD posts when a button is tapped. */
export interface TriggerSoundRequest {
  cuid: string;
  soundId: string;
}

export interface SoundDTO {
  id: string;
  displayName: string;
  color: string;
  icon: string | null;
  /** Path relative to the server's origin, e.g. "/uploads/abc123.mp3". */
  audioUrl: string;
}

export interface DeviceSummary {
  cuid: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export const ALLOWED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"];
export const MAX_AUDIO_FILE_BYTES = 5 * 1024 * 1024; // 5MB

