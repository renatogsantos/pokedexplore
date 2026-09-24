import CreatorControlCenter from "./CreatorControlCenter";
import CreatorLogin from "./CreatorLogin";
import { isCreatorAuthorized, isCreatorProtectionConfigured } from "./_server/auth";
import "./style.scss";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Creator Control Center",
  robots: { index: false, follow: false, nocache: true },
};

export default function CreatorControlPage() {
  const configured = isCreatorProtectionConfigured();
  return isCreatorAuthorized() ? <CreatorControlCenter /> : <CreatorLogin configured={configured} />;
}
