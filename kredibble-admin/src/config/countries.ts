/** The calling code of each country (digits only, no +), used to compare phone numbers written with or without it. */
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  Botswana: "267",
  Cameroon: "237",
  "Côte d'Ivoire": "225",
  Egypt: "20",
  Ethiopia: "251",
  Ghana: "233",
  Kenya: "254",
  Malawi: "265",
  Morocco: "212",
  Mozambique: "258",
  Namibia: "264",
  Nigeria: "234",
  Rwanda: "250",
  Senegal: "221",
  "Sierra Leone": "232",
  "South Africa": "27",
  Tanzania: "255",
  Tunisia: "216",
  Uganda: "256",
  Zambia: "260",
  Zimbabwe: "263",
};

/**
 * Countries a listing can be tied to (the Country Select on the listing form). The desk works across Africa, so the list
 * is African countries plus "Worldwide" for listings open to anyone. Edit this list to add one; the Opportunities Queue
 * country filter only shows countries that actually have a row.
 */
export const LISTING_COUNTRIES = [
  "Botswana",
  "Cameroon",
  "Côte d'Ivoire",
  "Egypt",
  "Ethiopia",
  "Ghana",
  "Kenya",
  "Malawi",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Nigeria",
  "Rwanda",
  "Senegal",
  "Sierra Leone",
  "South Africa",
  "Tanzania",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
  "Worldwide",
] as const;
