export const ROLES = [
  { id: "mom", label: "Mom", emoji: "👩" },
  { id: "dad", label: "Dad", emoji: "👨" },
  { id: "child", label: "Child", emoji: "🧒" },
  { id: "baby", label: "Baby", emoji: "👶" },
  { id: "grandma", label: "Grandma", emoji: "👵" },
  { id: "grandpa", label: "Grandpa", emoji: "👴" },
  { id: "pet", label: "Pet", emoji: "🐾" },
  { id: "other", label: "Other", emoji: "🌟" },
];

export const STYLES = [
  { id: "sb", name: "Storybook", tagline: "Warm, timeless — like the books you grew up with", mood: "Classic", emoji: "✨", className: "sc-sb",
    anchor: "Classic children's picture book illustration, flat graphic style, bold outlines, vibrant colours, warm palette, professional children's book art" },
  { id: "wc", name: "Watercolor", tagline: "Soft, dreamy — painterly and poetic", mood: "Dreamy", emoji: "🎨", className: "sc-wc",
    anchor: "Soft watercolour children's book illustration, hand-painted texture, gentle colour washes, warm diffused lighting, painterly strokes" },
  { id: "bb", name: "Bold & Bright", tagline: "Vibrant, modern — big personality on every page", mood: "Vibrant", emoji: "🌈", className: "sc-bb",
    anchor: "Bold bright digital illustration, vivid saturated colours, clean lines, high contrast, playful energy, modern picture book style" },
  { id: "cs", name: "Cozy & Soft", tagline: "Gentle pastel tones — perfect for bedtime stories", mood: "Gentle", emoji: "🧸", className: "sc-cs",
    anchor: "Cozy warmly-lit illustration, muted earth tones, soft textured brushwork, gentle shadows, intimate homey feeling, picture book quality" },
  { id: "sc", name: "Sketch & Color", tagline: "Whimsical hand-drawn feel — like it was made just for them", mood: "Whimsical", emoji: "✏️", className: "sc-sc",
    anchor: "Hand-sketched illustration with selective colour washes, visible pencil linework, whimsical art journal quality, warm paper texture" },
];

export const SPARKS = [
  { id: "adventure", emoji: "🗺️", title: "Big Adventure", subtitle: "They discover something amazing" },
  { id: "magic", emoji: "✨", title: "Magic Kingdom", subtitle: "Where anything is possible" },
  { id: "bedtime", emoji: "🌙", title: "Bedtime Journey", subtitle: "A cozy dream adventure" },
  { id: "superhero", emoji: "🦸", title: "Superhero Day", subtitle: "They save the day!" },
  { id: "nature", emoji: "🌿", title: "Into the Wild", subtitle: "Forest, ocean & jungle" },
  { id: "space", emoji: "🚀", title: "Space Explorer", subtitle: "Stars & galaxies await" },
  { id: "friendship", emoji: "🤝", title: "New Friend", subtitle: "A heartwarming bond" },
  { id: "sports", emoji: "⚽", title: "The Big Game", subtitle: "Dream big, play bigger" },
  { id: "custom", emoji: "💭", title: "My Own Idea", subtitle: "Type anything…" },
];

export const LOVES = [
  { id: "dinos", emoji: "🦕", label: "Dinosaurs" },
  { id: "unicorns", emoji: "🦄", label: "Unicorns" },
  { id: "space", emoji: "🚀", label: "Space" },
  { id: "ocean", emoji: "🌊", label: "Ocean" },
  { id: "dragons", emoji: "🐉", label: "Dragons" },
  { id: "sports", emoji: "⚽", label: "Sports" },
  { id: "music", emoji: "🎵", label: "Music" },
  { id: "animals", emoji: "🐾", label: "Animals" },
  { id: "magic", emoji: "🪄", label: "Magic" },
  { id: "cars", emoji: "🚗", label: "Cars" },
  { id: "art", emoji: "🎨", label: "Art" },
  { id: "food", emoji: "🍕", label: "Food" },
  { id: "robots", emoji: "🤖", label: "Robots" },
  { id: "trains", emoji: "🚂", label: "Trains" },
  { id: "bugs", emoji: "🐛", label: "Bugs & Science" },
  { id: "fairies", emoji: "🧚", label: "Fairies" },
];

export const MOODS = [
  { id: "funny", emoji: "😂", label: "Funny & silly" },
  { id: "warm", emoji: "🥰", label: "Heartwarming" },
  { id: "exciting", emoji: "🎉", label: "Exciting" },
  { id: "bedtime", emoji: "🌙", label: "Cozy bedtime" },
  { id: "epic", emoji: "🦸", label: "Epic adventure" },
];

export const SPARK_REACTIONS = {
  adventure: "Ooh, an adventure! 🗺️ I love it already...",
  magic: "A magic kingdom — this is going to be enchanting ✨",
  bedtime: "A cozy bedtime story 🌙 So dreamy...",
  superhero: "SUPERHERO DAY!! 🦸 They'll feel so powerful!",
  nature: "Into the wild 🌿 I can hear the birds already...",
  space: "SPACE!! 🚀 Out of this world!",
  friendship: "A friendship story 🤝 These always make me emotional...",
  sports: "Game day!! ⚽ Let's make it legendary!",
  custom: "Your own unique idea — the best kind! 💭",
};

export const STORY_WORLDS = [
  { id: "magical_forest", label: "Magical Forest", emoji: "🌳", vocab: "ancient twisted trees, dappled golden sunlight, glowing mushrooms, fireflies, moss-covered stones, emerald greens and warm ambers" },
  { id: "space_explorer", label: "Space Explorer", emoji: "🚀", vocab: "cosmic purple and deep blue, stars and nebulae, metallic surfaces, curved futuristic architecture, lens flares" },
  { id: "dragon_friends", label: "Dragon Friends", emoji: "🐉", vocab: "dramatic cliff faces, ember-glowing caves, vast skies with silhouetted wings, warm amber and deep crimson" },
  { id: "ocean_discovery", label: "Ocean Discovery", emoji: "🌊", vocab: "turquoise and coral palette, underwater caustic light, bubbles, colourful fish, coral reef, bioluminescence" },
  { id: "the_kingdom", label: "The Kingdom", emoji: "🏰", vocab: "castle spires, banners, cobblestone paths, rolling green hills, golden crowns, royal purple and stone grey" },
  { id: "enchanted_garden", label: "Enchanted Garden", emoji: "🌸", vocab: "oversized flowers, hidden pathways, soft pastel petals, dew drops, butterfly wings, gentle morning light" },
  { id: "dinosaur_island", label: "Dinosaur Island", emoji: "🦕", vocab: "volcanic peaks, lush prehistoric jungle, massive fern fronds, ancient eggs, earth tones and vibrant greens" },
  { id: "robot_city", label: "Robot City", emoji: "🤖", vocab: "gleaming chrome buildings, neon accent lights, friendly rounded robots, circuit patterns, cool blue and warm orange" },
  { id: "magical_circus", label: "Magical Circus", emoji: "🎪", vocab: "striped tent peaks, floating stars, trapeze silhouettes, confetti, bold red and gold and deep purple" },
  { id: "great_mountain", label: "The Great Mountain", emoji: "🏔️", vocab: "snow-capped peaks, winding trails, alpine meadows, crystal-clear streams, sunrise golds and deep blues" },
  { id: "dream_world", label: "Dream World", emoji: "💭", vocab: "floating islands, impossible staircases, cotton-candy clouds, soft rainbow gradients, surreal gentle lighting" },
  { id: "baking_kingdom", label: "Baking Kingdom", emoji: "🧁", vocab: "candy-coloured buildings, frosting rivers, cookie paths, sugar crystal trees, warm pinks and creamy whites" },
];

export const PERSONALITY_TRAITS = [
  { id: "adventurous", emoji: "🧗", label: "Adventurous" },
  { id: "funny", emoji: "😄", label: "Funny" },
  { id: "kind", emoji: "💛", label: "Kind" },
  { id: "brave", emoji: "🦁", label: "Brave" },
  { id: "creative", emoji: "🎨", label: "Creative" },
  { id: "curious", emoji: "🔍", label: "Curious" },
  { id: "gentle", emoji: "🕊️", label: "Gentle" },
  { id: "energetic", emoji: "⚡", label: "Energetic" },
  { id: "dreamy", emoji: "☁️", label: "Dreamy" },
  { id: "determined", emoji: "💪", label: "Determined" },
  { id: "shy", emoji: "🌸", label: "Shy but surprising" },
  { id: "imaginative", emoji: "✨", label: "Wildly imaginative" },
];

export const PET_TRAITS = [
  { id: "mischievous", emoji: "😈", label: "Mischievous" },
  { id: "cuddly", emoji: "🤗", label: "Cuddly" },
  { id: "hungry", emoji: "🍖", label: "Dramatically hungry" },
  { id: "brave_pet", emoji: "🦸", label: "Brave (or thinks they are)" },
  { id: "goofy", emoji: "🤪", label: "Goofy" },
  { id: "loyal", emoji: "💛", label: "Loyal" },
  { id: "suspicious", emoji: "🧐", label: "Suspicious of everything" },
  { id: "smart", emoji: "🧠", label: "Too smart for their own good" },
  { id: "chaos", emoji: "🌪️", label: "Pure chaos" },
  { id: "gentle_giant", emoji: "🐘", label: "Gentle giant" },
  { id: "napper", emoji: "😴", label: "Always napping" },
  { id: "boss", emoji: "👑", label: "The boss" },
];

export const STORY_FORMATS = [
  { id: "rhyming", emoji: "🎵", label: "Rhyming", example: "One rainy day, Emma found a key / That opened a door to the Whispering Sea...", note: "Best for ages 3–6, bedtime, playful" },
  { id: "classic", emoji: "📖", label: "Classic Story", example: "Emma had never seen a door quite like that one...", note: "Best for ages 5–10, emotional depth" },
  { id: "funny", emoji: "😂", label: "Funny & Silly", example: "Emma's dragon sneezed and turned the castle into a bouncy castle.", note: "Any age, maximum giggles" },
];

export const STORY_TONES = [
  { id: "cozy", label: "Cozy & Calming", lighting: "warm golden hour lighting, soft shadows, sunset palette" },
  { id: "exciting", label: "Exciting & Dramatic", lighting: "dynamic lighting, high contrast, dramatic sky" },
  { id: "heartfelt", label: "Warm & Heartfelt", lighting: "soft warm light, gentle tones, tender atmosphere" },
  { id: "chaotic", label: "Funny & Chaotic", lighting: "bright saturated colours, playful energy, exaggerated expressions" },
];

export const STORY_LESSONS = [
  { id: "brave", label: "Being Brave" },
  { id: "kindness", label: "Kindness" },
  { id: "sharing", label: "Sharing & Teamwork" },
  { id: "believing", label: "Believing in Yourself" },
  { id: "nature", label: "Caring for Nature" },
  { id: "home", label: "No Place Like Home" },
];

export const STORY_MODES = [
  { id: "child", emoji: "👦", label: "A Child", desc: "The bedtime classic", steps: 8 },
  { id: "pet", emoji: "🐾", label: "A Pet", desc: "Dogs, cats, any beloved animal", steps: 7 },
  { id: "family", emoji: "👨‍👩‍👧", label: "A Family", desc: "Everyone in the adventure", steps: 7 },
  { id: "special", emoji: "💛", label: "Someone Special", desc: "A gift for someone you love", steps: 7 },
  { id: "imagination", emoji: "✨", label: "Pure Imagination", desc: "No real people needed", steps: 6 },
];

export const COMPANION_TYPES = [
  { id: "mom", emoji: "👩", label: "Mom/Dad" },
  { id: "friend", emoji: "🤝", label: "Best Friend" },
  { id: "sibling", emoji: "👧", label: "Sibling" },
  { id: "pet_companion", emoji: "🐾", label: "Pet" },
  { id: "grandparent", emoji: "👵", label: "Grandparent" },
  { id: "guide", emoji: "🧙", label: "Magical Guide" },
];

export const MAGICAL_GUIDES = [
  { id: "fox", label: "Talking Fox", emoji: "🦊" },
  { id: "dragon", label: "Tiny Dragon", emoji: "🐉" },
  { id: "robot", label: "Friendly Robot", emoji: "🤖" },
  { id: "owl", label: "Wise Owl", emoji: "🦉" },
  { id: "fairy", label: "Sparkly Fairy", emoji: "🧚" },
];

export const SECRET_CHIPS = [
  "Just started school",
  "New baby sibling",
  "Lost first tooth",
  "Won something",
  "Working through a fear",
  "It's their birthday",
  "Missing someone",
  "Family trip coming up",
];

export const BOOK_LENGTHS = [
  { id: 4, label: "Quick Read", emoji: "📖", desc: "4 pages" },
  { id: 6, label: "Classic", emoji: "⭐", desc: "6 pages", default: true },
  { id: 10, label: "Epic Adventure", emoji: "🚀", desc: "10 pages", premium: true },
];
