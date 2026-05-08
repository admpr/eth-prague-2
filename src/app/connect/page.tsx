import { ConnectStage } from "@/components/connect/ConnectStage";
import { SiteHeader } from "@/components/shared/SiteHeader";

export default function ConnectPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <ConnectStage />
    </main>
  );
}
