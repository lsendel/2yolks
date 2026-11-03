// SEO utility functions
export const generateMetaTags = (page: {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: string;
}) => {
  const baseUrl = 'https://2yolks.com';
  const defaultImage = `${baseUrl}/og-image.jpg`;
  
  return {
    title: `${page.title} | 2yolks`,
    description: page.description,
    keywords: page.keywords?.join(', ') || 'recipes, cooking, gourmet, chef recipes',
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.url || baseUrl,
      type: page.type || 'website',
      image: page.image || defaultImage,
      siteName: '2yolks',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      image: page.image || defaultImage,
    },
  };
};

export const generateStructuredData = (type: string, data: any) => {
  const baseStructure = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Recipe':
      return {
        ...baseStructure,
        name: data.title,
        description: data.description,
        image: data.image_url,
        author: {
          '@type': 'Person',
          name: data.author?.username || 'Anonymous Chef',
        },
        datePublished: data.created_at,
        prepTime: `PT${data.prep_time}M`,
        cookTime: `PT${data.cook_time}M`,
        totalTime: `PT${data.prep_time + data.cook_time}M`,
        recipeYield: data.servings,
        recipeCategory: data.tags?.[0] || 'Main Course',
        recipeCuisine: data.tags?.find((tag: string) => 
          ['Italian', 'French', 'Asian', 'Mexican', 'American'].includes(tag)
        ) || 'International',
        recipeIngredient: data.ingredients?.map((ing: any) => 
          `${ing.quantity} ${ing.unit} ${ing.name}`
        ) || [],
        recipeInstructions: data.steps?.map((step: any, index: number) => ({
          '@type': 'HowToStep',
          text: step.description,
          position: index + 1,
        })) || [],
        nutrition: data.nutrition ? {
          '@type': 'NutritionInformation',
          calories: data.nutrition.calories,
          proteinContent: data.nutrition.protein,
          carbohydrateContent: data.nutrition.carbs,
          fatContent: data.nutrition.fat,
          fiberContent: data.nutrition.fiber,
        } : undefined,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: data.rating,
          reviewCount: data.review_count,
        },
      };

    case 'WebSite':
      return {
        ...baseStructure,
        name: '2yolks',
        description: 'Extraordinary recipes from passionate chefs worldwide',
        url: 'https://2yolks.com',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://2yolks.com/explore?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
        publisher: {
          '@type': 'Organization',
          name: '2yolks',
          logo: {
            '@type': 'ImageObject',
            url: 'https://2yolks.com/logo.png',
          },
        },
      };

    case 'Organization':
      return {
        ...baseStructure,
        name: '2yolks',
        description: 'Premium cooking platform for food lovers and chefs',
        url: 'https://2yolks.com',
        logo: 'https://2yolks.com/logo.png',
        sameAs: [
          'https://twitter.com/2yolks',
          'https://instagram.com/2yolks',
          'https://facebook.com/2yolks',
        ],
      };

    default:
      return baseStructure;
  }
};

// Analytics tracking functions
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

export const trackPageView = (url: string, title: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      page_title: title,
      page_location: url,
    });
  }
};

// Recipe-specific tracking
export const trackRecipeView = (recipeId: string, recipeTitle: string) => {
  trackEvent('view_item', {
    item_id: recipeId,
    item_name: recipeTitle,
    item_category: 'recipe',
  });
};

export const trackRecipeSearch = (searchTerm: string, resultCount: number) => {
  trackEvent('search', {
    search_term: searchTerm,
    result_count: resultCount,
  });
};

export const trackRecipeSave = (recipeId: string, recipeTitle: string) => {
  trackEvent('add_to_wishlist', {
    item_id: recipeId,
    item_name: recipeTitle,
    item_category: 'recipe',
  });
};

export const trackUserSignup = (method: string, userRole: string) => {
  trackEvent('sign_up', {
    method: method,
    user_role: userRole,
  });
};

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}