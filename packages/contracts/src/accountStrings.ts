// Account UI strings (sign-in, drafts, submit/remove) in every supported UI
// language. The public recipe-reading experience uses uiStrings(); the
// private account experience uses these. Keep placeholders as {name} tokens;
// fill() interpolates them (escaping is the caller's job - fill AFTER escape
// or with escaped values).

export interface AccountStrings {
  // generic pages / banners
  titleBlocked: string; errBlocked: string;
  titleTooLarge: string; errTooLarge: string;
  titleSlowDown: string; errTooManyTries: string;
  titleBusy: string; errBusy: string;
  titleNotFound: string; errDraftNotFound: string; errDraftNotFoundOrSent: string;
  titleSubmitted: string; okAlreadySentEdit: string; errAlreadySent: string; errAlreadySentNoSave: string; okAlreadySent: string;
  titlePermissionNeeded: string; errPermissionNeeded: string;
  errGeneric: string;
  // sign-in
  signInPageTitle: string; signInTitle: string; signInLead: string; signInEmailLabel: string; signInButton: string; signInHint: string;
  errInvalidEmail: string; errSigninOff: string; errTooManyCodes: string; errSendFailed: string;
  codePageTitle: string; codeTitle: string; codeLead: string; codeLabel: string; codeButton: string;
  errEnterCode: string; errCodeExpired: string; errCodeWrong: string; errCodeUsed: string;
  mailSubject: string; mailBody: string;
  // account home
  homePageTitle: string; homeTitle: string; homeLead: string; addRecipe: string; yourDrafts: string; emptyDrafts: string; signOut: string;
  statusPublished: string; statusSubmitted: string; statusDraft: string; editLink: string;
  // draft form
  formTitleNew: string; formTitleEdit: string; formLead: string; fixThese: string;
  startFaster: string; pasteLabel: string; pasteHint: string; pasteButton: string;
  importLabel: string; importHint: string; importButton: string; importOffName: string; importOffText: string;
  labelTitle: string; labelLanguage: string;
  labelIngredients: string; ingredientsHint: string;
  labelSteps: string; stepsHint: string;
  labelPrep: string; labelCook: string; labelServings: string; optional: string;
  labelAuthor: string; labelSource: string; sourceOriginal: string; sourceAdapted: string;
  labelSourceLink: string; sourceLinkHint: string; attestText: string; saveDraft: string;
  pasteFilled: string; errImportOff: string; errTooManyImports: string; errNoRecipeData: string; importFilled: string; errReadLink: string;
  errAuthorRequired: string; errAdaptedHttps: string; errPickLanguage: string;
  errRowLimit: string; errDraftLimit: string;
  okSaved: string;
  submitPanelTitle: string; submitPanelHint: string; submitButton: string; removeDraft: string;
  finishTitle: string; finishHint: string; errAttestToSubmit: string;
  sentInPageTitle: string; sentInTitle: string; sentInLead: string; backToRecipes: string;
  // community kitchen-test reports
  reportPageTitle: string; reportTitle: string; reportLead: string;
  reportNoteLabel: string; reportNoteHint: string; reportAttestText: string; reportButton: string;
  reportPhotoLabel: string; reportPhotoHint: string; reportPhotoAttestText: string;
  errReportPhotoInvalid: string; errReportPhotoAttest: string;
  reportSentPageTitle: string; reportSentTitle: string; reportSentLead: string;
  errReportOwn: string; errReportNotPublic: string; reportAlreadyLead: string; errReportAttest: string;
  reportStatusPending: string; reportStatusApproved: string; reportStatusRejected: string;
  // validator fallbacks (friendly per-field messages)
  errValTitle: string; errValIntro: string; errValIngredients: string; errValSteps: string; errValCategory: string; errValTimes: string; errValSource: string;
  warnNoTitle: string; warnNoIngredients: string; warnNoSteps: string; warnImportNoIngredients: string; warnImportNoSteps: string;
  // ssrf import errors
  errSsrfUrlLong: string; errSsrfInvalid: string; errSsrfHttps: string; errSsrfCredentials: string; errSsrfPort: string; errSsrfIpHost: string; errSsrfInternal: string; errSsrfResolve: string; errSsrfNoResolve: string; errSsrfNonPublic: string; errSsrfRedirect: string; errSsrfStatus: string; errSsrfNotPage: string; errSsrfTooLarge: string;
  // AI kitchen co-editor (photo + voice/rough notes -> structured draft & polish)
  aiPanelTitle: string; aiPanelLead: string;
  aiPhotoLabel: string; aiPhotoHint: string;
  aiVoiceStart: string; aiVoiceStop: string; aiVoiceReady: string;
  aiNotesLabel: string; aiNotesPlaceholder: string;
  aiExtractBtn: string; aiPolishBtn: string; aiTranslateBtn: string; aiTargetLangLabel: string; aiUndoBtn: string;
  aiWorking: string; aiDoneExtract: string; aiDonePolish: string; aiDoneTranslate: string;
  aiQuestionsHeading: string; aiImprovementsHeading: string;
  aiErrBusy: string; aiErrInput: string;
  // honest AI: no-key fallback, session expiry
  aiErrTranslateUnavailable: string; aiErrMediaUnavailable: string; aiFallbackNote: string;
  aiErrSession: string; aiSignInLink: string;
  // share a recipe: draft first, sign in last (S1), start tiles (S2), mobile stepper (S3), live preview (S6)
  formPromise: string; aiSignInNote: string;
  startHeading: string; tilePhotoTitle: string; tilePhotoHint: string; tilePasteTitle: string; tilePasteHint: string; tileTypeTitle: string; tileTypeHint: string;
  pasteWorking: string; pasteUndo: string;
  stepIndexLabel: string; stepBasics: string; stepIngredients: string; stepSteps: string; stepDetails: string; stepCredit: string;
  stepBack: string; stepNext: string; stepProgress: string; stepNeedRequired: string; stepSoftWarn: string;
  previewTitle: string; previewTab: string; previewBadge: string; previewUntitled: string; previewPrep: string; previewCook: string; previewServes: string; previewEmpty: string; previewBackToForm: string;
  authStepTitle: string; authStepLead: string; authCodeSent: string; authVerifyBtn: string; authChangeEmail: string; authWorking: string; authDone: string;
  // S5 contributor dish cover photo
  draftPhotoLabel: string; draftPhotoHint: string; draftPhotoRemove: string; draftPhotoResizing: string;
  draftPhotoSaved: string; draftPhotoRemoved: string;
  errDraftPhotoInvalid: string; errDraftPhotoStorage: string; errDraftPhotoQuota: string; errDraftPhotoRead: string;
  // S8 review status timeline & feedback
  statusNeedsChanges: string; statusDeclined: string;
  timelineDraft: string; timelineReview: string; timelineLive: string;
  inReviewNote: string; editAndResend: string; makeCopy: string; copyCreated: string; viewLiveRecipe: string;
  needsChangesBanner: string; needsChangesLead: string;
  declinedBanner: string; declinedEditNote: string;
  mailNeedsChangesSubject: string; mailNeedsChangesBody: string;
  mailDeclinedSubject: string; mailDeclinedBody: string;
  mailPublishedSubject: string; mailPublishedBody: string;
  // S4 structured capture, S9 live celebration & remix, S12 search-gap prompts
  lineLimitBadge: string;
  errTooManyIngredients: string;
  errTooManySteps: string;
  ingModeRows: string;
  ingModeRaw: string;
  ingQtyPlaceholder: string;
  ingUnitPlaceholder: string;
  ingItemPlaceholder: string;
  ingSectionPlaceholder: string;
  ingAddRow: string;
  ingAddSection: string;
  stepModeCards: string;
  stepPlaceholder: string;
  stepTimerLabel: string;
  stepAddCard: string;
  stepPhotoJump: string;
  moveUp: string;
  moveDown: string;
  removeRow: string;
  celebrateLiveTitle: string;
  celebrateLiveLead: string;
  celebrateStoryBtn: string;
  celebrateStoryReady: string;
  celebrateCopyBtn: string;
  celebrateLinkCopied: string;
  celebrateWhatsApp: string;
  remixTitleTpl: string;
  remixIntroTpl: string;
  remixBanner: string;
  gapPromptLead: string;
  gapPromptMore: string;
  gapPrefilledBanner: string;
  savedPanelTitle: string; savedPanelLead: string; savedPanelLink: string;
}

const en: AccountStrings = {
  titleBlocked: 'Blocked', errBlocked: 'This request did not come from 2yolks.com, so it was blocked.',
  titleTooLarge: 'Too large', errTooLarge: 'That request is too large.',
  titleSlowDown: 'Slow down', errTooManyTries: 'Too many tries. Please wait a minute.',
  titleBusy: 'Busy', errBusy: 'Sign-in is busy right now. Please try again tomorrow.',
  titleNotFound: 'Not found', errDraftNotFound: 'Draft not found.', errDraftNotFoundOrSent: 'Draft not found, or it was already sent in for review.',
  titleSubmitted: 'Submitted',
  okAlreadySentEdit: 'This recipe was already sent in for review, so it can no longer be edited here.',
  errAlreadySent: 'This recipe was already sent in for review.',
  errAlreadySentNoSave: 'This recipe was already sent in for review, so your changes were not saved.',
  okAlreadySent: 'Already sent in for review.',
  titlePermissionNeeded: 'Permission needed', errPermissionNeeded: 'Tick the permission box next to “Send in for review” before sending it in.',
  errGeneric: 'Something went wrong. Please try again.',
  signInPageTitle: 'Sign in', signInTitle: 'Your 2yolks account',
  signInLead: 'Sign in with an email code to keep private drafts and send a recipe in for review. No password to remember.',
  signInEmailLabel: 'Email', signInButton: 'Email me a code',
  signInHint: 'Drafts stay private to you. Nothing is published until it has been reviewed.',
  errInvalidEmail: 'Enter a valid email address.', errSigninOff: 'Sign-in email is not switched on yet.',
  errTooManyCodes: 'Too many codes requested for this email. Try again in a few minutes.',
  errSendFailed: 'We could not send the email. Please try again later.',
  codePageTitle: 'Check your email', codeTitle: 'Check your email',
  codeLead: 'We sent a 6-digit code to {email}. It works for 10 minutes. If you asked for more than one, use the code from the most recent request; older codes stop working.',
  codeLabel: '6-digit code', codeButton: 'Sign in',
  errEnterCode: 'Enter the 6-digit code.', errCodeExpired: 'That code expired or was used up. Request a new one.',
  errCodeWrong: 'That code is not right.', errCodeUsed: 'That code was already used. Request a new one.',
  mailSubject: 'Your 2yolks code: {code}',
  mailBody: 'Your 2yolks sign-in code is {code}.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.\n',
  homePageTitle: 'Your recipes', homeTitle: 'Your recipes', homeLead: 'Signed in as {email}.',
  addRecipe: 'Add a recipe', yourDrafts: 'Your drafts',
  emptyDrafts: 'Nothing yet. Start from a form, pasted text or a link.', signOut: 'Sign out',
  statusPublished: 'Published', statusSubmitted: 'Submitted for review', statusDraft: 'Private draft', editLink: 'Edit',
  formTitleNew: 'Share a recipe', formTitleEdit: 'Edit your draft',
  formLead: 'Drafts are private to you until you send one in and we review it.',
  fixThese: 'Fix these first:',
  startFaster: 'Start faster',
  pasteLabel: 'Paste a recipe', pasteHint: 'Plain text with a title line, then "Ingredients" and "Instructions". You review everything before saving.', pasteButton: 'Fill the form from this text',
  importLabel: 'Or import from a link', importHint: 'Only your own recipe, or one you have permission to share. We read the page\'s recipe data and nothing else.', importButton: 'Fill the form from this link',
  importOffName: 'Import from a link', importOffText: 'is not available yet. Paste the recipe text above instead.',
  labelTitle: 'Recipe name', labelLanguage: 'Language',
  labelIngredients: 'Ingredients', ingredientsHint: 'One per line, for example "2 cups flour".',
  labelSteps: 'Steps', stepsHint: 'One step per line.',
  labelPrep: 'Prep minutes', labelCook: 'Cook minutes', labelServings: 'Servings', optional: '(optional)',
  labelAuthor: 'Name to show as author',
  labelSource: 'Where is this recipe from?', sourceOriginal: 'I wrote it (my own recipe)', sourceAdapted: 'Adapted from, or shared with permission',
  labelSourceLink: 'Link to the original', sourceLinkHint: '(required if adapted or shared with permission)',
  attestText: 'I wrote this recipe or have the right to share it. I let 2yolks publish it with credit to the name above, and I understand 2yolks reviews every recipe before it goes live and may decline or edit it.',
  saveDraft: 'Save private draft',
  pasteFilled: 'Filled from your text. Check every line, then save.',
  errImportOff: 'Link import is not switched on yet. Paste the recipe text instead.',
  errTooManyImports: 'Too many imports. Please wait a minute.',
  errNoRecipeData: 'That page has no recipe data we can read. Paste the text instead.',
  importFilled: 'Filled from {host}. It is saved as "adapted" with a link back. Only keep it if you have the right to share it.',
  errReadLink: 'We could not read that link.',
  errAuthorRequired: 'Add the name to show as author.',
  errAdaptedHttps: 'Adapted recipes need an https:// link to the original.',
  errPickLanguage: 'Pick a language from the list.',
  errRowLimit: 'This account has reached its limit of saved recipes, including removed ones. Removing more will not free space here.',
  errDraftLimit: 'You can keep up to {max} drafts. Remove one first.',
  okSaved: 'Saved as a private draft.',
  submitPanelTitle: 'Send in for review',
  submitPanelHint: 'We check the recipe and its rights before anything is published. Publishing is never automatic.',
  submitButton: 'Send in for review', removeDraft: 'Remove this draft',
  finishTitle: 'Ready to share it?',
  finishHint: 'Send it in for review now, or save a private draft and come back later. We check the recipe and its rights before anything is published. Publishing is never automatic.',
  errAttestToSubmit: 'Tick the permission box to send this recipe in for review.',
  sentInPageTitle: 'Sent in', sentInTitle: 'Thanks, it is with us',
  sentInLead: 'We will review "{title}" and its rights before anything goes live. Nothing is published automatically. Track progress in My recipes — we will also email you once it is reviewed.',
  backToRecipes: 'Back to your recipes',
  reportPageTitle: 'You cooked it', reportTitle: 'You cooked this recipe?',
  reportLead: 'Tell us how "{title}" went in your kitchen. A moderator reads every report before the recipe is marked tested.',
  reportNoteLabel: 'How did it go? (optional)', reportNoteHint: 'Timing, yield, anything you had to change. Max 280 characters.',
  reportAttestText: 'I cooked this recipe in a kitchen.',
  reportPhotoLabel: 'Photo of your finished dish (optional)',
  reportPhotoHint: 'JPEG, PNG or WebP (max 1.5 MB). Shows only if a moderator approves your report and photo.',
  reportPhotoAttestText: 'I took this photo myself and allow 2yolks to display it with credit if approved.',
  errReportPhotoInvalid: 'That photo could not be verified as a valid JPEG, PNG, or WebP file under 1.5 MB.',
  errReportPhotoAttest: 'Tick the photo permission box to attach your kitchen photo.',
  reportButton: 'Send the report',
  reportSentPageTitle: 'Report sent', reportSentTitle: 'Thanks for cooking it',
  reportSentLead: 'Your report for "{title}" is in the review queue. The tested label appears only after a moderator approves it.',
  errReportOwn: 'This is your own recipe - the tested label on it comes from your original submission, not a report.',
  errReportNotPublic: 'That recipe is not published, so it cannot be reported as tested.',
  reportAlreadyLead: 'You already reported this recipe as cooked. Status: {status}.',
  reportStatusPending: 'waiting for review', reportStatusApproved: 'approved', reportStatusRejected: 'not approved',
  errReportAttest: 'Tick the box to confirm you cooked this recipe before sending the report.',
  errValTitle: 'Give the recipe a name (max 200 characters).',
  errValIntro: 'The intro is too long (max 2000 characters).',
  errValIngredients: 'Add at least one ingredient, one per line.',
  errValSteps: 'Add at least one step, one per line.',
  errValCategory: 'Pick a category from the list.',
  errValTimes: 'Check the times and servings: whole or decimal numbers only.',
  warnNoTitle: 'No title found: the first line should be the recipe name.',
  warnNoIngredients: 'No ingredients found: add a line that says "Ingredients" followed by one per line.',
  warnNoSteps: 'No steps found: add a line that says "Instructions" followed by one step per line.',
  warnImportNoIngredients: 'The page listed no ingredients.', warnImportNoSteps: 'The page listed no steps.',
  errValSource: 'Check the source details for this recipe.',
  errSsrfUrlLong: 'That link is too long.', errSsrfInvalid: 'That is not a valid link.',
  errSsrfHttps: 'Only https links can be imported.', errSsrfCredentials: 'Links with credentials are not allowed.',
  errSsrfPort: 'Only standard https links can be imported.', errSsrfIpHost: 'That kind of address cannot be imported.',
  errSsrfInternal: 'That address cannot be imported.', errSsrfResolve: 'We could not reach that site.',
  errSsrfNoResolve: 'We could not reach that site.', errSsrfNonPublic: 'That address cannot be imported.',
  errSsrfRedirect: 'That link redirects somewhere we cannot follow.', errSsrfStatus: 'That page did not answer correctly.',
  errSsrfNotPage: 'That link is not a web page.', errSsrfTooLarge: 'That page is too large to import.',
  aiPanelTitle: 'Snap, speak, or rough-draft with AI',
  aiPanelLead: 'Attach a photo of your dish or handwritten card, record a quick voice note, or type rough notes — our kitchen co-editor structures the recipe and flags missing details while keeping your voice.',
  aiPhotoLabel: 'Dish photo or handwritten recipe card',
  aiPhotoHint: 'JPEG, PNG or WebP. Resized in your browser, then sent to Google’s Gemini API only to read the recipe. 2yolks does not keep the photo.',
  aiVoiceStart: 'Dictate voice note',
  aiVoiceStop: 'Stop recording',
  aiVoiceReady: 'Voice note attached',
  aiNotesLabel: 'Rough notes (how you cooked it)',
  aiNotesPlaceholder: 'Example: Browned 1 kg pork shoulder in chunks, boiled with onion and garlic 90 min, blended 5 guajillo + 2 ancho chiles with broth, added 800g hominy…',
  aiExtractBtn: 'Build recipe from photo / notes',
  aiPolishBtn: 'Polish & check current draft',
  aiTranslateBtn: 'Translate draft',
  aiTargetLangLabel: 'Target language',
  aiUndoBtn: 'Undo AI changes',
  aiWorking: 'Structuring your recipe…',
  aiDoneExtract: 'Draft structured from your notes. Review every line and answer any quick questions below.',
  aiDonePolish: 'Draft polished for clarity and Cook Mode. You can undo anytime.',
  aiDoneTranslate: 'Draft translated while preserving all ingredient quantities, allergens, and timer tokens.',
  aiQuestionsHeading: 'Quick details to make this recipe foolproof:',
  aiImprovementsHeading: 'What the kitchen co-editor refined:',
  aiErrBusy: 'The AI kitchen assistant reached today’s free-tier limit. You can still paste text or fill the form directly.',
  aiErrInput: 'Add a photo, voice note, rough notes, or draft steps first.',
  aiErrTranslateUnavailable: 'Translation needs the AI service, which isn’t available right now. Your draft is unchanged.',
  aiErrMediaUnavailable: 'Reading photos and voice notes needs the AI service, which isn’t available right now. Type your notes instead, or paste the recipe text. Your draft is unchanged.',
  aiFallbackNote: 'Basic tidy-up only: the AI service isn’t available right now, so any photo or voice note was not read.',
  aiErrSession: 'Your session ended. Your draft is saved on this device, so nothing is lost.',
  aiSignInLink: 'Sign in again (opens a new tab)',
  formPromise: 'Start now — you only need an email when you send it in.',
  aiSignInNote: 'Sign in to use the AI helper',
  startHeading: 'How do you want to start?',
  tilePhotoTitle: 'Snap your dish or a recipe card', tilePhotoHint: 'The AI helper reads it and fills the form.',
  tilePasteTitle: 'Paste text', tilePasteHint: 'From a note, an email or a document.',
  tileTypeTitle: 'Type it', tileTypeHint: 'Fill in the form, step by step.',
  pasteWorking: 'Reading your text…', pasteUndo: 'Undo',
  stepIndexLabel: 'Form sections', stepBasics: 'Basics', stepIngredients: 'Ingredients', stepSteps: 'Steps', stepDetails: 'Details', stepCredit: 'Credit & send',
  stepBack: 'Back', stepNext: 'Next', stepProgress: 'Step {n} of {total}',
  stepNeedRequired: 'Fill this in to continue.',
  stepSoftWarn: 'Worth a look before you go on. Press Next again to continue anyway.',
  previewTitle: 'Preview', previewTab: 'Preview', previewBadge: 'Draft — not yet tested', previewUntitled: 'Your recipe name',
  previewPrep: 'Prep {n} min', previewCook: 'Cook {n} min', previewServes: 'Serves {n}',
  previewEmpty: 'Start typing and your recipe card appears here.', previewBackToForm: 'Back to the form',
  authStepTitle: 'Last step: confirm your email',
  authStepLead: 'We email you a 6-digit code. Your recipe stays right here on this page while you check.',
  authCodeSent: 'We sent a code to {email}. It works for 10 minutes.',
  authVerifyBtn: 'Confirm and continue', authChangeEmail: 'Use a different email',
  authWorking: 'One moment…', authDone: 'Email confirmed. Saving your recipe…',
  draftPhotoLabel: 'Photo of your dish (optional)',
  draftPhotoHint: 'JPEG, PNG or WebP (max 3 MB). Resized in your browser and kept private with your draft — published only if approved.',
  draftPhotoRemove: 'Remove photo',
  draftPhotoResizing: 'Preparing photo…',
  draftPhotoSaved: 'Photo updated.',
  draftPhotoRemoved: 'Photo removed.',
  errDraftPhotoInvalid: 'That photo could not be verified as a valid JPEG, PNG, or WebP image under 3 MB.',
  errDraftPhotoStorage: 'Photo storage is not configured right now.',
  errDraftPhotoQuota: 'Your drafts have reached the photo storage limit. Remove an older photo first.',
  errDraftPhotoRead: 'Please pick a valid photo file.',
  statusNeedsChanges: 'Needs changes',
  statusDeclined: 'Not published',
  timelineDraft: 'Draft',
  timelineReview: 'In review',
  timelineLive: 'Live',
  inReviewNote: 'Editing is paused while a reviewer checks your recipe and rights.',
  editAndResend: 'Edit and resend',
  makeCopy: 'Make a copy',
  copyCreated: 'Copied into a fresh draft. Review it and tick the permission box when you are ready to send it in again.',
  viewLiveRecipe: 'View live recipe',
  needsChangesBanner: 'Changes requested by reviewer',
  needsChangesLead: 'Reviewer note: {note}. Update your recipe below, re-tick the permission box, and send it in again.',
  declinedBanner: 'This submission was not published.',
  declinedEditNote: 'Declined recipes cannot be edited directly. Make a fresh draft copy below if you want to rework and submit a new version.',
  mailNeedsChangesSubject: '2yolks: please update "{title}"',
  mailNeedsChangesBody: 'We reviewed your recipe "{title}" and need a quick change before it can go live:\n\n{note}\n\nEdit and resend it here:\n{editUrl}\n',
  mailDeclinedSubject: '2yolks update on "{title}"',
  mailDeclinedBody: 'Thank you for sending in "{title}". We decided not to publish this submission:\n\n{note}\n\nYou can still make a fresh copy in My recipes:\n{accountUrl}\n',
  mailPublishedSubject: 'Your 2yolks recipe "{title}" is live',
  mailPublishedBody: 'Good news — "{title}" passed review and is now live on 2yolks:\n\n{liveUrl}\n',
  lineLimitBadge: '{n} / {max} lines',
  errTooManyIngredients: 'Up to {max} ingredient lines allowed — combine garnish or spice lines.',
  errTooManySteps: 'Up to {max} steps allowed — combine short steps.',
  ingModeRows: 'Structured rows',
  ingModeRaw: 'Plain text',
  ingQtyPlaceholder: 'Qty',
  ingUnitPlaceholder: 'Unit',
  ingItemPlaceholder: 'Ingredient name, prep note…',
  ingSectionPlaceholder: 'Section (e.g. For the sauce)',
  ingAddRow: '+ Add ingredient',
  ingAddSection: '+ Add section',
  stepModeCards: 'Step cards',
  stepPlaceholder: 'Describe this step clearly…',
  stepTimerLabel: 'Timer (min)',
  stepAddCard: '+ Add step',
  stepPhotoJump: 'Add dish photo',
  moveUp: 'Move up',
  moveDown: 'Move down',
  removeRow: 'Remove',
  celebrateLiveTitle: 'Your recipe is live 🎉',
  celebrateLiveLead: 'Share it directly with a friend, group chat, or story card.',
  celebrateStoryBtn: 'Story card (PNG)',
  celebrateStoryReady: 'Story saved',
  celebrateCopyBtn: 'Copy link',
  celebrateLinkCopied: 'Link copied',
  celebrateWhatsApp: 'WhatsApp',
  remixTitleTpl: 'My {title}',
  remixIntroTpl: 'Adapted from "{title}" by {author}.',
  remixBanner: 'Remixing "{title}" — edit anything you changed, add your name, and credit is already linked.',
  gapPromptLead: 'People searched "{query}" and found nothing. Got a recipe?',
  gapPromptMore: 'Other requested dishes:',
  gapPrefilledBanner: 'Starting a recipe for "{query}" — requested by 2yolks readers.',
  savedPanelTitle: 'Saved recipes',
  savedPanelLead: 'Recipes you bookmarked with ♥ are synced to your account ({count}).',
  savedPanelLink: 'Open Saved recipes',
};

const es: AccountStrings = {
  titleBlocked: 'Bloqueado', errBlocked: 'Esta solicitud no vino de 2yolks.com, así que fue bloqueada.',
  titleTooLarge: 'Demasiado grande', errTooLarge: 'Esa solicitud es demasiado grande.',
  titleSlowDown: 'Más despacio', errTooManyTries: 'Demasiados intentos. Espera un minuto, por favor.',
  titleBusy: 'Ocupado', errBusy: 'El inicio de sesión está ocupado ahora mismo. Inténtalo de nuevo mañana.',
  titleNotFound: 'No encontrado', errDraftNotFound: 'Borrador no encontrado.', errDraftNotFoundOrSent: 'Borrador no encontrado, o ya fue enviado a revisión.',
  titleSubmitted: 'Enviado',
  okAlreadySentEdit: 'Esta receta ya se envió a revisión, así que ya no se puede editar aquí.',
  errAlreadySent: 'Esta receta ya se envió a revisión.',
  errAlreadySentNoSave: 'Esta receta ya se envió a revisión, así que tus cambios no se guardaron.',
  okAlreadySent: 'Ya enviada a revisión.',
  titlePermissionNeeded: 'Falta el permiso', errPermissionNeeded: 'Marca la casilla de permiso junto a “Enviar a revisión” antes de enviarla.',
  errGeneric: 'Algo salió mal. Inténtalo de nuevo, por favor.',
  signInPageTitle: 'Iniciar sesión', signInTitle: 'Tu cuenta de 2yolks',
  signInLead: 'Inicia sesión con un código por correo para guardar borradores privados y enviar una receta a revisión. Sin contraseña que recordar.',
  signInEmailLabel: 'Correo electrónico', signInButton: 'Envíame un código',
  signInHint: 'Los borradores son privados. Nada se publica sin ser revisado.',
  errInvalidEmail: 'Escribe una dirección de correo válida.', errSigninOff: 'El correo de inicio de sesión aún no está activado.',
  errTooManyCodes: 'Se pidieron demasiados códigos para este correo. Inténtalo en unos minutos.',
  errSendFailed: 'No pudimos enviar el correo. Inténtalo más tarde, por favor.',
  codePageTitle: 'Revisa tu correo', codeTitle: 'Revisa tu correo',
  codeLead: 'Enviamos un código de 6 dígitos a {email}. Funciona por 10 minutos. Si pediste más de uno, usa el de la solicitud más reciente; los anteriores dejan de funcionar.',
  codeLabel: 'Código de 6 dígitos', codeButton: 'Iniciar sesión',
  errEnterCode: 'Escribe el código de 6 dígitos.', errCodeExpired: 'Ese código venció o se agotó. Pide uno nuevo.',
  errCodeWrong: 'Ese código no es correcto.', errCodeUsed: 'Ese código ya se usó. Pide uno nuevo.',
  mailSubject: 'Tu código de 2yolks: {code}',
  mailBody: 'Tu código de inicio de sesión de 2yolks es {code}.\n\nVence en 10 minutos. Si no lo pediste, ignora este correo.\n',
  homePageTitle: 'Tus recetas', homeTitle: 'Tus recetas', homeLead: 'Sesión iniciada como {email}.',
  addRecipe: 'Añadir una receta', yourDrafts: 'Tus borradores',
  emptyDrafts: 'Nada todavía. Empieza desde un formulario, texto pegado o un enlace.', signOut: 'Cerrar sesión',
  statusPublished: 'Publicada', statusSubmitted: 'Enviada a revisión', statusDraft: 'Borrador privado', editLink: 'Editar',
  formTitleNew: 'Comparte una receta', formTitleEdit: 'Editar tu borrador',
  formLead: 'Los borradores son privados hasta que envíes uno y lo revisemos.',
  fixThese: 'Corrige esto primero:',
  startFaster: 'Empieza más rápido',
  pasteLabel: 'Pega una receta', pasteHint: 'Texto plano con una línea de título, luego "Ingredientes" e "Instrucciones". Revisas todo antes de guardar.', pasteButton: 'Rellenar el formulario con este texto',
  importLabel: 'O importa desde un enlace', importHint: 'Solo tu propia receta, o una que tengas permiso de compartir. Leemos los datos de receta de la página y nada más.', importButton: 'Rellenar el formulario desde este enlace',
  importOffName: 'Importar desde un enlace', importOffText: 'aún no está disponible. Pega el texto de la receta arriba.',
  labelTitle: 'Nombre de la receta', labelLanguage: 'Idioma',
  labelIngredients: 'Ingredientes', ingredientsHint: 'Uno por línea, por ejemplo "2 tazas de harina".',
  labelSteps: 'Pasos', stepsHint: 'Un paso por línea.',
  labelPrep: 'Minutos de preparación', labelCook: 'Minutos de cocción', labelServings: 'Porciones', optional: '(opcional)',
  labelAuthor: 'Nombre que se mostrará como autor',
  labelSource: '¿De dónde viene esta receta?', sourceOriginal: 'La escribí yo (mi propia receta)', sourceAdapted: 'Adaptada de otra fuente, o compartida con permiso',
  labelSourceLink: 'Enlace al original', sourceLinkHint: '(obligatorio si es adaptada o compartida con permiso)',
  attestText: 'Escribí esta receta o tengo derecho a compartirla. Permito que 2yolks la publique con crédito al nombre de arriba, y entiendo que 2yolks revisa cada receta antes de publicarla y puede rechazarla o editarla.',
  saveDraft: 'Guardar borrador privado',
  pasteFilled: 'Rellenado con tu texto. Revisa cada línea y luego guarda.',
  errImportOff: 'La importación desde enlace aún no está activada. Pega el texto de la receta.',
  errTooManyImports: 'Demasiadas importaciones. Espera un minuto, por favor.',
  errNoRecipeData: 'Esa página no tiene datos de receta que podamos leer. Pega el texto.',
  importFilled: 'Rellenado desde {host}. Se guarda como "adaptada" con un enlace al original. Consérvala solo si tienes derecho a compartirla.',
  errReadLink: 'No pudimos leer ese enlace.',
  errAuthorRequired: 'Añade el nombre que se mostrará como autor.',
  errAdaptedHttps: 'Las recetas adaptadas necesitan un enlace https:// al original.',
  errPickLanguage: 'Elige un idioma de la lista.',
  errRowLimit: 'Esta cuenta llegó a su límite de recetas guardadas, incluidas las eliminadas. Eliminar más no liberará espacio aquí.',
  errDraftLimit: 'Puedes guardar hasta {max} borradores. Elimina uno primero.',
  okSaved: 'Guardado como borrador privado.',
  submitPanelTitle: 'Enviar a revisión',
  submitPanelHint: 'Revisamos la receta y sus derechos antes de publicar nada. La publicación nunca es automática.',
  submitButton: 'Enviar a revisión', removeDraft: 'Eliminar este borrador',
  finishTitle: '¿Lista para compartir?',
  finishHint: 'Envíala a revisión ahora, o guarda un borrador privado y vuelve más tarde. Revisamos la receta y sus derechos antes de publicar nada. La publicación nunca es automática.',
  errAttestToSubmit: 'Marca la casilla de permiso para enviar esta receta a revisión.',
  sentInPageTitle: 'Enviada', sentInTitle: 'Gracias, ya la tenemos',
  sentInLead: 'Revisaremos "{title}" y sus derechos antes de que nada se publique. Nada se publica automáticamente. Sigue el estado en Mis recetas; también te enviaremos un correo cuando se revise.',
  backToRecipes: 'Volver a tus recetas',
  reportPageTitle: 'La cocinaste', reportTitle: '¿Cocinaste esta receta?',
  reportLead: 'Cuéntanos cómo salió "{title}" en tu cocina. Un moderador lee cada reporte antes de marcar la receta como probada.',
  reportNoteLabel: '¿Cómo salió? (opcional)', reportNoteHint: 'Tiempos, porciones, cualquier cambio que tuviste que hacer. Máximo 280 caracteres.',
  reportAttestText: 'Cociné esta receta en una cocina.',
  reportPhotoLabel: 'Foto de tu plato terminado (opcional)',
  reportPhotoHint: 'JPEG, PNG o WebP (máx. 1.5 MB). Solo se muestra si un moderador aprueba tu reporte y la foto.',
  reportPhotoAttestText: 'Yo tomé esta foto y permito que 2yolks la muestre con crédito si se aprueba.',
  errReportPhotoInvalid: 'No se pudo verificar esa foto como un archivo JPEG, PNG o WebP válido de menos de 1.5 MB.',
  errReportPhotoAttest: 'Marca la casilla de permiso de foto para adjuntar tu imagen.',
  reportButton: 'Enviar el reporte',
  reportSentPageTitle: 'Reporte enviado', reportSentTitle: 'Gracias por cocinarla',
  reportSentLead: 'Tu reporte para "{title}" está en la cola de revisión. La etiqueta de probada aparece solo después de que un moderador lo apruebe.',
  errReportOwn: 'Esta receta es tuya: su etiqueta de probada viene de tu envío original, no de un reporte.',
  errReportNotPublic: 'Esa receta no está publicada, así que no se puede reportar como probada.',
  reportAlreadyLead: 'Ya reportaste esta receta como cocinada. Estado: {status}.',
  reportStatusPending: 'esperando revisión', reportStatusApproved: 'aprobado', reportStatusRejected: 'no aprobado',
  errReportAttest: 'Marca la casilla para confirmar que cocinaste esta receta antes de enviar el reporte.',
  errValTitle: 'Ponle un nombre a la receta (máx. 200 caracteres).',
  errValIntro: 'La introducción es demasiado larga (máx. 2000 caracteres).',
  errValIngredients: 'Añade al menos un ingrediente, uno por línea.',
  errValSteps: 'Añade al menos un paso, uno por línea.',
  errValCategory: 'Elige una categoría de la lista.',
  errValTimes: 'Revisa los tiempos y las porciones: solo números enteros o decimales.',
  warnNoTitle: 'No se encontró el título: la primera línea debe ser el nombre de la receta.',
  warnNoIngredients: 'No se encontraron ingredientes: agrega una línea que diga "Ingredientes" seguida de uno por línea.',
  warnNoSteps: 'No se encontraron pasos: agrega una línea que diga "Instrucciones" seguida de un paso por línea.',
  warnImportNoIngredients: 'La página no incluía ingredientes.', warnImportNoSteps: 'La página no incluía pasos.',
  errValSource: 'Revisa los datos de origen de esta receta.',
  errSsrfUrlLong: 'Ese enlace es demasiado largo.', errSsrfInvalid: 'Ese enlace no es válido.',
  errSsrfHttps: 'Solo se pueden importar enlaces https.', errSsrfCredentials: 'No se permiten enlaces con credenciales.',
  errSsrfPort: 'Solo se pueden importar enlaces https estándar.', errSsrfIpHost: 'Ese tipo de dirección no se puede importar.',
  errSsrfInternal: 'Esa dirección no se puede importar.', errSsrfResolve: 'No pudimos conectar con ese sitio.',
  errSsrfNoResolve: 'No pudimos conectar con ese sitio.', errSsrfNonPublic: 'Esa dirección no se puede importar.',
  errSsrfRedirect: 'Ese enlace redirige a un lugar que no podemos seguir.', errSsrfStatus: 'Esa página no respondió correctamente.',
  errSsrfNotPage: 'Ese enlace no es una página web.', errSsrfTooLarge: 'Esa página es demasiado grande para importar.',
  aiPanelTitle: 'Foto, nota de voz o borrador rápido con IA',
  aiPanelLead: 'Sube una foto de tu plato o tarjeta escrita a mano, graba una nota de voz o escribe notas sueltas — el coeditor estructura la receta y detecta detalles faltantes conservando tu estilo.',
  aiPhotoLabel: 'Foto del plato o receta escrita a mano',
  aiPhotoHint: 'JPEG, PNG o WebP. Se reduce en tu navegador y luego se envía a la API Gemini de Google solo para leer la receta. 2yolks no guarda la foto.',
  aiVoiceStart: 'Dictar nota de voz',
  aiVoiceStop: 'Detener grabación',
  aiVoiceReady: 'Nota de voz adjunta',
  aiNotesLabel: 'Notas rápidas (cómo lo cocinaste)',
  aiNotesPlaceholder: 'Ejemplo: Doré 1 kg de espaldilla en trozos, herví con cebolla y ajo 90 min, licué 5 guajillos y 2 anchos, agregué 800 g de maíz pozolero…',
  aiExtractBtn: 'Crear receta desde foto / notas',
  aiPolishBtn: 'Pulir y revisar mi borrador',
  aiTranslateBtn: 'Traducir borrador',
  aiTargetLangLabel: 'Idioma destino',
  aiUndoBtn: 'Deshacer cambios de IA',
  aiWorking: 'Estructurando tu receta…',
  aiDoneExtract: 'Borrador estructurado. Revisa cada línea y responde las preguntas rápidas abajo.',
  aiDonePolish: 'Borrador pulido para mayor claridad y Modo Cocina. Puedes deshacer en cualquier momento.',
  aiDoneTranslate: 'Borrador traducido conservando todas las cantidades, alérgenos y temporizadores.',
  aiQuestionsHeading: 'Detalles rápidos para que la receta salga perfecta:',
  aiImprovementsHeading: 'Lo que mejoró el coeditor de cocina:',
  aiErrBusy: 'El asistente de IA alcanzó el límite gratuito de hoy. Aún puedes pegar texto o llenar el formulario directamente.',
  aiErrInput: 'Agrega primero una foto, nota de voz, notas rápidas o pasos en el borrador.',
  aiErrTranslateUnavailable: 'La traducción necesita el servicio de IA, que no está disponible ahora mismo. Tu borrador no cambió.',
  aiErrMediaUnavailable: 'Leer fotos y notas de voz necesita el servicio de IA, que no está disponible ahora mismo. Escribe tus notas o pega el texto de la receta. Tu borrador no cambió.',
  aiFallbackNote: 'Solo un orden básico: el servicio de IA no está disponible ahora mismo, así que no se leyó ninguna foto ni nota de voz.',
  aiErrSession: 'Tu sesión terminó. Tu borrador está guardado en este dispositivo, así que no se pierde nada.',
  aiSignInLink: 'Volver a iniciar sesión (abre una pestaña nueva)',
  formPromise: 'Empieza ya: solo necesitas un correo cuando la envíes.',
  aiSignInNote: 'Inicia sesión para usar el asistente de IA',
  startHeading: '¿Cómo quieres empezar?',
  tilePhotoTitle: 'Fotografía tu plato o una ficha de receta', tilePhotoHint: 'El asistente de IA la lee y rellena el formulario.',
  tilePasteTitle: 'Pegar texto', tilePasteHint: 'De una nota, un correo o un documento.',
  tileTypeTitle: 'Escribirla', tileTypeHint: 'Rellena el formulario paso a paso.',
  pasteWorking: 'Leyendo tu texto…', pasteUndo: 'Deshacer',
  stepIndexLabel: 'Secciones del formulario', stepBasics: 'Lo básico', stepIngredients: 'Ingredientes', stepSteps: 'Pasos', stepDetails: 'Detalles', stepCredit: 'Autoría y envío',
  stepBack: 'Atrás', stepNext: 'Siguiente', stepProgress: 'Paso {n} de {total}',
  stepNeedRequired: 'Rellena esto para continuar.',
  stepSoftWarn: 'Vale la pena revisarlo antes de seguir. Pulsa Siguiente otra vez para continuar de todos modos.',
  previewTitle: 'Vista previa', previewTab: 'Vista previa', previewBadge: 'Borrador — aún no probada', previewUntitled: 'El nombre de tu receta',
  previewPrep: 'Preparación {n} min', previewCook: 'Cocción {n} min', previewServes: 'Para {n}',
  previewEmpty: 'Empieza a escribir y aquí aparecerá la ficha de tu receta.', previewBackToForm: 'Volver al formulario',
  authStepTitle: 'Último paso: confirma tu correo',
  authStepLead: 'Te enviamos un código de 6 dígitos. Tu receta se queda aquí, en esta página, mientras lo revisas.',
  authCodeSent: 'Enviamos un código a {email}. Funciona por 10 minutos.',
  authVerifyBtn: 'Confirmar y continuar', authChangeEmail: 'Usar otro correo',
  authWorking: 'Un momento…', authDone: 'Correo confirmado. Guardando tu receta…',
  draftPhotoLabel: 'Foto de tu plato (opcional)',
  draftPhotoHint: 'JPEG, PNG o WebP (máx. 3 MB). Se reduce en tu navegador y queda privada en tu borrador; solo se publica si se aprueba.',
  draftPhotoRemove: 'Quitar foto',
  draftPhotoResizing: 'Preparando foto…',
  draftPhotoSaved: 'Foto actualizada.',
  draftPhotoRemoved: 'Foto eliminada.',
  errDraftPhotoInvalid: 'No se pudo verificar esa foto como un archivo JPEG, PNG o WebP válido de menos de 3 MB.',
  errDraftPhotoStorage: 'El almacenamiento de fotos no está disponible ahora mismo.',
  errDraftPhotoQuota: 'Tus borradores alcanzaron el límite de almacenamiento de fotos. Quita una foto anterior primero.',
  errDraftPhotoRead: 'Elige un archivo de foto válido.',
  statusNeedsChanges: 'Necesita cambios',
  statusDeclined: 'No publicada',
  timelineDraft: 'Borrador',
  timelineReview: 'En revisión',
  timelineLive: 'Publicada',
  inReviewNote: 'La edición está pausada mientras revisamos tu receta y sus derechos.',
  editAndResend: 'Editar y reenviar',
  makeCopy: 'Hacer una copia',
  copyCreated: 'Copiada en un borrador nuevo. Revísala y vuelve a marcar la casilla de permiso cuando estés listo para enviarla.',
  viewLiveRecipe: 'Ver receta publicada',
  needsChangesBanner: 'Cambios solicitados en revisión',
  needsChangesLead: 'Nota de revisión: {note}. Actualiza tu receta abajo, marca de nuevo la casilla de permiso y reenvíala.',
  declinedBanner: 'Esta receta enviada no se publicó.',
  declinedEditNote: 'Las recetas no publicadas no se pueden editar directamente. Crea una copia nueva abajo si quieres rehacerla y enviarla otra vez.',
  mailNeedsChangesSubject: '2yolks: por favor ajusta "{title}"',
  mailNeedsChangesBody: 'Revisamos tu receta "{title}" y necesitamos un pequeño cambio antes de publicarla:\n\n{note}\n\nEdítala y reenvíala aquí:\n{editUrl}\n',
  mailDeclinedSubject: 'Actualización de 2yolks sobre "{title}"',
  mailDeclinedBody: 'Gracias por enviar "{title}". Decidimos no publicar esta entrega:\n\n{note}\n\nPuedes hacer una copia nueva desde Mis recetas:\n{accountUrl}\n',
  mailPublishedSubject: 'Tu receta "{title}" ya está en 2yolks',
  mailPublishedBody: '¡Buenas noticias! "{title}" pasó la revisión y ya está publicada en 2yolks:\n\n{liveUrl}\n',
  lineLimitBadge: '{n} / {max} líneas',
  errTooManyIngredients: 'Máximo {max} líneas de ingredientes — combina especias o guarniciones.',
  errTooManySteps: 'Máximo {max} pasos — combina pasos cortos.',
  ingModeRows: 'Filas guiadas',
  ingModeRaw: 'Texto plano',
  ingQtyPlaceholder: 'Cant.',
  ingUnitPlaceholder: 'Unidad',
  ingItemPlaceholder: 'Ingrediente, corte o nota…',
  ingSectionPlaceholder: 'Sección (ej. Para la salsa)',
  ingAddRow: '+ Añadir ingrediente',
  ingAddSection: '+ Añadir sección',
  stepModeCards: 'Tarjetas de pasos',
  stepPlaceholder: 'Describe este paso con claridad…',
  stepTimerLabel: 'Min.',
  stepAddCard: '+ Añadir paso',
  stepPhotoJump: 'Subir foto del plato',
  moveUp: 'Subir',
  moveDown: 'Bajar',
  removeRow: 'Quitar',
  celebrateLiveTitle: '¡Tu receta ya está publicada! 🎉',
  celebrateLiveLead: 'Compártela con una amistad, un grupo o como tarjeta Story.',
  celebrateStoryBtn: 'Tarjeta Story (PNG)',
  celebrateStoryReady: 'Story guardada',
  celebrateCopyBtn: 'Copiar enlace',
  celebrateLinkCopied: 'Enlace copiado',
  celebrateWhatsApp: 'WhatsApp',
  remixTitleTpl: 'Mi versión de {title}',
  remixIntroTpl: 'Adaptada de "{title}" de {author}.',
  remixBanner: 'Adaptando "{title}" — edita lo que cambiaste, añade tu nombre y el crédito ya queda enlazado.',
  gapPromptLead: 'La gente buscó "{query}" y no encontró nada. ¿Tienes una receta?',
  gapPromptMore: 'Otras búsquedas sin receta:',
  gapPrefilledBanner: 'Creando una receta para "{query}" — pedida por lectores de 2yolks.',
  savedPanelTitle: 'Recetas guardadas',
  savedPanelLead: 'Las recetas que marcaste con ♥ se sincronizan con tu cuenta ({count}).',
  savedPanelLink: 'Ver recetas guardadas',
};

const fr: AccountStrings = {
  titleBlocked: 'Bloqué', errBlocked: "Cette requête ne venait pas de 2yolks.com, elle a donc été bloquée.",
  titleTooLarge: 'Trop volumineux', errTooLarge: 'Cette requête est trop volumineuse.',
  titleSlowDown: 'Doucement', errTooManyTries: 'Trop de tentatives. Patientez une minute.',
  titleBusy: 'Occupé', errBusy: 'La connexion est saturée pour le moment. Réessayez demain.',
  titleNotFound: 'Introuvable', errDraftNotFound: 'Brouillon introuvable.', errDraftNotFoundOrSent: 'Brouillon introuvable, ou déjà envoyé en relecture.',
  titleSubmitted: 'Envoyé',
  okAlreadySentEdit: 'Cette recette a déjà été envoyée en relecture, elle ne peut plus être modifiée ici.',
  errAlreadySent: 'Cette recette a déjà été envoyée en relecture.',
  errAlreadySentNoSave: 'Cette recette a déjà été envoyée en relecture, vos changements n’ont pas été enregistrés.',
  okAlreadySent: 'Déjà envoyée en relecture.',
  titlePermissionNeeded: 'Autorisation requise', errPermissionNeeded: 'Cochez la case d’autorisation à côté de « Envoyer en relecture » avant de l’envoyer.',
  errGeneric: 'Une erreur est survenue. Veuillez réessayer.',
  signInPageTitle: 'Connexion', signInTitle: 'Votre compte 2yolks',
  signInLead: 'Connectez-vous avec un code reçu par e-mail pour garder des brouillons privés et envoyer une recette en relecture. Aucun mot de passe à retenir.',
  signInEmailLabel: 'E-mail', signInButton: 'M’envoyer un code',
  signInHint: 'Les brouillons restent privés. Rien n’est publié sans relecture.',
  errInvalidEmail: 'Saisissez une adresse e-mail valide.', errSigninOff: 'L’e-mail de connexion n’est pas encore activé.',
  errTooManyCodes: 'Trop de codes demandés pour cet e-mail. Réessayez dans quelques minutes.',
  errSendFailed: 'Nous n’avons pas pu envoyer l’e-mail. Veuillez réessayer plus tard.',
  codePageTitle: 'Vérifiez votre e-mail', codeTitle: 'Vérifiez votre e-mail',
  codeLead: 'Nous avons envoyé un code à 6 chiffres à {email}. Il fonctionne pendant 10 minutes. Si vous en avez demandé plusieurs, utilisez celui de la demande la plus récente ; les anciens cessent de fonctionner.',
  codeLabel: 'Code à 6 chiffres', codeButton: 'Connexion',
  errEnterCode: 'Saisissez le code à 6 chiffres.', errCodeExpired: 'Ce code a expiré ou a été épuisé. Demandez-en un nouveau.',
  errCodeWrong: 'Ce code n’est pas le bon.', errCodeUsed: 'Ce code a déjà été utilisé. Demandez-en un nouveau.',
  mailSubject: 'Votre code 2yolks : {code}',
  mailBody: 'Votre code de connexion 2yolks est {code}.\n\nIl expire dans 10 minutes. Si vous ne l’avez pas demandé, ignorez cet e-mail.\n',
  homePageTitle: 'Vos recettes', homeTitle: 'Vos recettes', homeLead: 'Connecté en tant que {email}.',
  addRecipe: 'Ajouter une recette', yourDrafts: 'Vos brouillons',
  emptyDrafts: 'Rien pour l’instant. Partez d’un formulaire, d’un texte collé ou d’un lien.', signOut: 'Déconnexion',
  statusPublished: 'Publiée', statusSubmitted: 'Envoyée en relecture', statusDraft: 'Brouillon privé', editLink: 'Modifier',
  formTitleNew: 'Partager une recette', formTitleEdit: 'Modifier votre brouillon',
  formLead: 'Les brouillons restent privés jusqu’à ce que vous en envoyiez un et que nous le relisions.',
  fixThese: 'À corriger d’abord :',
  startFaster: 'Pour aller plus vite',
  pasteLabel: 'Collez une recette', pasteHint: 'Texte brut avec une ligne de titre, puis « Ingrédients » et « Instructions ». Vous vérifiez tout avant d’enregistrer.', pasteButton: 'Remplir le formulaire avec ce texte',
  importLabel: 'Ou importer depuis un lien', importHint: 'Uniquement votre propre recette, ou une recette que vous avez le droit de partager. Nous lisons les données de recette de la page et rien d’autre.', importButton: 'Remplir le formulaire depuis ce lien',
  importOffName: 'Importer depuis un lien', importOffText: 'n’est pas encore disponible. Collez le texte de la recette ci-dessus.',
  labelTitle: 'Nom de la recette', labelLanguage: 'Langue',
  labelIngredients: 'Ingrédients', ingredientsHint: 'Un par ligne, par exemple « 2 tasses de farine ».',
  labelSteps: 'Étapes', stepsHint: 'Une étape par ligne.',
  labelPrep: 'Minutes de préparation', labelCook: 'Minutes de cuisson', labelServings: 'Portions', optional: '(facultatif)',
  labelAuthor: 'Nom affiché comme auteur',
  labelSource: 'D’où vient cette recette ?', sourceOriginal: 'Je l’ai écrite (ma propre recette)', sourceAdapted: 'Adaptée d’une autre source, ou partagée avec autorisation',
  labelSourceLink: 'Lien vers l’original', sourceLinkHint: '(obligatoire si adaptée ou partagée avec autorisation)',
  attestText: 'J’ai écrit cette recette ou j’ai le droit de la partager. J’autorise 2yolks à la publier avec crédit au nom ci-dessus, et je comprends que 2yolks relit chaque recette avant sa mise en ligne et peut la refuser ou la modifier.',
  saveDraft: 'Enregistrer le brouillon privé',
  pasteFilled: 'Formulaire rempli avec votre texte. Vérifiez chaque ligne, puis enregistrez.',
  errImportOff: 'L’import par lien n’est pas encore activé. Collez le texte de la recette.',
  errTooManyImports: 'Trop d’imports. Patientez une minute.',
  errNoRecipeData: 'Cette page ne contient pas de données de recette lisibles. Collez le texte.',
  importFilled: 'Formulaire rempli depuis {host}. Enregistré comme « adaptée » avec un lien retour. Ne gardez cette recette que si vous avez le droit de la partager.',
  errReadLink: 'Nous n’avons pas pu lire ce lien.',
  errAuthorRequired: 'Ajoutez le nom affiché comme auteur.',
  errAdaptedHttps: 'Les recettes adaptées exigent un lien https:// vers l’original.',
  errPickLanguage: 'Choisissez une langue dans la liste.',
  errRowLimit: 'Ce compte a atteint sa limite de recettes enregistrées, suppressions comprises. En supprimer davantage ne libérera pas d’espace ici.',
  errDraftLimit: 'Vous pouvez garder jusqu’à {max} brouillons. Supprimez-en un d’abord.',
  okSaved: 'Enregistré comme brouillon privé.',
  submitPanelTitle: 'Envoyer en relecture',
  submitPanelHint: 'Nous vérifions la recette et ses droits avant toute publication. La publication n’est jamais automatique.',
  submitButton: 'Envoyer en relecture', removeDraft: 'Supprimer ce brouillon',
  finishTitle: 'Prête à partager ?',
  finishHint: 'Envoyez-la en relecture maintenant, ou enregistrez un brouillon privé et revenez plus tard. Nous vérifions la recette et ses droits avant toute publication. La publication n’est jamais automatique.',
  errAttestToSubmit: 'Cochez la case d’autorisation pour envoyer cette recette en relecture.',
  sentInPageTitle: 'Envoyée', sentInTitle: 'Merci, nous l’avons bien reçue',
  sentInLead: 'Nous relirons « {title} » et ses droits avant toute mise en ligne. Rien n’est publié automatiquement. Suivez l’avancement dans Mes recettes — nous vous écrirons aussi dès qu’elle sera relue.',
  backToRecipes: 'Retour à vos recettes',
  reportPageTitle: 'Vous l’avez cuisinée', reportTitle: 'Vous avez cuisiné cette recette ?',
  reportLead: 'Dites-nous comment « {title} » s’est passée dans votre cuisine. Un modérateur lit chaque signalement avant de marquer la recette comme testée.',
  reportNoteLabel: 'Comment cela s’est-il passé ? (facultatif)', reportNoteHint: 'Temps, portions, tout ce que vous avez dû changer. 280 caractères maximum.',
  reportAttestText: 'J’ai cuisiné cette recette dans une cuisine.',
  reportPhotoLabel: 'Photo de votre plat terminé (facultatif)',
  reportPhotoHint: 'JPEG, PNG ou WebP (max 1,5 Mo). Affichée uniquement si un modérateur approuve votre signalement et la photo.',
  reportPhotoAttestText: 'J’ai pris cette photo moi-même et j’autorise 2yolks à l’afficher avec crédit si elle est approuvée.',
  errReportPhotoInvalid: 'Cette photo n’a pas pu être vérifiée comme un fichier JPEG, PNG ou WebP valide de moins de 1,5 Mo.',
  errReportPhotoAttest: 'Cochez la case d’autorisation photo pour joindre votre photo de cuisine.',
  reportButton: 'Envoyer le signalement',
  reportSentPageTitle: 'Signalement envoyé', reportSentTitle: 'Merci de l’avoir cuisinée',
  reportSentLead: 'Votre signalement pour « {title} » est dans la file de relecture. L’étiquette testée n’apparaît qu’après l’approbation d’un modérateur.',
  errReportOwn: 'Cette recette est la vôtre : son étiquette testée vient de votre envoi initial, pas d’un signalement.',
  errReportNotPublic: 'Cette recette n’est pas publiée, elle ne peut donc pas être signalée comme testée.',
  reportAlreadyLead: 'Vous avez déjà signalé cette recette comme cuisinée. Statut : {status}.',
  reportStatusPending: 'en attente de relecture', reportStatusApproved: 'approuvé', reportStatusRejected: 'non approuvé',
  errReportAttest: 'Cochez la case pour confirmer que vous avez cuisiné cette recette avant d’envoyer le signalement.',
  errValTitle: 'Donnez un nom à la recette (200 caractères max).',
  errValIntro: 'L’introduction est trop longue (2000 caractères max).',
  errValIngredients: 'Ajoutez au moins un ingrédient, un par ligne.',
  errValSteps: 'Ajoutez au moins une étape, une par ligne.',
  errValCategory: 'Choisissez une catégorie dans la liste.',
  errValTimes: 'Vérifiez les temps et les portions : nombres entiers ou décimaux uniquement.',
  warnNoTitle: 'Aucun titre trouvé : la première ligne doit être le nom de la recette.',
  warnNoIngredients: 'Aucun ingrédient trouvé : ajoutez une ligne « Ingrédients » suivie d’un ingrédient par ligne.',
  warnNoSteps: 'Aucune étape trouvée : ajoutez une ligne « Instructions » suivie d’une étape par ligne.',
  warnImportNoIngredients: 'La page ne listait aucun ingrédient.', warnImportNoSteps: 'La page ne listait aucune étape.',
  errValSource: 'Vérifiez les informations de source de cette recette.',
  errSsrfUrlLong: 'Ce lien est trop long.', errSsrfInvalid: 'Ce lien n’est pas valide.',
  errSsrfHttps: 'Seuls les liens https peuvent être importés.', errSsrfCredentials: 'Les liens avec identifiants ne sont pas autorisés.',
  errSsrfPort: 'Seuls les liens https standard peuvent être importés.', errSsrfIpHost: 'Ce type d’adresse ne peut pas être importé.',
  errSsrfInternal: 'Cette adresse ne peut pas être importée.', errSsrfResolve: 'Impossible de joindre ce site.',
  errSsrfNoResolve: 'Impossible de joindre ce site.', errSsrfNonPublic: 'Cette adresse ne peut pas être importée.',
  errSsrfRedirect: 'Ce lien redirige vers une destination que nous ne pouvons pas suivre.', errSsrfStatus: 'Cette page n’a pas répondu correctement.',
  errSsrfNotPage: 'Ce lien n’est pas une page web.', errSsrfTooLarge: 'Cette page est trop volumineuse pour être importée.',
  aiPanelTitle: 'Photo, note vocale ou brouillon rapide avec l’IA',
  aiPanelLead: 'Ajoutez une photo de votre plat ou d’une fiche manuscrite, dictez une note vocale ou écrivez vos notes en vrac — notre co-éditeur structure la recette et signale les détails manquants.',
  aiPhotoLabel: 'Photo du plat ou fiche manuscrite',
  aiPhotoHint: 'JPEG, PNG ou WebP. Redimensionnée dans votre navigateur, puis envoyée à l’API Gemini de Google uniquement pour lire la recette. 2yolks ne conserve pas la photo.',
  aiVoiceStart: 'Dicter une note vocale',
  aiVoiceStop: 'Arrêter l’enregistrement',
  aiVoiceReady: 'Note vocale jointe',
  aiNotesLabel: 'Notes rapides (comment vous l’avez cuisiné)',
  aiNotesPlaceholder: 'Exemple : J’ai fait dorer 1 kg d’épaule de porc en morceaux, mijoté 90 min avec oignon et ail, mixé 5 piments guajillo et 2 ancho…',
  aiExtractBtn: 'Créer la recette depuis photo / notes',
  aiPolishBtn: 'Soigner et vérifier mon brouillon',
  aiTranslateBtn: 'Traduire le brouillon',
  aiTargetLangLabel: 'Langue cible',
  aiUndoBtn: 'Annuler les modifications IA',
  aiWorking: 'Structuration de votre recette…',
  aiDoneExtract: 'Brouillon structuré. Vérifiez chaque ligne et répondez aux questions rapides ci-dessous.',
  aiDonePolish: 'Brouillon clarifié pour le Mode Cuisine. Vous pouvez annuler à tout moment.',
  aiDoneTranslate: 'Brouillon traduit en conservant toutes les quantités, allergènes et minuteurs.',
  aiQuestionsHeading: 'Petites précisions pour réussir la recette à coup sûr :',
  aiImprovementsHeading: 'Ce que le co-éditeur a amélioré :',
  aiErrBusy: 'L’assistant IA a atteint son quota gratuit quotidien. Vous pouvez toujours coller un texte ou remplir le formulaire.',
  aiErrInput: 'Ajoutez d’abord une photo, une note vocale, des notes ou des étapes.',
  aiErrTranslateUnavailable: 'La traduction nécessite le service d’IA, indisponible pour le moment. Votre brouillon n’a pas changé.',
  aiErrMediaUnavailable: 'La lecture des photos et des notes vocales nécessite le service d’IA, indisponible pour le moment. Saisissez vos notes ou collez le texte de la recette. Votre brouillon n’a pas changé.',
  aiFallbackNote: 'Mise en forme basique seulement : le service d’IA est indisponible pour le moment, aucune photo ni note vocale n’a été lue.',
  aiErrSession: 'Votre session a expiré. Votre brouillon est enregistré sur cet appareil, rien n’est perdu.',
  aiSignInLink: 'Se reconnecter (ouvre un nouvel onglet)',
  formPromise: 'Commencez maintenant : un e-mail suffit, au moment de l’envoyer.',
  aiSignInNote: 'Connectez-vous pour utiliser l’assistant IA',
  startHeading: 'Comment voulez-vous commencer ?',
  tilePhotoTitle: 'Photographiez votre plat ou une fiche recette', tilePhotoHint: 'L’assistant IA la lit et remplit le formulaire.',
  tilePasteTitle: 'Coller du texte', tilePasteHint: 'D’une note, d’un e-mail ou d’un document.',
  tileTypeTitle: 'La saisir', tileTypeHint: 'Remplissez le formulaire étape par étape.',
  pasteWorking: 'Lecture de votre texte…', pasteUndo: 'Annuler',
  stepIndexLabel: 'Sections du formulaire', stepBasics: 'L’essentiel', stepIngredients: 'Ingrédients', stepSteps: 'Étapes', stepDetails: 'Détails', stepCredit: 'Crédit et envoi',
  stepBack: 'Retour', stepNext: 'Suivant', stepProgress: 'Étape {n} sur {total}',
  stepNeedRequired: 'Remplissez ce champ pour continuer.',
  stepSoftWarn: 'À vérifier avant de continuer. Appuyez de nouveau sur Suivant pour passer quand même.',
  previewTitle: 'Aperçu', previewTab: 'Aperçu', previewBadge: 'Brouillon — pas encore testée', previewUntitled: 'Le nom de votre recette',
  previewPrep: 'Préparation {n} min', previewCook: 'Cuisson {n} min', previewServes: 'Pour {n}',
  previewEmpty: 'Commencez à écrire : la fiche de votre recette apparaît ici.', previewBackToForm: 'Retour au formulaire',
  authStepTitle: 'Dernière étape : confirmez votre e-mail',
  authStepLead: 'Nous vous envoyons un code à 6 chiffres. Votre recette reste ici, sur cette page, pendant que vous vérifiez.',
  authCodeSent: 'Nous avons envoyé un code à {email}. Il est valable 10 minutes.',
  authVerifyBtn: 'Confirmer et continuer', authChangeEmail: 'Utiliser une autre adresse',
  authWorking: 'Un instant…', authDone: 'E-mail confirmé. Enregistrement de votre recette…',
  draftPhotoLabel: 'Photo de votre plat (facultatif)',
  draftPhotoHint: 'JPEG, PNG ou WebP (max 3 Mo). Redimensionnée dans votre navigateur et gardée privée avec votre brouillon — publiée uniquement si approuvée.',
  draftPhotoRemove: 'Supprimer la photo',
  draftPhotoResizing: 'Préparation de la photo…',
  draftPhotoSaved: 'Photo mise à jour.',
  draftPhotoRemoved: 'Photo supprimée.',
  errDraftPhotoInvalid: 'Cette photo n’a pas pu être vérifiée comme un fichier JPEG, PNG ou WebP valide de moins de 3 Mo.',
  errDraftPhotoStorage: 'Le stockage des photos n’est pas configuré pour le moment.',
  errDraftPhotoQuota: 'Vos brouillons ont atteint la limite de stockage photo. Supprimez d’abord une photo plus ancienne.',
  errDraftPhotoRead: 'Choisissez un fichier photo valide.',
  statusNeedsChanges: 'Modifications demandées',
  statusDeclined: 'Non publiée',
  timelineDraft: 'Brouillon',
  timelineReview: 'En relecture',
  timelineLive: 'En ligne',
  inReviewNote: 'La modification est en pause pendant la relecture de votre recette et de ses droits.',
  editAndResend: 'Modifier et renvoyer',
  makeCopy: 'Créer une copie',
  copyCreated: 'Copiée dans un nouveau brouillon. Relisez-la et cochez de nouveau la case d’autorisation quand elle est prête.',
  viewLiveRecipe: 'Voir la recette publiée',
  needsChangesBanner: 'Modifications demandées par la relecture',
  needsChangesLead: 'Note de relecture : {note}. Mettez la recette à jour ci-dessous, cochez de nouveau la case d’autorisation puis renvoyez-la.',
  declinedBanner: 'Cette proposition n’a pas été publiée.',
  declinedEditNote: 'Une recette non publiée ne peut pas être modifiée directement. Créez une nouvelle copie ci-dessous si vous souhaitez en préparer une nouvelle version.',
  mailNeedsChangesSubject: '2yolks : merci d’ajuster « {title} »',
  mailNeedsChangesBody: 'Nous avons relu votre recette « {title} » et avons besoin d’un ajustement avant sa publication :\n\n{note}\n\nModifiez-la et renvoyez-la ici :\n{editUrl}\n',
  mailDeclinedSubject: 'Nouvelles de 2yolks pour « {title} »',
  mailDeclinedBody: 'Merci d’avoir proposé « {title} ». Nous avons choisi de ne pas publier cette version :\n\n{note}\n\nVous pouvez créer une nouvelle copie depuis Mes recettes :\n{accountUrl}\n',
  mailPublishedSubject: 'Votre recette « {title} » est en ligne sur 2yolks',
  mailPublishedBody: 'Bonne nouvelle : « {title} » a été relue et est maintenant publiée sur 2yolks :\n\n{liveUrl}\n',
  lineLimitBadge: '{n} / {max} lignes',
  errTooManyIngredients: 'Maximum {max} lignes d’ingrédients — regroupez épices ou garnitures.',
  errTooManySteps: 'Maximum {max} étapes — regroupez les étapes courtes.',
  ingModeRows: 'Lignes guidées',
  ingModeRaw: 'Texte brut',
  ingQtyPlaceholder: 'Qté',
  ingUnitPlaceholder: 'Unité',
  ingItemPlaceholder: 'Ingrédient, découpe ou note…',
  ingSectionPlaceholder: 'Section (ex. Pour la sauce)',
  ingAddRow: '+ Ajouter un ingrédient',
  ingAddSection: '+ Ajouter une section',
  stepModeCards: 'Cartes d’étapes',
  stepPlaceholder: 'Décrivez cette étape clairement…',
  stepTimerLabel: 'Min.',
  stepAddCard: '+ Ajouter une étape',
  stepPhotoJump: 'Ajouter une photo',
  moveUp: 'Monter',
  moveDown: 'Descendre',
  removeRow: 'Retirer',
  celebrateLiveTitle: 'Votre recette est en ligne 🎉',
  celebrateLiveLead: 'Partagez-la à un proche, sur un groupe ou en carte Story.',
  celebrateStoryBtn: 'Carte Story (PNG)',
  celebrateStoryReady: 'Story enregistrée',
  celebrateCopyBtn: 'Copier le lien',
  celebrateLinkCopied: 'Lien copié',
  celebrateWhatsApp: 'WhatsApp',
  remixTitleTpl: 'Ma version : {title}',
  remixIntroTpl: 'Adaptée de « {title} » par {author}.',
  remixBanner: 'Adaptation de « {title} » — modifiez vos ajouts, signez de votre nom, le crédit est déjà lié.',
  gapPromptLead: 'Des lecteurs ont cherché « {query} » sans résultat. Vous avez une recette ?',
  gapPromptMore: 'Autres plats recherchés :',
  gapPrefilledBanner: 'Création d’une recette pour « {query} » — demandée par des lecteurs de 2yolks.',
  savedPanelTitle: 'Recettes enregistrées',
  savedPanelLead: 'Les recettes marquées d’un ♥ sont synchronisées avec votre compte ({count}).',
  savedPanelLink: 'Ouvrir les recettes enregistrées',
};

const ACCOUNT_STRINGS: Record<string, AccountStrings> = { en, es, fr };

export const ACCOUNT_LANGS = ['en', 'es', 'fr'] as const;
export type AccountLang = (typeof ACCOUNT_LANGS)[number];

export function isAccountLang(v: unknown): v is AccountLang {
  return typeof v === 'string' && (ACCOUNT_LANGS as readonly string[]).includes(v);
}

export function accountStrings(lang: string): AccountStrings {
  return ACCOUNT_STRINGS[lang] ?? en;
}

/** Replace {name} tokens. Pass already-escaped values when building HTML. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Map a contracts-validator failure path to a friendly localized message. */
export function validatorMessage(t: AccountStrings, path: string, fallback: string): string {
  const p = path.replace(/^locales\[\d+\]\./, '');
  if (p.startsWith('title')) return t.errValTitle;
  if (p.startsWith('intro')) return t.errValIntro;
  if (p.startsWith('ingredients')) return t.errValIngredients;
  if (p.startsWith('steps')) return t.errValSteps;
  if (p.startsWith('category')) return t.errValCategory;
  if (p.startsWith('times')) return t.errValTimes;
  if (['prepMinutes', 'cookMinutes', 'restMinutes', 'totalMinutes', 'baseServings'].some((f) => p.startsWith(f))) return t.errValTimes;
  if (p.startsWith('source')) return t.errValSource;
  return fallback;
}

/** Map a parser warning (paste/import) to a localized one; unknown warnings pass through verbatim. */
export function parseWarningMessage(t: AccountStrings, warning: string): string {
  const map: Record<string, string> = {
    'No title found: the first line should be the recipe name.': t.warnNoTitle,
    'No ingredients found: add a line that says "Ingredients" followed by one per line.': t.warnNoIngredients,
    'No steps found: add a line that says "Instructions" followed by one step per line.': t.warnNoSteps,
    'The page listed no ingredients.': t.warnImportNoIngredients,
    'The page listed no steps.': t.warnImportNoSteps,
  };
  return map[warning] ?? warning;
}

/** Map an ssrf error message to a localized one; unknown messages get the generic error. */
export function ssrfMessage(t: AccountStrings, message: string): string {
  const map: Record<string, string> = {
    'URL too long': t.errSsrfUrlLong,
    'not a valid URL': t.errSsrfInvalid,
    'only https links can be imported': t.errSsrfHttps,
    'links with credentials are not allowed': t.errSsrfCredentials,
    'only the standard https port is allowed': t.errSsrfPort,
    'IP addresses and single-label hosts are not allowed': t.errSsrfIpHost,
    'internal hostnames are not allowed': t.errSsrfInternal,
    'could not resolve host': t.errSsrfResolve,
    'host did not resolve': t.errSsrfNoResolve,
    'host resolves to a non-public address': t.errSsrfNonPublic,
    'redirect without a location': t.errSsrfRedirect,
    'the link is not a web page': t.errSsrfNotPage,
    'page too large': t.errSsrfTooLarge,
  };
  if (message.startsWith('the page answered')) return t.errSsrfStatus;
  return map[message] ?? t.errReadLink;
}
