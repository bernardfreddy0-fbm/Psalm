import { test, expect } from "@playwright/test";

/**
 * Smoke test fonctionnel — vérifie que l'app BOOTE réellement dans un navigateur
 * (pas juste qu'elle compile). Cible volontairement la page de login, non
 * authentifiée : elle ne dépend pas du backend pour s'afficher, et elle exerce
 * le chargement de l'entrée + le routing + (avec le code-splitting) les chunks
 * lazy critiques. Un import lazy cassé => écran blanc / chunk en échec => test rouge.
 */
test("l'app boote et affiche la page de connexion", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
  });
  page.on("response", (res) => {
    // Un chunk JS/CSS qui revient en 4xx/5xx = code-splitting cassé.
    if (res.status() >= 400 && /\.(js|css)(\?|$)/.test(res.url())) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // L'app a rendu quelque chose (pas d'écran blanc).
  await expect(page.getByText("Église AEF")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  // Aucune ressource JS/CSS en échec (régression de chunk lazy).
  expect(failedRequests, `Requêtes en échec:\n${failedRequests.join("\n")}`).toEqual([]);

  // Aucune erreur console fatale (on ignore le bruit connu non bloquant).
  const fatal = consoleErrors.filter(
    (e) => !/favicon|sourcemap|DevTools|Download the React DevTools/i.test(e),
  );
  expect(fatal, `Erreurs console:\n${fatal.join("\n")}`).toEqual([]);
});

/**
 * Vérifie que la SPA gère une route profonde inconnue sans crasher
 * (le serveur de prod doit fallback sur index.html, et le routing rendre
 * soit le login -> redirection, soit la page NotFound).
 */
test("une route profonde ne renvoie pas d'écran blanc", async ({ page }) => {
  const resp = await page.goto("/route-inexistante-xyz", { waitUntil: "networkidle" });
  // Le document HTML doit être servi (fallback SPA), pas un 404 serveur brut.
  expect(resp?.status() ?? 0).toBeLessThan(400);
  // Le body contient du texte rendu par React (pas une page vide).
  const bodyText = (await page.locator("body").innerText()).trim();
  expect(bodyText.length).toBeGreaterThan(0);
});
