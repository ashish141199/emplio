// Hostinger: what the generator (../openapi-actions.ts) can't tell from the spec.
import type { AppConfig } from "../openapi-actions";

// product names the camelCase split breaks up: word_press → wordpress
const WORDS: [RegExp, string][] = [
  [/word_press/g, "wordpress"],
  [/woo_commerce/g, "woocommerce"],
  [/lite_speed/g, "litespeed"],
  [/php_my_admin/g, "phpmyadmin"],
  [/node_js/g, "nodejs"],
  [/_v_ms(?=_|$)/g, "_vms"],
];

export default {
  spec: "https://developers.hostinger.com/openapi/openapi.json",
  out: "src/integrations/own/hostinger/actions.json",
  // agency-hosting_createANewWebsiteV1 → agency_hosting_create_new_website
  name: (id) =>
    WORDS.reduce((n, [from, to]) => n.replace(from, to), id)
      .replace(/_?v1$/, "")
      .replace(/_(a|an)_/g, "_"),
  rename: { v2_get_domain_verifications_direct: "domains_get_verifications" },
  reads: [
    "dns_validate_dns_records",
    "domains_check_domain_availability",
    "domains_suggest_domain_names_from_description",
    "domains_suggest_domain_names_from_domain",
    "reach_preview_contacts_matching_conditions",
    "hosting_check_if_wordpress_installations_are_valid",
  ],
  // a transfer code, a WordPress admin token, a logged-in phpMyAdmin link
  secrets: ["domains_get_domain_authorization_code", "hosting_get_installation_jwt_token", "hosting_get_phpmyadmin_link"],
} satisfies AppConfig;
