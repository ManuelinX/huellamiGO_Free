import { redirect } from "next/navigation";

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token?.toString() ?? "";
  const target = token ? `/?resetToken=${encodeURIComponent(token)}` : "/";

  redirect(target);
}
