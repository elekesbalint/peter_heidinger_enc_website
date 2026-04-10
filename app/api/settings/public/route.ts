import { getSettingsMap, SETTINGS_DEFAULTS } from "@/lib/app-settings";

const PUBLIC_KEYS = new Set<string>([
  "device_price_huf",
  "order_category_guide_title",
  "order_category_guide_subtitle",
  "order_category_guide_ia_items",
  "order_category_guide_i_items",
  "order_category_guide_ii_items",
  "order_category_guide_iii_items",
  "order_category_guide_iv_items",
  "home_platform_label",
  "home_hero_title",
  "home_hero_subtitle",
  "home_steps_title",
  "home_steps_subtitle",
  "home_step_1_title",
  "home_step_1_desc",
  "home_step_2_title",
  "home_step_2_desc",
  "home_step_3_title",
  "home_step_3_desc",
  "home_step_4_title",
  "home_step_4_desc",
  "home_features_title",
  "home_features_subtitle",
  "home_feature_1_title",
  "home_feature_1_desc",
  "home_feature_2_title",
  "home_feature_2_desc",
  "home_feature_3_title",
  "home_feature_3_desc",
  "home_feature_4_title",
  "home_feature_4_desc",
  "home_feature_5_title",
  "home_feature_5_desc",
  "home_feature_6_title",
  "home_feature_6_desc",
  "home_faq_title",
  "home_faq_subtitle",
  "home_faq_1_question",
  "home_faq_1_answer",
  "home_faq_2_question",
  "home_faq_2_answer",
  "home_faq_3_question",
  "home_faq_3_answer",
  "home_faq_4_question",
  "home_faq_4_answer",
  "aszf_title",
  "aszf_intro",
  "aszf_content",
  "adatvedelem_title",
  "adatvedelem_intro",
  "adatvedelem_content",
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keysParam = searchParams.get("keys");
    const requestedKeys = keysParam
      ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
      : null;

    const settingsMap = await getSettingsMap();

    const result: Record<string, string> = {};
    const keysToReturn = requestedKeys
      ? requestedKeys.filter((k) => PUBLIC_KEYS.has(k))
      : Array.from(PUBLIC_KEYS);

    for (const key of keysToReturn) {
      result[key] = settingsMap[key] ?? SETTINGS_DEFAULTS[key] ?? "";
    }

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
