import { Recipe } from '../lib/supabase';

export const sampleRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Truffle Mushroom Risotto',
    description: 'Creamy arborio rice cooked to perfection with wild mushrooms, finished with truffle oil and aged parmesan. A restaurant-quality dish that brings luxury to your dinner table.',
    author_id: 'sample-user-1',
    author: {
      username: 'chef_alessandro',
      avatar_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '1.5', unit: 'cups', name: 'arborio rice' },
      { quantity: '6', unit: 'cups', name: 'warm mushroom stock' },
      { quantity: '8', unit: 'oz', name: 'mixed wild mushrooms, sliced' },
      { quantity: '1', unit: 'medium', name: 'shallot, finely diced' },
      { quantity: '3', unit: 'cloves', name: 'garlic, minced' },
      { quantity: '1/2', unit: 'cup', name: 'dry white wine' },
      { quantity: '1/2', unit: 'cup', name: 'Parmigiano-Reggiano, grated' },
      { quantity: '3', unit: 'tbsp', name: 'butter' },
      { quantity: '2', unit: 'tbsp', name: 'truffle oil' },
      { quantity: '2', unit: 'tbsp', name: 'fresh parsley, chopped' }
    ],
    steps: [
      { description: 'Heat olive oil in a large pan and sauté mushrooms until golden. Set aside.' },
      { description: 'In the same pan, melt 1 tablespoon butter and cook shallot until translucent.' },
      { description: 'Add garlic and rice, stirring for 2 minutes until rice is coated.' },
      { description: 'Pour in wine and stir until absorbed.' },
      { description: 'Add warm stock one ladle at a time, stirring constantly until absorbed.' },
      { description: 'Continue for 18-20 minutes until rice is creamy and al dente.' },
      { description: 'Stir in mushrooms, remaining butter, Parmesan, and truffle oil.' },
      { description: 'Garnish with parsley and serve immediately.' }
    ],
    tags: ['Italian', 'Vegetarian', 'Gourmet', 'Comfort Food', 'Truffle'],
    cook_time: 30,
    prep_time: 15,
    difficulty: 'Medium',
    nutrition: {
      calories: 420,
      protein: '14g',
      carbs: '58g',
      fat: '16g',
      fiber: '3g'
    },
    rating: 4.8,
    review_count: 127,
    image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
    is_published: true,
    is_featured: true
  },
  {
    id: '2',
    title: 'Pan-Seared Salmon with Lemon Herb Butter',
    description: 'Perfectly crispy-skinned salmon fillet with a tender, flaky interior. Finished with aromatic lemon herb butter and served with seasonal vegetables.',
    author_id: 'sample-user-2',
    author: {
      username: 'seafood_chef',
      avatar_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '4', unit: 'fillets', name: 'salmon, skin-on (6 oz each)' },
      { quantity: '4', unit: 'tbsp', name: 'unsalted butter' },
      { quantity: '2', unit: 'tbsp', name: 'fresh lemon juice' },
      { quantity: '1', unit: 'tbsp', name: 'fresh dill, chopped' },
      { quantity: '1', unit: 'tbsp', name: 'fresh parsley, chopped' },
      { quantity: '2', unit: 'cloves', name: 'garlic, minced' },
      { quantity: '2', unit: 'tbsp', name: 'olive oil' },
      { quantity: '1', unit: 'tsp', name: 'sea salt' },
      { quantity: '1/2', unit: 'tsp', name: 'black pepper' }
    ],
    steps: [
      { description: 'Pat salmon fillets dry and season with salt and pepper.' },
      { description: 'Heat olive oil in a large skillet over medium-high heat.' },
      { description: 'Place salmon skin-side up and cook for 4-5 minutes without moving.' },
      { description: 'Flip carefully and cook for 3-4 minutes more until cooked through.' },
      { description: 'Remove salmon and reduce heat to low.' },
      { description: 'Add butter, garlic, lemon juice, and herbs to the pan.' },
      { description: 'Swirl until butter is melted and fragrant.' },
      { description: 'Spoon herb butter over salmon and serve immediately.' }
    ],
    tags: ['Seafood', 'Healthy', 'Quick', 'Protein', 'Gourmet'],
    cook_time: 12,
    prep_time: 8,
    difficulty: 'Easy',
    nutrition: {
      calories: 380,
      protein: '35g',
      carbs: '2g',
      fat: '26g',
      fiber: '0g'
    },
    rating: 4.9,
    review_count: 203,
    image_url: 'https://images.pexels.com/photos/3296434/pexels-photo-3296434.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/3296434/pexels-photo-3296434.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-19T14:30:00Z',
    updated_at: '2024-01-19T14:30:00Z',
    is_published: true,
    is_featured: true
  },
  {
    id: '3',
    title: 'Artisan Sourdough Bread',
    description: 'Traditional sourdough bread with a perfectly crispy crust and soft, tangy interior. Made with wild yeast starter and aged for optimal flavor development.',
    author_id: 'sample-user-3',
    author: {
      username: 'bread_artisan',
      avatar_url: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '500', unit: 'g', name: 'bread flour' },
      { quantity: '375', unit: 'ml', name: 'water, room temperature' },
      { quantity: '100', unit: 'g', name: 'active sourdough starter' },
      { quantity: '10', unit: 'g', name: 'sea salt' },
      { quantity: '1', unit: 'tbsp', name: 'olive oil for bowl' }
    ],
    steps: [
      { description: 'Mix flour and water in a large bowl. Let rest for 30 minutes (autolyse).' },
      { description: 'Add sourdough starter and salt. Mix until well combined.' },
      { description: 'Perform 4 sets of stretch and folds every 30 minutes.' },
      { description: 'Bulk ferment for 4-6 hours at room temperature.' },
      { description: 'Pre-shape and rest for 20 minutes.' },
      { description: 'Final shape and place in banneton. Refrigerate overnight.' },
      { description: 'Preheat Dutch oven to 450°F. Score and bake covered for 20 minutes.' },
      { description: 'Remove lid and bake 20-25 minutes until golden brown.' }
    ],
    tags: ['Bread', 'Sourdough', 'Artisan', 'Fermented', 'Traditional'],
    cook_time: 45,
    prep_time: 60,
    difficulty: 'Hard',
    nutrition: {
      calories: 220,
      protein: '8g',
      carbs: '45g',
      fat: '2g',
      fiber: '2g'
    },
    rating: 4.7,
    review_count: 89,
    image_url: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1586947/pexels-photo-1586947.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-18T16:45:00Z',
    updated_at: '2024-01-18T16:45:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '4',
    title: 'Wagyu Beef Tenderloin with Red Wine Reduction',
    description: 'Premium wagyu beef tenderloin cooked to perfection, served with a rich red wine reduction sauce and roasted root vegetables.',
    author_id: 'sample-user-4',
    author: {
      username: 'fine_dining_chef',
      avatar_url: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '4', unit: 'pieces', name: 'wagyu beef tenderloin (8 oz each)' },
      { quantity: '2', unit: 'cups', name: 'red wine' },
      { quantity: '1', unit: 'cup', name: 'beef stock' },
      { quantity: '2', unit: 'tbsp', name: 'shallots, minced' },
      { quantity: '3', unit: 'tbsp', name: 'cold butter' },
      { quantity: '2', unit: 'tbsp', name: 'fresh thyme' },
      { quantity: '2', unit: 'tbsp', name: 'olive oil' },
      { quantity: '1', unit: 'tsp', name: 'coarse sea salt' },
      { quantity: '1/2', unit: 'tsp', name: 'cracked black pepper' }
    ],
    steps: [
      { description: 'Bring steaks to room temperature and season generously.' },
      { description: 'Heat olive oil in a cast iron skillet over high heat.' },
      { description: 'Sear steaks for 2-3 minutes per side for medium-rare.' },
      { description: 'Rest steaks while preparing the sauce.' },
      { description: 'In the same pan, sauté shallots until fragrant.' },
      { description: 'Add wine and stock, reduce by half.' },
      { description: 'Whisk in cold butter and thyme off the heat.' },
      { description: 'Slice steaks and serve with reduction sauce.' }
    ],
    tags: ['Beef', 'Gourmet', 'Fine Dining', 'Wagyu', 'Special Occasion'],
    cook_time: 20,
    prep_time: 15,
    difficulty: 'Medium',
    nutrition: {
      calories: 650,
      protein: '55g',
      carbs: '4g',
      fat: '42g',
      fiber: '0g'
    },
    rating: 4.9,
    review_count: 156,
    image_url: 'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-17T12:20:00Z',
    updated_at: '2024-01-17T12:20:00Z',
    is_published: true,
    is_featured: true
  },
  {
    id: '5',
    title: 'Mediterranean Quinoa Bowl',
    description: 'Nutritious quinoa bowl loaded with fresh Mediterranean vegetables, feta cheese, olives, and a zesty lemon-herb dressing.',
    author_id: 'sample-user-5',
    author: {
      username: 'healthy_kitchen',
      avatar_url: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '2', unit: 'cups', name: 'cooked quinoa' },
      { quantity: '1', unit: 'cup', name: 'cherry tomatoes, halved' },
      { quantity: '1', unit: 'cucumber', name: 'diced' },
      { quantity: '1/2', unit: 'cup', name: 'red onion, thinly sliced' },
      { quantity: '1/2', unit: 'cup', name: 'Kalamata olives' },
      { quantity: '4', unit: 'oz', name: 'feta cheese, crumbled' },
      { quantity: '1/4', unit: 'cup', name: 'extra virgin olive oil' },
      { quantity: '2', unit: 'tbsp', name: 'lemon juice' },
      { quantity: '1', unit: 'tsp', name: 'dried oregano' },
      { quantity: '2', unit: 'tbsp', name: 'fresh parsley, chopped' }
    ],
    steps: [
      { description: 'Cook quinoa according to package directions and let cool.' },
      { description: 'Prepare all vegetables and arrange in serving bowls.' },
      { description: 'Whisk together olive oil, lemon juice, and oregano.' },
      { description: 'Add quinoa to bowls and top with vegetables.' },
      { description: 'Sprinkle with feta cheese and olives.' },
      { description: 'Drizzle with dressing and garnish with parsley.' },
      { description: 'Serve immediately or chill for later.' }
    ],
    tags: ['Mediterranean', 'Healthy', 'Vegetarian', 'Quinoa', 'Fresh'],
    cook_time: 0,
    prep_time: 20,
    difficulty: 'Easy',
    nutrition: {
      calories: 320,
      protein: '12g',
      carbs: '35g',
      fat: '16g',
      fiber: '6g'
    },
    rating: 4.6,
    review_count: 134,
    image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1213710/pexels-photo-1213710.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-16T11:15:00Z',
    updated_at: '2024-01-16T11:15:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '6',
    title: 'Lobster Thermidor',
    description: 'Classic French lobster dish with tender lobster meat in a rich, creamy sauce, topped with cheese and broiled to golden perfection.',
    author_id: 'sample-user-6',
    author: {
      username: 'french_cuisine',
      avatar_url: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '2', unit: 'whole', name: 'live lobsters (1.5 lbs each)' },
      { quantity: '4', unit: 'tbsp', name: 'butter' },
      { quantity: '2', unit: 'tbsp', name: 'flour' },
      { quantity: '1', unit: 'cup', name: 'heavy cream' },
      { quantity: '1/4', unit: 'cup', name: 'dry sherry' },
      { quantity: '1/2', unit: 'cup', name: 'Gruyère cheese, grated' },
      { quantity: '2', unit: 'tbsp', name: 'Dijon mustard' },
      { quantity: '1', unit: 'tsp', name: 'paprika' },
      { quantity: '2', unit: 'tbsp', name: 'fresh chives, chopped' }
    ],
    steps: [
      { description: 'Boil lobsters for 8 minutes, then cool and extract meat.' },
      { description: 'Reserve shells and chop lobster meat into chunks.' },
      { description: 'Melt butter in a saucepan and whisk in flour.' },
      { description: 'Gradually add cream, whisking until smooth.' },
      { description: 'Stir in sherry, mustard, and half the cheese.' },
      { description: 'Fold in lobster meat and fill reserved shells.' },
      { description: 'Top with remaining cheese and paprika.' },
      { description: 'Broil for 3-4 minutes until golden and bubbly.' }
    ],
    tags: ['French', 'Seafood', 'Luxury', 'Special Occasion', 'Classic'],
    cook_time: 25,
    prep_time: 30,
    difficulty: 'Hard',
    nutrition: {
      calories: 520,
      protein: '42g',
      carbs: '8g',
      fat: '36g',
      fiber: '0g'
    },
    rating: 4.8,
    review_count: 78,
    image_url: 'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3296434/pexels-photo-3296434.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-15T18:30:00Z',
    updated_at: '2024-01-15T18:30:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '7',
    title: 'Chocolate Lava Cake',
    description: 'Decadent individual chocolate cakes with a molten chocolate center. Served warm with vanilla ice cream and fresh berries.',
    author_id: 'sample-user-7',
    author: {
      username: 'pastry_chef',
      avatar_url: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '6', unit: 'oz', name: 'dark chocolate (70% cocoa)' },
      { quantity: '6', unit: 'tbsp', name: 'unsalted butter' },
      { quantity: '2', unit: 'large', name: 'eggs' },
      { quantity: '2', unit: 'large', name: 'egg yolks' },
      { quantity: '1/4', unit: 'cup', name: 'granulated sugar' },
      { quantity: '2', unit: 'tbsp', name: 'all-purpose flour' },
      { quantity: '1', unit: 'tsp', name: 'vanilla extract' },
      { quantity: '1', unit: 'pinch', name: 'salt' },
      { quantity: '1', unit: 'tbsp', name: 'butter for ramekins' },
      { quantity: '1', unit: 'tbsp', name: 'cocoa powder for dusting' }
    ],
    steps: [
      { description: 'Preheat oven to 425°F. Butter and dust 4 ramekins with cocoa.' },
      { description: 'Melt chocolate and butter in a double boiler until smooth.' },
      { description: 'Whisk eggs, egg yolks, and sugar until thick and pale.' },
      { description: 'Fold in melted chocolate mixture and vanilla.' },
      { description: 'Gently fold in flour and salt until just combined.' },
      { description: 'Divide batter among prepared ramekins.' },
      { description: 'Bake for 12-14 minutes until edges are firm.' },
      { description: 'Let rest 1 minute, then invert onto plates and serve.' }
    ],
    tags: ['Dessert', 'Chocolate', 'French', 'Individual', 'Molten'],
    cook_time: 14,
    prep_time: 20,
    difficulty: 'Medium',
    nutrition: {
      calories: 380,
      protein: '8g',
      carbs: '32g',
      fat: '26g',
      fiber: '4g'
    },
    rating: 4.9,
    review_count: 245,
    image_url: 'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/890577/pexels-photo-890577.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-14T15:45:00Z',
    updated_at: '2024-01-14T15:45:00Z',
    is_published: true,
    is_featured: true
  },
  {
    id: '8',
    title: 'Duck Confit with Cherry Gastrique',
    description: 'Traditional French duck leg confit, slow-cooked in its own fat until tender, served with a sweet and tangy cherry gastrique sauce.',
    author_id: 'sample-user-8',
    author: {
      username: 'classical_chef',
      avatar_url: 'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '4', unit: 'pieces', name: 'duck legs' },
      { quantity: '2', unit: 'cups', name: 'duck fat' },
      { quantity: '4', unit: 'cloves', name: 'garlic' },
      { quantity: '3', unit: 'sprigs', name: 'fresh thyme' },
      { quantity: '2', unit: 'bay leaves', name: '' },
      { quantity: '1', unit: 'cup', name: 'fresh cherries, pitted' },
      { quantity: '1/4', unit: 'cup', name: 'red wine vinegar' },
      { quantity: '2', unit: 'tbsp', name: 'honey' },
      { quantity: '1', unit: 'tbsp', name: 'coarse sea salt' },
      { quantity: '1', unit: 'tsp', name: 'black pepper' }
    ],
    steps: [
      { description: 'Season duck legs with salt and pepper, cure overnight.' },
      { description: 'Preheat oven to 225°F.' },
      { description: 'Place duck in baking dish with fat, garlic, thyme, and bay leaves.' },
      { description: 'Cook for 2.5-3 hours until meat is tender.' },
      { description: 'For gastrique, cook cherries, vinegar, and honey until syrupy.' },
      { description: 'Remove duck from fat and crisp skin under broiler.' },
      { description: 'Strain gastrique and season to taste.' },
      { description: 'Serve duck with warm cherry gastrique.' }
    ],
    tags: ['French', 'Duck', 'Confit', 'Traditional', 'Gourmet'],
    cook_time: 180,
    prep_time: 30,
    difficulty: 'Hard',
    nutrition: {
      calories: 580,
      protein: '38g',
      carbs: '18g',
      fat: '42g',
      fiber: '2g'
    },
    rating: 4.7,
    review_count: 92,
    image_url: 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-13T09:20:00Z',
    updated_at: '2024-01-13T09:20:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '9',
    title: 'Seared Scallops with Cauliflower Purée',
    description: 'Perfectly seared sea scallops with a golden crust, served over silky cauliflower purée and finished with crispy pancetta and microgreens.',
    author_id: 'sample-user-9',
    author: {
      username: 'modern_cuisine',
      avatar_url: 'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '12', unit: 'large', name: 'sea scallops, side muscle removed' },
      { quantity: '1', unit: 'head', name: 'cauliflower, cut into florets' },
      { quantity: '1/2', unit: 'cup', name: 'heavy cream' },
      { quantity: '3', unit: 'oz', name: 'pancetta, diced' },
      { quantity: '2', unit: 'tbsp', name: 'butter' },
      { quantity: '2', unit: 'tbsp', name: 'olive oil' },
      { quantity: '1', unit: 'tsp', name: 'sea salt' },
      { quantity: '1/2', unit: 'tsp', name: 'white pepper' },
      { quantity: '1', unit: 'handful', name: 'microgreens for garnish' }
    ],
    steps: [
      { description: 'Boil cauliflower until very tender, about 15 minutes.' },
      { description: 'Drain and purée with cream and butter until silky smooth.' },
      { description: 'Season purée with salt and white pepper, keep warm.' },
      { description: 'Cook pancetta until crispy, set aside.' },
      { description: 'Pat scallops dry and season with salt.' },
      { description: 'Heat oil in a hot pan and sear scallops 2 minutes per side.' },
      { description: 'Spoon purée onto plates and top with scallops.' },
      { description: 'Garnish with pancetta and microgreens.' }
    ],
    tags: ['Seafood', 'Fine Dining', 'Scallops', 'Modern', 'Elegant'],
    cook_time: 25,
    prep_time: 20,
    difficulty: 'Medium',
    nutrition: {
      calories: 320,
      protein: '28g',
      carbs: '12g',
      fat: '18g',
      fiber: '4g'
    },
    rating: 4.8,
    review_count: 167,
    image_url: 'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1516415/pexels-photo-1516415.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3296434/pexels-photo-3296434.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-12T08:30:00Z',
    updated_at: '2024-01-12T08:30:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '10',
    title: 'Ratatouille Tian',
    description: 'Beautiful Provençal vegetable tian with layers of zucchini, eggplant, and tomatoes, seasoned with herbs de Provence and olive oil.',
    author_id: 'sample-user-10',
    author: {
      username: 'vegetable_master',
      avatar_url: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '2', unit: 'medium', name: 'zucchini, sliced thin' },
      { quantity: '1', unit: 'large', name: 'eggplant, sliced thin' },
      { quantity: '4', unit: 'large', name: 'tomatoes, sliced thin' },
      { quantity: '1', unit: 'large', name: 'onion, diced' },
      { quantity: '4', unit: 'cloves', name: 'garlic, minced' },
      { quantity: '1/4', unit: 'cup', name: 'extra virgin olive oil' },
      { quantity: '2', unit: 'tbsp', name: 'herbs de Provence' },
      { quantity: '1', unit: 'tsp', name: 'sea salt' },
      { quantity: '1/2', unit: 'tsp', name: 'black pepper' },
      { quantity: '2', unit: 'tbsp', name: 'fresh basil, chopped' }
    ],
    steps: [
      { description: 'Preheat oven to 375°F.' },
      { description: 'Sauté onion and garlic in olive oil until soft.' },
      { description: 'Spread onion mixture in bottom of baking dish.' },
      { description: 'Arrange vegetable slices in overlapping pattern.' },
      { description: 'Drizzle with olive oil and season with herbs and salt.' },
      { description: 'Cover with foil and bake for 40 minutes.' },
      { description: 'Remove foil and bake 20 minutes more until tender.' },
      { description: 'Garnish with fresh basil before serving.' }
    ],
    tags: ['French', 'Vegetarian', 'Healthy', 'Provençal', 'Colorful'],
    cook_time: 60,
    prep_time: 25,
    difficulty: 'Easy',
    nutrition: {
      calories: 180,
      protein: '4g',
      carbs: '22g',
      fat: '10g',
      fiber: '8g'
    },
    rating: 4.5,
    review_count: 123,
    image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1213710/pexels-photo-1213710.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-11T19:15:00Z',
    updated_at: '2024-01-11T19:15:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '11',
    title: 'Crème Brûlée',
    description: 'Classic French vanilla custard dessert with a perfectly caramelized sugar crust. Rich, creamy, and elegantly presented.',
    author_id: 'sample-user-11',
    author: {
      username: 'dessert_specialist',
      avatar_url: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '2', unit: 'cups', name: 'heavy cream' },
      { quantity: '1', unit: 'vanilla bean', name: 'split and scraped' },
      { quantity: '6', unit: 'large', name: 'egg yolks' },
      { quantity: '1/3', unit: 'cup', name: 'granulated sugar' },
      { quantity: '6', unit: 'tbsp', name: 'turbinado sugar for topping' },
      { quantity: '1', unit: 'pinch', name: 'salt' }
    ],
    steps: [
      { description: 'Preheat oven to 325°F.' },
      { description: 'Heat cream with vanilla bean until just simmering.' },
      { description: 'Whisk egg yolks with sugar until pale.' },
      { description: 'Slowly temper hot cream into egg mixture.' },
      { description: 'Strain mixture and divide among ramekins.' },
      { description: 'Bake in water bath for 35-40 minutes until set.' },
      { description: 'Chill for at least 2 hours.' },
      { description: 'Sprinkle with turbinado sugar and torch until caramelized.' }
    ],
    tags: ['French', 'Dessert', 'Custard', 'Classic', 'Elegant'],
    cook_time: 40,
    prep_time: 20,
    difficulty: 'Medium',
    nutrition: {
      calories: 320,
      protein: '6g',
      carbs: '18g',
      fat: '26g',
      fiber: '0g'
    },
    rating: 4.9,
    review_count: 198,
    image_url: 'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/890577/pexels-photo-890577.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-10T07:45:00Z',
    updated_at: '2024-01-10T07:45:00Z',
    is_published: true,
    is_featured: true
  },
  {
    id: '12',
    title: 'Beef Wellington',
    description: 'The ultimate showstopper: tender beef tenderloin wrapped in mushroom duxelles and flaky puff pastry, cooked to perfection.',
    author_id: 'sample-user-12',
    author: {
      username: 'master_chef',
      avatar_url: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '3', unit: 'lbs', name: 'beef tenderloin, trimmed' },
      { quantity: '1', unit: 'lb', name: 'puff pastry, thawed' },
      { quantity: '1', unit: 'lb', name: 'mixed mushrooms, finely chopped' },
      { quantity: '8', unit: 'slices', name: 'prosciutto' },
      { quantity: '2', unit: 'tbsp', name: 'Dijon mustard' },
      { quantity: '2', unit: 'tbsp', name: 'olive oil' },
      { quantity: '2', unit: 'egg yolks', name: 'beaten for wash' },
      { quantity: '2', unit: 'tbsp', name: 'fresh thyme' },
      { quantity: '1', unit: 'tsp', name: 'coarse salt' },
      { quantity: '1/2', unit: 'tsp', name: 'black pepper' }
    ],
    steps: [
      { description: 'Season beef and sear in hot oil until browned all over.' },
      { description: 'Brush with mustard and let cool completely.' },
      { description: 'Sauté mushrooms until all moisture evaporates.' },
      { description: 'Lay prosciutto on plastic wrap, spread mushrooms over.' },
      { description: 'Wrap beef in prosciutto-mushroom layer tightly.' },
      { description: 'Wrap in puff pastry, sealing edges with egg wash.' },
      { description: 'Brush with egg wash and score decoratively.' },
      { description: 'Bake at 400°F for 25-30 minutes until golden.' }
    ],
    tags: ['British', 'Beef', 'Pastry', 'Special Occasion', 'Showstopper'],
    cook_time: 35,
    prep_time: 45,
    difficulty: 'Hard',
    nutrition: {
      calories: 680,
      protein: '48g',
      carbs: '24g',
      fat: '44g',
      fiber: '2g'
    },
    rating: 4.8,
    review_count: 89,
    image_url: 'https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-09T13:20:00Z',
    updated_at: '2024-01-09T13:20:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '13',
    title: 'Sushi Omakase Platter',
    description: 'Chef\'s selection of premium sushi featuring the finest seasonal fish, expertly prepared with traditional techniques and presented beautifully.',
    author_id: 'sample-user-13',
    author: {
      username: 'sushi_master',
      avatar_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '2', unit: 'cups', name: 'sushi rice, prepared' },
      { quantity: '6', unit: 'oz', name: 'sashimi-grade tuna' },
      { quantity: '6', unit: 'oz', name: 'sashimi-grade salmon' },
      { quantity: '4', unit: 'oz', name: 'yellowtail' },
      { quantity: '4', unit: 'pieces', name: 'uni (sea urchin)' },
      { quantity: '2', unit: 'tbsp', name: 'wasabi, freshly grated' },
      { quantity: '1/4', unit: 'cup', name: 'soy sauce' },
      { quantity: '2', unit: 'tbsp', name: 'pickled ginger' },
      { quantity: '1', unit: 'sheet', name: 'nori, cut into strips' }
    ],
    steps: [
      { description: 'Prepare sushi rice with proper seasoning and temperature.' },
      { description: 'Slice fish with sharp knife at proper angles.' },
      { description: 'Form rice into uniform nigiri pieces.' },
      { description: 'Top rice with fish, applying gentle pressure.' },
      { description: 'Arrange on wooden board with garnishes.' },
      { description: 'Serve immediately with wasabi, soy sauce, and ginger.' }
    ],
    tags: ['Japanese', 'Sushi', 'Raw Fish', 'Traditional', 'Artisan'],
    cook_time: 0,
    prep_time: 45,
    difficulty: 'Hard',
    nutrition: {
      calories: 420,
      protein: '38g',
      carbs: '45g',
      fat: '12g',
      fiber: '2g'
    },
    rating: 4.9,
    review_count: 156,
    image_url: 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/2098085/pexels-photo-2098085.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/2098085/pexels-photo-2098085.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-08T16:30:00Z',
    updated_at: '2024-01-08T16:30:00Z',
    is_published: true,
    is_featured: true
  },
  {
    id: '14',
    title: 'Truffle Mac and Cheese',
    description: 'Elevated comfort food featuring artisanal pasta in a rich cheese sauce with black truffle shavings and crispy breadcrumb topping.',
    author_id: 'sample-user-14',
    author: {
      username: 'comfort_elevated',
      avatar_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '1', unit: 'lb', name: 'elbow macaroni' },
      { quantity: '4', unit: 'tbsp', name: 'butter' },
      { quantity: '1/4', unit: 'cup', name: 'flour' },
      { quantity: '3', unit: 'cups', name: 'whole milk' },
      { quantity: '8', unit: 'oz', name: 'Gruyère cheese, grated' },
      { quantity: '4', unit: 'oz', name: 'sharp cheddar, grated' },
      { quantity: '2', unit: 'oz', name: 'black truffle, shaved' },
      { quantity: '1', unit: 'cup', name: 'panko breadcrumbs' },
      { quantity: '2', unit: 'tbsp', name: 'truffle oil' },
      { quantity: '1', unit: 'tsp', name: 'white pepper' }
    ],
    steps: [
      { description: 'Cook pasta until al dente, reserve pasta water.' },
      { description: 'Make roux with butter and flour in large pot.' },
      { description: 'Gradually whisk in milk until smooth.' },
      { description: 'Add cheeses and stir until melted.' },
      { description: 'Fold in pasta and half the truffle shavings.' },
      { description: 'Top with breadcrumbs and remaining truffle.' },
      { description: 'Broil until golden and bubbly.' },
      { description: 'Drizzle with truffle oil before serving.' }
    ],
    tags: ['Comfort Food', 'Truffle', 'Cheese', 'Elevated', 'Indulgent'],
    cook_time: 25,
    prep_time: 15,
    difficulty: 'Medium',
    nutrition: {
      calories: 580,
      protein: '24g',
      carbs: '52g',
      fat: '32g',
      fiber: '3g'
    },
    rating: 4.7,
    review_count: 234,
    image_url: 'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-07T14:15:00Z',
    updated_at: '2024-01-07T14:15:00Z',
    is_published: true,
    is_featured: false
  },
  {
    id: '15',
    title: 'Paella Valenciana',
    description: 'Authentic Spanish paella with saffron-infused rice, rabbit, chicken, green beans, and lima beans, cooked in a traditional paellera.',
    author_id: 'sample-user-15',
    author: {
      username: 'spanish_tradition',
      avatar_url: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    },
    ingredients: [
      { quantity: '3', unit: 'cups', name: 'Spanish short-grain rice' },
      { quantity: '1', unit: 'whole', name: 'chicken, cut into pieces' },
      { quantity: '1', unit: 'lb', name: 'rabbit, cut into pieces' },
      { quantity: '1', unit: 'cup', name: 'green beans, trimmed' },
      { quantity: '1', unit: 'cup', name: 'lima beans' },
      { quantity: '6', unit: 'cups', name: 'chicken stock' },
      { quantity: '1', unit: 'tsp', name: 'saffron threads' },
      { quantity: '1/4', unit: 'cup', name: 'Spanish olive oil' },
      { quantity: '2', unit: 'tomatoes', name: 'grated' },
      { quantity: '4', unit: 'cloves', name: 'garlic, minced' },
      { quantity: '1', unit: 'tsp', name: 'sweet paprika' },
      { quantity: '1', unit: 'sprig', name: 'fresh rosemary' }
    ],
    steps: [
      { description: 'Heat oil in paellera and brown chicken and rabbit pieces.' },
      { description: 'Add green beans and lima beans, cook for 5 minutes.' },
      { description: 'Add garlic, tomato, and paprika, cook until fragrant.' },
      { description: 'Add rice and stir to coat with sofrito.' },
      { description: 'Pour in hot saffron stock and add rosemary.' },
      { description: 'Simmer without stirring for 20 minutes.' },
      { description: 'Let rest for 5 minutes before serving.' },
      { description: 'Garnish with lemon wedges.' }
    ],
    tags: ['Spanish', 'Rice', 'Traditional', 'Saffron', 'One-Pot'],
    cook_time: 35,
    prep_time: 25,
    difficulty: 'Medium',
    nutrition: {
      calories: 520,
      protein: '32g',
      carbs: '58g',
      fat: '18g',
      fiber: '4g'
    },
    rating: 4.6,
    review_count: 178,
    image_url: 'https://images.pexels.com/photos/16743489/pexels-photo-16743489.jpeg?auto=compress&cs=tinysrgb&w=800',
    gallery_images: [
      'https://images.pexels.com/photos/16743489/pexels-photo-16743489.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    created_at: '2024-01-06T12:45:00Z',
    updated_at: '2024-01-06T12:45:00Z',
    is_published: true,
    is_featured: false
  }
];