import { apiFetch } from "@/lib/api";
import { prepareAvatarForUpload } from "@/lib/image-processing";

export async function getProfile() {
  const data = await apiFetch("/api/profile", {
    auth: true,
  });

  return data.profile;
}

export async function updateProfile(profile) {
  const data = await apiFetch("/api/profile", {
    method: "PATCH",
    auth: true,
    body: profile,
  });

  return data.profile;
}

export async function uploadProfileAvatar(file) {
  const avatarFile = await prepareAvatarForUpload(file);
  const formData = new FormData();

  formData.append("avatar", avatarFile);

  const data = await apiFetch("/api/profile/avatar", {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data.profile;
}
