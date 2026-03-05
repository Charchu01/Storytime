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

// ── Book Types ──────────────────────────────────────────────────────────────
export const BOOK_TYPES = [
  {
    id: "adventure",
    emoji: "🗺️",
    title: "Adventure Story",
    subtitle: "A magical quest with twists and wonder",
    claudeFormat: "classic narrative prose with beginning, middle, triumph, and resolution",
    example: "Emma discovered a map hidden in the old oak tree...",
    category: "story",
    pageCount: { standard: 6, premium: 10 },
  },
  {
    id: "nursery_rhyme",
    emoji: "🎵",
    title: "Nursery Rhyme Book",
    subtitle: "Rhythmic, bouncy, read-aloud magic",
    claudeFormat: "strict AABB rhyme scheme, 8-10 syllables per line, musical rhythm, designed to be read aloud and memorised",
    example: "One sunny day, Dom found a door / That led to somewhere never seen before",
    category: "story",
    pageCount: { standard: 6, premium: 10 },
  },
  {
    id: "bedtime",
    emoji: "🌙",
    title: "Bedtime Story",
    subtitle: "Soft, cozy, ends with sleep",
    claudeFormat: "gentle wind-down story, gradually quieter, soft soothing language, MUST end with hero peacefully asleep",
    example: "The stars came out one by one, each whispering goodnight...",
    category: "story",
    pageCount: { standard: 6, premium: 10 },
  },
  {
    id: "abc",
    emoji: "🔤",
    title: "My ABC Book",
    subtitle: "A is for Adventure, B is for Brave...",
    claudeFormat: "personalised alphabet book, one letter per spread, rhyming couplet connecting the letter to the child's world, letter displayed large",
    example: "D is for Dom, so brave and so bright / O is for Ocean, his favourite sight",
    category: "educational",
    pageCount: { standard: 10, premium: 10 },
  },
  {
    id: "counting",
    emoji: "🔢",
    title: "My Counting Book",
    subtitle: "1 brave hero, 2 silly friends...",
    claudeFormat: "count from 1-10, one number per spread, each number introduces something from the story, accumulating pattern",
    example: "1 little Dom, ready for fun / 2 friendly birds said 'come along, come!'",
    category: "educational",
    pageCount: { standard: 10, premium: 10 },
  },
  {
    id: "superhero",
    emoji: "🦸",
    title: "Superhero Origin Story",
    subtitle: "The day they discovered their powers",
    claudeFormat: "superhero origin story, discovers unique power connected to real trait (kindness, curiosity, laughter), faces a challenge, overcomes it, embraces identity. Action-packed with heart",
    example: "Nobody knew that Emma's kindness was actually a superpower...",
    category: "story",
    pageCount: { standard: 6, premium: 10 },
  },
  {
    id: "love_letter",
    emoji: "💌",
    title: "A Love Letter",
    subtitle: "All the reasons you're amazing",
    claudeFormat: "direct address affirmation book ('Did you know...', 'I love the way you...'), each spread is a reason the child is amazing, tender and specific, final spread is biggest declaration",
    example: "Did you know that your laugh sounds like sunshine?",
    category: "occasion",
    pageCount: { standard: 6, premium: 10 },
  },
  {
    id: "day_in_life",
    emoji: "☀️",
    title: "A Day in My Life",
    subtitle: "Morning to bedtime, beautifully illustrated",
    claudeFormat: "chronological day following the hero: wake up, breakfast, activities, play, dinner, bath, bed. Ground in REAL routines but add magical/wonderful moments. Celebrates everyday life",
    example: "Dom woke up, stretched wide, and the adventure began...",
    category: "story",
    pageCount: { standard: 6, premium: 10 },
  },
];

export const BOOK_TYPE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "story", label: "Story" },
  { id: "educational", label: "Educational" },
  { id: "occasion", label: "Occasion" },
];

// ── Art Styles ──────────────────────────────────────────────────────────────
export const STYLES = [
  {
    id: "storybook",
    name: "Classic Storybook",
    tagline: "Warm and timeless",
    anchor: "classic children's storybook illustration with bold saturated colours, clean outlines, warm painterly backgrounds, expressive simplified faces with large eyes",
    nanoPromptStyle: "classic children's storybook illustration with bold saturated colours, clean outlines, and warm painterly backgrounds",
  },
  {
    id: "watercolor",
    name: "Soft Watercolor",
    tagline: "Dreamy and gentle",
    anchor: "soft watercolour children's book illustration with visible brushstrokes, dreamy washes, gentle colour bleeds, and white paper showing through",
    nanoPromptStyle: "soft watercolour children's book illustration with visible brushstrokes, dreamy washes, and gentle colour bleeds",
  },
  {
    id: "pixar",
    name: "Pixar / 3D Animated",
    tagline: "Like a movie poster",
    anchor: "Pixar-style 3D animated children's illustration with soft rounded characters, cinematic lighting, vibrant colours, subsurface skin scattering, volumetric light, and movie-quality rendering",
    nanoPromptStyle: "Pixar-style 3D animated children's illustration with soft rounded characters, cinematic lighting, vibrant colours, subsurface skin scattering, and movie-quality rendering. Like a still from a Pixar film",
  },
  {
    id: "bold",
    name: "Bold & Bright",
    tagline: "Vibrant and modern",
    anchor: "modern vibrant children's book illustration with thick bold outlines, flat graphic colours, strong shapes, playful energy, contemporary award-winning picture book aesthetic",
    nanoPromptStyle: "modern vibrant children's book illustration with thick bold outlines, flat graphic colours, and playful energy",
  },
  {
    id: "cozy",
    name: "Cozy & Soft",
    tagline: "Pastel bedtime vibes",
    anchor: "gentle pastel children's bedtime book illustration with rounded shapes, soft muted tones, plush toy aesthetic, cozy warmth, rosy cheeks",
    nanoPromptStyle: "gentle pastel children's bedtime book illustration with rounded shapes, soft muted tones, and cozy warmth",
  },
  {
    id: "sketch",
    name: "Sketch & Color",
    tagline: "Hand-drawn charm",
    anchor: "whimsical hand-drawn children's book illustration with visible pencil lines, loose ink outlines, watercolour wash fills, charming imperfection",
    nanoPromptStyle: "whimsical hand-drawn children's book illustration with visible pencil lines, loose ink outlines, and watercolour wash fills",
  },
  {
    id: "anime",
    name: "Anime / Manga",
    tagline: "Big eyes, big emotions",
    anchor: "anime-style children's book illustration with large expressive eyes, soft cel-shading, pastel colour palette, gentle magical atmosphere, Studio Ghibli inspired warmth",
    nanoPromptStyle: "anime-style children's book illustration with large expressive eyes, soft cel-shading, pastel colour palette, and gentle magical atmosphere. Studio Ghibli inspired warmth",
  },
  {
    id: "retro",
    name: "Vintage Storybook",
    tagline: "Like a 1960s classic",
    anchor: "retro vintage children's book illustration in the style of 1950s-1960s picture books, slightly muted colour palette, visible print texture, mid-century modern design, charming simplified characters",
    nanoPromptStyle: "retro vintage children's book illustration in the style of 1950s-1960s picture books, slightly muted colour palette, visible print texture, charming simplified characters, mid-century modern design sensibility",
  },
  {
    id: "collage",
    name: "Paper Collage",
    tagline: "Textured and crafty",
    anchor: "paper collage children's book illustration with torn paper textures, fabric patterns, layered cut-out shapes, mixed media, handmade crafty aesthetic",
    nanoPromptStyle: "paper collage children's book illustration with torn paper textures, fabric patterns, layered cut-out shapes, mixed media feel, handmade crafty aesthetic with warm colours",
  },
  {
    id: "minimal",
    name: "Clean & Minimal",
    tagline: "Simple, Scandinavian beauty",
    anchor: "minimalist Scandinavian children's book illustration with clean simple shapes, limited colour palette, generous white space, elegant geometric characters, Nordic design aesthetic",
    nanoPromptStyle: "minimalist Scandinavian children's book illustration with clean simple shapes, limited colour palette, lots of white space, elegant geometric characters, modern Nordic design aesthetic",
  },
];

// ── Tones ────────────────────────────────────────────────────────────────────
export const TONES = [
  {
    id: "cozy",
    emoji: "🧸",
    label: "Cozy & Warm",
    claudeAtmosphere: "warm golden-hour lighting, soft glowing lamps, amber and honey tones, feels like a warm blanket",
    nanoLighting: "warm golden hour lighting, soft shadows, amber tones",
  },
  {
    id: "exciting",
    emoji: "🎉",
    label: "Exciting & Epic",
    claudeAtmosphere: "dynamic dramatic lighting, bold contrasts, vivid saturated colours, cinematic energy, wide sweeping shots",
    nanoLighting: "dynamic dramatic lighting, bold contrasts, vivid colours",
  },
  {
    id: "funny",
    emoji: "😂",
    label: "Funny & Silly",
    claudeAtmosphere: "bright playful lighting, exaggerated expressions, candy colours, physical comedy, maximum fun energy",
    nanoLighting: "bright playful lighting, exaggerated cartoon expressions",
  },
  {
    id: "heartfelt",
    emoji: "❤️",
    label: "Heartfelt & Tender",
    claudeAtmosphere: "soft diffused light, gentle warmth, intimate close framing, tender atmosphere, will make the reader cry",
    nanoLighting: "soft warm diffused light, intimate tender atmosphere",
  },
  {
    id: "dreamy",
    emoji: "☁️",
    label: "Dreamy & Magical",
    claudeAtmosphere: "ethereal glowing light, soft focus, magical particles, aurora colours, floating elements, surreal gentle beauty",
    nanoLighting: "ethereal soft glow, magical particles, aurora colours",
  },
  {
    id: "spooky",
    emoji: "🎃",
    label: "Spooky (but fun!)",
    claudeAtmosphere: "purple and orange Halloween palette, friendly ghosts, playful shadows, moonlit scenes, spooky-cute not scary",
    nanoLighting: "purple moonlight, orange candlelight, playful shadows",
  },
];

// ── Occasions ────────────────────────────────────────────────────────────────
export const OCCASIONS = [
  { id: "just_because", emoji: "✨", label: "Just because", prompt: "" },
  { id: "birthday", emoji: "🎂", label: "Birthday", prompt: "This is a birthday gift. Make the hero feel celebrated and special." },
  { id: "christmas", emoji: "🎄", label: "Christmas / Holiday", prompt: "This is a holiday gift. Weave in festive warmth and family togetherness." },
  { id: "new_baby", emoji: "👶", label: "New baby in family", prompt: "A new baby is joining the family. Reassure the hero that they are still deeply loved." },
  { id: "first_school", emoji: "🏫", label: "Starting school", prompt: "The hero is starting school. Address nervousness with courage and discovery." },
  { id: "graduation", emoji: "🎓", label: "Graduation", prompt: "A graduation celebration. Reflect on growth and look forward to the future." },
  { id: "valentines", emoji: "💕", label: "Valentine's Day", prompt: "A Valentine's gift celebrating love — romantic or family love." },
  { id: "mothers_day", emoji: "👩", label: "Mother's Day", prompt: "A Mother's Day gift. Celebrate what makes this mum incredible." },
  { id: "fathers_day", emoji: "👨", label: "Father's Day", prompt: "A Father's Day gift. Celebrate the dad-child bond." },
  { id: "get_well", emoji: "🏥", label: "Get well soon", prompt: "The hero is sick or recovering. Fill with comfort, hope, and healing magic." },
  { id: "moving", emoji: "🏡", label: "Moving house", prompt: "The family is moving. Address leaving friends while finding wonder in new beginnings." },
  { id: "tooth_fairy", emoji: "🦷", label: "Lost a tooth", prompt: "The hero lost a tooth! Celebrate this milestone with magic and wonder." },
];

// ── Age Ranges ───────────────────────────────────────────────────────────────
export const AGE_RANGES = [
  {
    id: "baby",
    label: "0-2 (Baby)",
    emoji: "👶",
    claudeReading: "Board book style. 1-2 words per page max. Simple nouns and sounds. 'Peek-a-boo!' Repetitive patterns. Sensory words.",
    maxWordsPerPage: 5,
  },
  {
    id: "toddler",
    label: "2-4 (Toddler)",
    emoji: "🧒",
    claudeReading: "Simple sentences, 5-10 words per page. Repetition and rhythm. Name familiar objects. Cause-and-effect. 'Then... and then...'",
    maxWordsPerPage: 15,
  },
  {
    id: "preschool",
    label: "4-6 (Preschool)",
    emoji: "👧",
    claudeReading: "2-3 sentences per page, 15-25 words. Rich vocabulary but simple syntax. Questions to the reader. Emotional moments. Beginning-middle-end structure.",
    maxWordsPerPage: 30,
  },
  {
    id: "early_reader",
    label: "6-8 (Early Reader)",
    emoji: "📖",
    claudeReading: "Full paragraphs, 25-40 words per page. More complex plots with subplots. Character development. Richer vocabulary. Dialogue between characters.",
    maxWordsPerPage: 45,
  },
  {
    id: "chapter",
    label: "8-10 (Confident Reader)",
    emoji: "📚",
    claudeReading: "Longer text, 35-50 words per page. Complex narrative with twists. Internal monologue. Sophisticated vocabulary. Themes of friendship, courage, identity.",
    maxWordsPerPage: 55,
  },
];

// ── Themes / Lessons ─────────────────────────────────────────────────────────
export const THEMES = [
  { id: "bravery", emoji: "🦁", label: "Being brave" },
  { id: "kindness", emoji: "💛", label: "Kindness matters" },
  { id: "believe", emoji: "⭐", label: "Believe in yourself" },
  { id: "different", emoji: "🌈", label: "It's great to be different" },
  { id: "sharing", emoji: "🤝", label: "Sharing & teamwork" },
  { id: "nature", emoji: "🌿", label: "Love for nature" },
  { id: "family", emoji: "🏠", label: "Family is everything" },
  { id: "trying", emoji: "💪", label: "Never give up" },
  { id: "feelings", emoji: "🫶", label: "It's okay to feel feelings" },
  { id: "curiosity", emoji: "🔍", label: "Stay curious" },
  { id: "gratitude", emoji: "🙏", label: "Being thankful" },
  { id: "imagination", emoji: "✨", label: "Imagination is powerful" },
];

// ── Worlds / Settings ────────────────────────────────────────────────────────
export const WORLDS = [
  { id: "enchanted_forest", emoji: "🌳", label: "Enchanted Forest", vocab: "ancient trees, glowing mushrooms, fireflies, moss, dappled golden light" },
  { id: "outer_space", emoji: "🚀", label: "Outer Space", vocab: "stars, nebulae, planets, rocket ships, zero gravity, cosmic purple" },
  { id: "underwater", emoji: "🌊", label: "Under the Sea", vocab: "coral reefs, colourful fish, bubbles, treasure, bioluminescence" },
  { id: "fairy_kingdom", emoji: "🏰", label: "Fairy Kingdom", vocab: "castle spires, banners, gardens, royal balls, magic wands" },
  { id: "dinosaur_land", emoji: "🦕", label: "Dinosaur Island", vocab: "volcanic peaks, prehistoric jungle, giant ferns, dinosaur eggs" },
  { id: "candy_world", emoji: "🍭", label: "Candy World", vocab: "candy-coloured buildings, frosting rivers, cookie paths, sugar trees" },
  { id: "arctic", emoji: "❄️", label: "Arctic / Snow", vocab: "snow drifts, northern lights, ice caves, polar bears, cozy igloos" },
  { id: "pirate", emoji: "🏴‍☠️", label: "Pirate Adventure", vocab: "tall ships, treasure maps, tropical islands, parrots, treasure chests" },
  { id: "safari", emoji: "🦁", label: "Safari / Jungle", vocab: "tall grass, elephants, giraffes, jeeps, watering holes, sunset" },
  { id: "cloud_city", emoji: "☁️", label: "City in the Clouds", vocab: "floating islands, rainbow bridges, cloud castles, flying creatures" },
  { id: "backyard", emoji: "🏡", label: "The Backyard (but magical)", vocab: "garden shed portal, giant insects, talking flowers, puddle oceans" },
  { id: "toy_world", emoji: "🧸", label: "Toy World", vocab: "giant toy soldiers, building block cities, stuffed animal friends" },
  { id: "custom", emoji: "💭", label: "Custom — you describe it", vocab: "" },
];

// ── Languages ────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "es", label: "Spanish", flag: "🇪🇸" },
  { id: "fr", label: "French", flag: "🇫🇷" },
  { id: "de", label: "German", flag: "🇩🇪" },
  { id: "it", label: "Italian", flag: "🇮🇹" },
  { id: "pt", label: "Portuguese", flag: "🇵🇹" },
  { id: "nl", label: "Dutch", flag: "🇳🇱" },
  { id: "ja", label: "Japanese", flag: "🇯🇵" },
  { id: "ko", label: "Korean", flag: "🇰🇷" },
  { id: "zh", label: "Chinese (Simplified)", flag: "🇨🇳" },
  { id: "ar", label: "Arabic", flag: "🇸🇦" },
  { id: "hi", label: "Hindi", flag: "🇮🇳" },
];

// ── Legacy exports (keep for backwards compat with existing components) ─────
export const SPARKS = [
  { id: "adventure", emoji: "🗺️", title: "Big Adventure", subtitle: "They discover something amazing" },
  { id: "magic", emoji: "✨", title: "Magic Kingdom", subtitle: "Where anything is possible" },
  { id: "bedtime", emoji: "🌙", title: "Bedtime Journey", subtitle: "A cozy dream adventure" },
  { id: "superhero", emoji: "🦸", title: "Superhero Day", subtitle: "They save the day!" },
  { id: "nature", emoji: "🌿", title: "Into the Wild", subtitle: "Forest, ocean & jungle" },
  { id: "space", emoji: "🚀", title: "Space Explorer", subtitle: "Stars & galaxies await" },
  { id: "friendship", emoji: "🤝", title: "New Friend", subtitle: "A heartwarming bond" },
  { id: "sports", emoji: "⚽", title: "The Big Game", subtitle: "Dream big, play bigger" },
  { id: "custom", emoji: "💭", title: "My Own Idea", subtitle: "Type anything..." },
];

export const STORY_FORMATS = [
  { id: "rhyming", emoji: "🎵", label: "Rhyming", example: "One rainy day, Emma found a key / That opened a door to the Whispering Sea..." },
  { id: "classic", emoji: "📖", label: "Classic Story", example: "Emma had never seen a door quite like that one..." },
  { id: "funny", emoji: "😂", label: "Funny & Silly", example: "Emma's dragon sneezed and turned the castle into a bouncy castle." },
];

export const STORY_TONES = [
  { id: "cozy", label: "Cozy & Calming", lighting: "warm golden hour lighting, soft shadows, sunset palette" },
  { id: "exciting", label: "Exciting & Dramatic", lighting: "dynamic lighting, high contrast, dramatic sky" },
  { id: "heartfelt", label: "Warm & Heartfelt", lighting: "soft warm light, gentle tones, tender atmosphere" },
  { id: "chaotic", label: "Funny & Chaotic", lighting: "bright saturated colours, playful energy, exaggerated expressions" },
];

export const BOOK_LENGTHS = [
  { id: 4, label: "Quick Read", emoji: "📖", desc: "4 pages" },
  { id: 6, label: "Classic", emoji: "⭐", desc: "6 pages", default: true },
  { id: 10, label: "Epic Adventure", emoji: "🚀", desc: "10 pages", premium: true },
];
