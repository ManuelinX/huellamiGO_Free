import "./globals.css";
import "leaflet/dist/leaflet.css";
import Script from "next/script";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth-provider";
import { BetaHelpWidget } from "@/components/beta-help-widget";

const nunito = localFont({
  src: "../fonts/brand/nunito-latin-variable-700-900.woff2",
  weight: "700 900",
  display: "swap",
  variable: "--font-nunito",
});

const poppins = localFont({
  src: [
    { path: "../fonts/brand/poppins-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/brand/poppins-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/brand/poppins-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/brand/poppins-latin-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/brand/poppins-latin-800.woff2", weight: "800", style: "normal" },
    { path: "../fonts/brand/poppins-latin-900.woff2", weight: "900", style: "normal" },
  ],
  display: "swap",
  variable: "--font-poppins",
});

const manrope = localFont({
  src: "../fonts/brand/manrope-latin-variable-600-800.woff2",
  weight: "600 800",
  display: "swap",
  variable: "--font-manrope",
});

export const metadata = {
  title: "HuellamiGO",
  description: "Comunidad para encontrar mascotas perdidas.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${nunito.variable} ${poppins.variable} ${manrope.variable}`}>
      <body>
        <Script id="history-restore-guard" strategy="beforeInteractive">
          {`
            (function () {
              var reloadKey = "huellamigo-map-restore-reloaded";

              function wasBackForwardNavigation() {
                var entries = performance.getEntriesByType && performance.getEntriesByType("navigation");
                return entries && entries[0] && entries[0].type === "back_forward";
              }

              function markRestore() {
                window.__HUELLAMIGO_HISTORY_RESTORE_TICK__ = (window.__HUELLAMIGO_HISTORY_RESTORE_TICK__ || 0) + 1;
                window.dispatchEvent(new CustomEvent("huellamigo:history-restore", {
                  detail: { tick: window.__HUELLAMIGO_HISTORY_RESTORE_TICK__ }
                }));
              }

              function reloadIfMapStillLoading() {
                window.setTimeout(function () {
                  var mapStillLoading = document.querySelector(".mapLoading");
                  var mapReady = document.querySelector(".realMap .leaflet-pane");

                  if (!mapStillLoading || mapReady) {
                    sessionStorage.removeItem(reloadKey);
                    return;
                  }

                  if (sessionStorage.getItem(reloadKey) === "1") {
                    sessionStorage.removeItem(reloadKey);
                    return;
                  }

                  sessionStorage.setItem(reloadKey, "1");
                  window.location.replace(window.location.href);
                }, 165);
              }

              window.addEventListener("pageshow", function (event) {
                if (event.persisted || wasBackForwardNavigation()) {
                  markRestore();
                  reloadIfMapStillLoading();
                } else {
                  sessionStorage.removeItem(reloadKey);
                }
              });
            })();
          `}
        </Script>
        <AuthProvider>
          {children}
          <BetaHelpWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
