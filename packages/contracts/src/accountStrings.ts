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
  submitPanelTitle: string; submitPanelHint: string; submitPanelAttestHint: string; submitButton: string; removeDraft: string;
  sentInPageTitle: string; sentInTitle: string; sentInLead: string; backToRecipes: string;
  // validator fallbacks (friendly per-field messages)
  errValTitle: string; errValIntro: string; errValIngredients: string; errValSteps: string; errValCategory: string; errValTimes: string; errValSource: string;
  warnNoTitle: string; warnNoIngredients: string; warnNoSteps: string; warnImportNoIngredients: string; warnImportNoSteps: string;
  // ssrf import errors
  errSsrfUrlLong: string; errSsrfInvalid: string; errSsrfHttps: string; errSsrfCredentials: string; errSsrfPort: string; errSsrfIpHost: string; errSsrfInternal: string; errSsrfResolve: string; errSsrfNoResolve: string; errSsrfNonPublic: string; errSsrfRedirect: string; errSsrfStatus: string; errSsrfNotPage: string; errSsrfTooLarge: string;
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
  titlePermissionNeeded: 'Permission needed', errPermissionNeeded: 'Tick the permission box on the draft and save before sending it in.',
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
  formTitleNew: 'Add a recipe', formTitleEdit: 'Edit your draft',
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
  submitPanelAttestHint: ' Tick the permission box above and save first.',
  submitButton: 'Send in for review', removeDraft: 'Remove this draft',
  sentInPageTitle: 'Sent in', sentInTitle: 'Thanks, it is with us',
  sentInLead: 'We will review "{title}" and its rights before anything goes live. Nothing is published automatically.',
  backToRecipes: 'Back to your recipes',
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
  titlePermissionNeeded: 'Falta el permiso', errPermissionNeeded: 'Marca la casilla de permiso en el borrador y guarda antes de enviarla.',
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
  formTitleNew: 'Añadir una receta', formTitleEdit: 'Editar tu borrador',
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
  submitPanelAttestHint: ' Marca primero la casilla de permiso de arriba y guarda.',
  submitButton: 'Enviar a revisión', removeDraft: 'Eliminar este borrador',
  sentInPageTitle: 'Enviada', sentInTitle: 'Gracias, ya la tenemos',
  sentInLead: 'Revisaremos "{title}" y sus derechos antes de que nada se publique. Nada se publica automáticamente.',
  backToRecipes: 'Volver a tus recetas',
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
  titlePermissionNeeded: 'Autorisation requise', errPermissionNeeded: 'Cochez la case d’autorisation sur le brouillon et enregistrez avant de l’envoyer.',
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
  formTitleNew: 'Ajouter une recette', formTitleEdit: 'Modifier votre brouillon',
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
  submitPanelAttestHint: ' Cochez d’abord la case d’autorisation ci-dessus et enregistrez.',
  submitButton: 'Envoyer en relecture', removeDraft: 'Supprimer ce brouillon',
  sentInPageTitle: 'Envoyée', sentInTitle: 'Merci, nous l’avons bien reçue',
  sentInLead: 'Nous relirons « {title} » et ses droits avant toute mise en ligne. Rien n’est publié automatiquement.',
  backToRecipes: 'Retour à vos recettes',
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
