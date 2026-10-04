/**
 * Brand identity: the single place to rename the product.
 * The sidebar, login title, document title and footer all read from here.
 */
export const BRAND = {
  name: "G.O.D",
  sub: "Global Opportunity Desk",
} as const;

/**
 * Domain used for MOCK staff email addresses. ".example" is reserved for documentation, so no mock
 * address can ever reach a real inbox. Real product names (the app is still "kredibble-app") stay as they are.
 */
export const BRAND_EMAIL_DOMAIN = "god.example";

/** "G.O.D Admin": used for the login heading and the browser tab title. */
export const BRAND_ADMIN_TITLE = `${BRAND.name} Admin`;

/**
 * Footer links. There are no Help / Terms / Privacy pages yet, so these are
 * "#" placeholders: replace the hrefs here when the real pages exist.
 */
export const FOOTER_LINKS = [
  { label: "Help", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
] as const;
