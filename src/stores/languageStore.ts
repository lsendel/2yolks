import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    home: 'Home',
    recipes: 'Recipes',
    addRecipe: 'Add Recipe',
    myRecipes: 'My Recipes',
    saved: 'Saved',
    mealPlanner: 'Meal Planner',
    shoppingList: 'Shopping List',
    settings: 'Settings',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    joinFree: 'Join Free',
    
    // Recipe Details
    featured: 'Featured',
    minutes: 'minutes',
    servings: 'servings',
    reviews: 'reviews',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    nutrition: 'Nutrition',
    calories: 'Calories',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    fiber: 'Fiber',
    cookingTimer: 'Cooking Timer',
    prepTime: 'Prep Time',
    cookTime: 'Cook Time',
    totalTime: 'Total Time',
    min: 'min',
    tags: 'Tags',
    
    // Difficulty levels
    'difficulty.easy': 'Easy',
    'difficulty.medium': 'Medium',
    'difficulty.hard': 'Hard',
    
    // Reviews
    writeReview: 'Write Review',
    rating: 'Rating',
    comment: 'Comment',
    shareYourThoughts: 'Share your thoughts about this recipe...',
    submit: 'Submit',
    cancel: 'Cancel',
    
    // Common
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  },
  es: {
    // Navigation
    home: 'Inicio',
    recipes: 'Recetas',
    addRecipe: 'Añadir Receta',
    myRecipes: 'Mis Recetas',
    saved: 'Guardadas',
    mealPlanner: 'Planificador de Comidas',
    shoppingList: 'Lista de Compras',
    settings: 'Configuración',
    signIn: 'Iniciar Sesión',
    signOut: 'Cerrar Sesión',
    joinFree: 'Únete Gratis',
    
    // Recipe Details
    featured: 'Destacado',
    minutes: 'minutos',
    servings: 'porciones',
    reviews: 'reseñas',
    ingredients: 'Ingredientes',
    instructions: 'Instrucciones',
    nutrition: 'Nutrición',
    calories: 'Calorías',
    protein: 'Proteína',
    carbs: 'Carbohidratos',
    fat: 'Grasa',
    fiber: 'Fibra',
    cookingTimer: 'Temporizador de Cocina',
    prepTime: 'Tiempo de Preparación',
    cookTime: 'Tiempo de Cocción',
    totalTime: 'Tiempo Total',
    min: 'min',
    tags: 'Etiquetas',
    
    // Difficulty levels
    'difficulty.easy': 'Fácil',
    'difficulty.medium': 'Medio',
    'difficulty.hard': 'Difícil',
    
    // Reviews
    writeReview: 'Escribir Reseña',
    rating: 'Calificación',
    comment: 'Comentario',
    shareYourThoughts: 'Comparte tus pensamientos sobre esta receta...',
    submit: 'Enviar',
    cancel: 'Cancelar',
    
    // Common
    search: 'Buscar',
    filter: 'Filtrar',
    sort: 'Ordenar',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
  },
  fr: {
    // Navigation
    home: 'Accueil',
    recipes: 'Recettes',
    addRecipe: 'Ajouter une Recette',
    myRecipes: 'Mes Recettes',
    saved: 'Sauvegardées',
    mealPlanner: 'Planificateur de Repas',
    shoppingList: 'Liste de Courses',
    settings: 'Paramètres',
    signIn: 'Se Connecter',
    signOut: 'Se Déconnecter',
    joinFree: 'Rejoindre Gratuitement',
    
    // Recipe Details
    featured: 'En Vedette',
    minutes: 'minutes',
    servings: 'portions',
    reviews: 'avis',
    ingredients: 'Ingrédients',
    instructions: 'Instructions',
    nutrition: 'Nutrition',
    calories: 'Calories',
    protein: 'Protéines',
    carbs: 'Glucides',
    fat: 'Lipides',
    fiber: 'Fibres',
    cookingTimer: 'Minuteur de Cuisine',
    prepTime: 'Temps de Préparation',
    cookTime: 'Temps de Cuisson',
    totalTime: 'Temps Total',
    min: 'min',
    tags: 'Étiquettes',
    
    // Difficulty levels
    'difficulty.easy': 'Facile',
    'difficulty.medium': 'Moyen',
    'difficulty.hard': 'Difficile',
    
    // Reviews
    writeReview: 'Écrire un Avis',
    rating: 'Note',
    comment: 'Commentaire',
    shareYourThoughts: 'Partagez vos impressions sur cette recette...',
    submit: 'Soumettre',
    cancel: 'Annuler',
    
    // Common
    search: 'Rechercher',
    filter: 'Filtrer',
    sort: 'Trier',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
  },
  de: {
    // Navigation
    home: 'Startseite',
    recipes: 'Rezepte',
    addRecipe: 'Rezept Hinzufügen',
    myRecipes: 'Meine Rezepte',
    saved: 'Gespeichert',
    mealPlanner: 'Mahlzeitenplaner',
    shoppingList: 'Einkaufsliste',
    settings: 'Einstellungen',
    signIn: 'Anmelden',
    signOut: 'Abmelden',
    joinFree: 'Kostenlos Beitreten',
    
    // Recipe Details
    featured: 'Empfohlen',
    minutes: 'Minuten',
    servings: 'Portionen',
    reviews: 'Bewertungen',
    ingredients: 'Zutaten',
    instructions: 'Anweisungen',
    nutrition: 'Nährwerte',
    calories: 'Kalorien',
    protein: 'Protein',
    carbs: 'Kohlenhydrate',
    fat: 'Fett',
    fiber: 'Ballaststoffe',
    cookingTimer: 'Koch-Timer',
    prepTime: 'Vorbereitungszeit',
    cookTime: 'Kochzeit',
    totalTime: 'Gesamtzeit',
    min: 'Min',
    tags: 'Tags',
    
    // Difficulty levels
    'difficulty.easy': 'Einfach',
    'difficulty.medium': 'Mittel',
    'difficulty.hard': 'Schwer',
    
    // Reviews
    writeReview: 'Bewertung Schreiben',
    rating: 'Bewertung',
    comment: 'Kommentar',
    shareYourThoughts: 'Teilen Sie Ihre Gedanken zu diesem Rezept...',
    submit: 'Senden',
    cancel: 'Abbrechen',
    
    // Common
    search: 'Suchen',
    filter: 'Filtern',
    sort: 'Sortieren',
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
  }
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      setLanguage: (language: string) => set({ language }),
      t: (key: string) => {
        const { language } = get();
        const translation = translations[language as keyof typeof translations];
        return translation?.[key as keyof typeof translation] || key;
      },
    }),
    {
      name: '2yolks-language',
    }
  )
);