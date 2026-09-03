/* Public surface of the language layer.

   Client components: `const { t, lang, setLang } = useTranslation()`.
   Server components: `translate(lang, key)` plus the content helpers, all of
   which take `lang` explicitly and read no global state.

   Remember: everything here returns text to DISPLAY. Form data keeps its
   English values so the REG 343 PDF stays a valid English legal document. */

export {
  LANGS,
  LANG_STORAGE_KEY,
  dictionary,
  en,
  es,
  isLang,
  plural,
  translate,
  type Lang,
  type TranslationKey,
  type TranslationVars,
} from './dictionary';

export {
  ES_ADVISORIES,
  ES_CHECKLISTS,
  ES_FIELDS,
  ES_NOTES,
  ES_SECTIONS,
  ES_SERVICES,
  ES_CHAT,
  ES_CHAT_KEYWORDS,
  ES_CHAT_OUT_OF_SCOPE,
  ES_CHAT_SOURCES,
  ES_OFFICE_HOURS,
  ES_OFFICE_LAYOUT,
  ES_SUPPLEMENTARY,
  ES_VALIDATION,
  advisoryText,
  chatAnswer,
  chatKeywords,
  chatSourceLabel,
  checklistFor,
  fieldHint,
  fieldLabel,
  hoursToday,
  layoutLines,
  optionLabel,
  outOfScopeKeywords,
  problemFieldLabel,
  problemSectionTitle,
  sectionNote,
  sectionTitle,
  serviceBlurb,
  serviceName,
  subLabel,
  supplementaryTitle,
  untranslatedOfficeStrings,
  validationMessage,
  type EsField,
  type EsService,
} from './content';

export { I18nProvider, useTranslation, type I18nContextValue } from './provider';
